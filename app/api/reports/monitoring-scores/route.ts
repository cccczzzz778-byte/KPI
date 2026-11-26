import ExcelJS from "exceljs";
import { commissions, criteria, type CommissionKey } from "@/lib/kpi-data";
import { ensureApplicabilityTable } from "@/lib/institution-applicability";
import { getKpiDatabase } from "@/lib/netlify-db";
import { getMonthOverride, KPI_MONTH_OVERRIDES } from "@/lib/kpi-month-overrides";
import { AccessError, accessErrorResponse, requireAppUser } from "@/lib/server-auth";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const KEYS:CommissionKey[]=["ijro","birlamchi","statsionar","raqam","moliya"];
const MAX:Record<CommissionKey,number>={ijro:10.6,birlamchi:27.3,statsionar:19.7,raqam:22.7,moliya:19.7};
const SHEET_NAMES:Record<CommissionKey,string>={
  ijro:"Ijro intizom",
  birlamchi:"Birlamchi",
  statsionar:"Statsionar",
  raqam:"Raqamlashtirish",
  moliya:"Moliya va infratuzilma",
};
const HEADERS:Record<CommissionKey,string>={
  ijro:"Ijro intizomi (10,6)",
  birlamchi:"Birlamchi yordam (27,3)",
  statsionar:"Statsionar xizmat (19,7)",
  raqam:"Raqamlashtirish    (22,7)",
  moliya:"Moliya va infratuzilma (19,7)",
};
const TITLE:Record<CommissionKey,string>={
  ijro:"BUXORO VILOYATI TIBBIYOT MUASSASALARI — IJRO INTIZOM KPI BALLARI",
  birlamchi:"BUXORO VILOYATI TIBBIYOT MUASSASALARI — BIRLAMCHI YORDAM KPI BALLARI",
  statsionar:"BUXORO VILOYATI TIBBIYOT MUASSASALARI — STATSIONAR XIZMAT KPI BALLARI",
  raqam:"BUXORO VILOYATI TIBBIYOT MUASSASALARI — RAQAMLASHTIRISH KPI BALLARI",
  moliya:"BUXORO VILOYATI TIBBIYOT MUASSASALARI — MOLIYA VA INFRATUZILMA KPI BALLARI",
};
const IDS=Object.fromEntries(KEYS.map((key)=>[key,criteria.filter((item)=>item.commission===key).map((item)=>item.id)])) as Record<CommissionKey,string[]>;

function score(raw:number,key:CommissionKey){
  const max=MAX[key],count=IDS[key].length;
  if(!count)return 0;
  const value=Number(((raw/(count*2))*max).toFixed(1));
  return Math.max(0,Math.min(max,value));
}

function today(){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tashkent",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const get=(type:string)=>parts.find((item)=>item.type===type)?.value||"";
  return get("year")+"-"+get("month")+"-"+get("day");
}

function styleSheet(sheet:ExcelJS.Worksheet,lastCol:number,rowCount:number){
  sheet.views=[{state:"frozen",xSplit:3,ySplit:4}];
  sheet.getRow(1).height=31;
  sheet.getRow(2).height=22;
  sheet.getRow(4).height=43;

  sheet.mergeCells(1,1,1,lastCol);
  sheet.mergeCells(2,1,2,lastCol);

  const title=sheet.getCell(1,1);
  title.font={bold:true,size:16,color:{argb:"FFFFFFFF"}};
  title.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF16645E"}};
  title.alignment={horizontal:"center",vertical:"middle"};

  const subtitle=sheet.getCell(2,1);
  subtitle.font={italic:true,size:11,color:{argb:"FF64748B"}};
  subtitle.alignment={horizontal:"center",vertical:"middle"};

  for(let c=1;c<=lastCol;c++){
    const cell=sheet.getCell(4,c);
    cell.font={bold:true,color:{argb:"FFFFFFFF"}};
    cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF147D75"}};
    cell.alignment={horizontal:"center",vertical:"middle",wrapText:true};
    cell.border={
      top:{style:"thin",color:{argb:"FF111827"}},
      bottom:{style:"thin",color:{argb:"FF111827"}},
      left:{style:"thin",color:{argb:"FF111827"}},
      right:{style:"thin",color:{argb:"FF111827"}},
    };
  }

  for(let r=5;r<5+rowCount;r++){
    sheet.getRow(r).height=32;
    for(let c=1;c<=lastCol;c++){
      const cell=sheet.getCell(r,c);
      cell.alignment={horizontal:c===2||c===3?"left":"center",vertical:"middle",wrapText:true};
      cell.border={
        top:{style:"thin",color:{argb:"FF111827"}},
        bottom:{style:"thin",color:{argb:"FF111827"}},
        left:{style:"thin",color:{argb:"FF111827"}},
        right:{style:"thin",color:{argb:"FF111827"}},
      };
      if(c>=4&&typeof cell.value==="number")cell.numFmt="0.0";
    }
  }

  sheet.autoFilter={from:{row:4,column:1},to:{row:4+rowCount,column:lastCol}};
}

async function allMonthsWorkbook(currentDate:string){
  const db=getKpiDatabase();
  const [ir,er,xr]=await Promise.all([
    db.pool.query("SELECT id,name,district FROM institutions WHERE active=1 ORDER BY LOWER(name)"),
    db.pool.query(`WITH source AS (
      SELECT institution_id,criterion_id,evaluation_date,updated_at,score,
        CASE WHEN evaluation_date < DATE '2026-10-05' THEN '2026-09' ELSE TO_CHAR(evaluation_date,'YYYY-MM') END AS month
      FROM daily_evaluations WHERE evaluation_date <= $1::date
    ) SELECT DISTINCT ON (month,institution_id,criterion_id) month,institution_id AS "institutionId",criterion_id AS "criterionId",LEAST(2,GREATEST(0,score))::float8 AS score
      FROM source ORDER BY month,institution_id,criterion_id,evaluation_date DESC,updated_at DESC`,[currentDate]),
    db.pool.query('SELECT institution_id AS "institutionId",commission FROM institution_commission_exclusions'),
  ]);
  const months=Array.from(new Set<string>([currentDate.slice(0,7),...Object.keys(KPI_MONTH_OVERRIDES),...er.rows.map(r=>String(r.month))])).filter(m=>/^\d{4}-\d{2}$/.test(m)&&m<=currentDate.slice(0,7)).sort();
  const ev=new Map<string,number>(er.rows.map(r=>[JSON.stringify([r.month,r.institutionId,r.criterionId]),Number(r.score)]));
  const excluded=new Set<string>(xr.rows.map(r=>JSON.stringify([r.institutionId,r.commission])));
  const workbook=new ExcelJS.Workbook();
  workbook.creator="Buxoro SSB KPI";
  const summary=workbook.addWorksheet("JAMI OYLAR");
  const directionSheets=Object.fromEntries(KEYS.map(k=>[k,workbook.addWorksheet(SHEET_NAMES[k])])) as Record<CommissionKey,ExcelJS.Worksheet>;
  const detail=workbook.addWorksheet("Mezonlar izohi");
  const institutionRows=ir.rows.map(i=>{
    const id=String(i.id);
    const periods=months.map(month=>{
      const override=getMonthOverride(month,id);
      const parts=Object.fromEntries(KEYS.map(k=>{
        if(override ? override[k]===null : excluded.has(JSON.stringify([id,k])))return [k,null];
        return [k,override ? Number(override[k]||0) : score(IDS[k].reduce((v,c)=>v+(ev.get(JSON.stringify([month,id,c]))??0),0),k)];
      })) as Record<CommissionKey,number|null>;
      const assessed=Boolean(override)||criteria.some(c=>parts[c.commission]!==null&&ev.has(JSON.stringify([month,id,c.id])));
      const max=KEYS.reduce((v,k)=>v+(parts[k]===null?0:MAX[k]),0);
      const total=assessed&&max>0?Number((KEYS.reduce((v,k)=>v+(parts[k]??0),0)/max*100).toFixed(1)):null;
      return {month,parts,total,override:Boolean(override)};
    });
    const available=periods.flatMap(p=>p.total===null?[]:[p.total]);
    return {id,name:String(i.name),district:String(i.district||""),periods,average:available.length?Number((available.reduce((a,b)=>a+b,0)/available.length).toFixed(1)):null,sum:available.length?Number(available.reduce((a,b)=>a+b,0).toFixed(1)):null};
  }).sort((a,b)=>Number(b.average!==null)-Number(a.average!==null)||(b.average??0)-(a.average??0)||a.name.localeCompare(b.name,"uz"));
  const label="Har oy uchun so‘nggi saqlangan baho; N/A — tatbiq etilmaydi; — baho mavjud emas.";
  summary.getCell(1,1).value="BUXORO KPI — BARCHA OYLAR JAMI";
  summary.getCell(2,1).value=label;
  summary.getRow(4).values=["№","Muassasa","Hudud",...months,"Jami ball","O‘rtacha /100"];
  institutionRows.forEach((r,i)=>summary.getRow(i+5).values=[i+1,r.name,r.district,...r.periods.map(p=>p.total??"—"),r.sum??"—",r.average??"—"]);
  styleSheet(summary,5+months.length,institutionRows.length);
  for(let c=1;c<=5+months.length;c++)summary.getColumn(c).width=c===1?7:c===2?58:c===3?24:18;
  for(const k of KEYS){
    const sh=directionSheets[k];
    const items=criteria.filter(c=>c.commission===k);
    sh.getCell(1,1).value=TITLE[k];
    sh.getCell(2,1).value="Mezonlar: 0/1/2; yo‘nalish jami: "+MAX[k]+" ball. "+label;
    const headers=["№","Muassasa","Hudud",...months.flatMap(m=>[...items.map(c=>m+" | "+c.id),m+" | JAMI"])];
    sh.getRow(4).values=headers;
    institutionRows.forEach((r,i)=>{
      sh.getRow(i+5).values=[i+1,r.name,r.district,...r.periods.flatMap(p=>[
        ...items.map(c=>p.parts[k]===null?"N/A":ev.get(JSON.stringify([p.month,r.id,c.id]))??"—"),
        p.parts[k]===null?"N/A":p.total===null?"—":p.parts[k]??"—"
      ])];
    });
    styleSheet(sh,headers.length,institutionRows.length);
    for(let c=1;c<=headers.length;c++)sh.getColumn(c).width=c===1?7:c===2?58:c===3?24:18;
  }
  detail.getCell(1,1).value="MEZONLAR LUG‘ATI";
  detail.getCell(2,1).value="Tarixiy tayyor yo‘nalish ballari saqlangan mezon baholaridan farq qilishi mumkin; mavjud bo‘lmagan baholar to‘ldirilmaydi.";
  detail.getRow(4).values=["№","Mezon kodi","Yo‘nalish","Mezon nomi","Maksimal KPI ball"];
  criteria.forEach((c,i)=>detail.getRow(i+5).values=[i+1,c.id,SHEET_NAMES[c.commission],c.title,MAX[c.commission]/IDS[c.commission].length]);
  styleSheet(detail,5,criteria.length);
  [7,20,30,100,24].forEach((w,i)=>detail.getColumn(i+1).width=w);
  for(let i=5;i<5+criteria.length;i++){detail.getRow(i).height=65;detail.getCell(i,5).numFmt="0.000";}
  const buffer=await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer),{headers:{
    "content-type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "content-disposition":'attachment; filename="Buxoro_KPI_Barcha_oylar_'+currentDate+'.xlsx"',
    "cache-control":"no-store"
  }});
}

export async function GET(request:Request){
  try{
    const session=await requireAppUser(request);
    if(!["admin","monitor"].includes(String(session.role))){
      throw new AccessError("Monitoring Excel hisobotiga ruxsat yo‘q.",403);
    }

    await ensureApplicabilityTable();
    const db=getKpiDatabase();
    const currentDate=today();
    const url=new URL(request.url);
    if(url.searchParams.get("month")==="all")return await allMonthsWorkbook(currentDate);
    const requestedMonth=String(url.searchParams.get("month")||"").trim();
    const selectedMonth=/^\d{4}-\d{2}$/.test(requestedMonth)?requestedMonth:"";
    let periodStart="",periodEnd=currentDate;
    if(selectedMonth){
      periodStart=selectedMonth==="2026-09"?"2000-01-01":selectedMonth==="2026-10"?"2026-10-05":selectedMonth+"-01";
      const [year,month]=selectedMonth.split("-").map(Number);
      const monthEnd=selectedMonth==="2026-09"?"2026-10-04":new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
      periodEnd=selectedMonth===currentDate.slice(0,7)&&monthEnd>currentDate?currentDate:monthEnd;
    }

    const [institutionsResult,evaluationsResult,exclusionResult]=await Promise.all([
      db.pool.query("SELECT id,name,district,type FROM institutions WHERE active=1 ORDER BY LOWER(name)"),
      db.pool.query(
        selectedMonth
          ?"SELECT institution_id AS \"institutionId\", criterion_id AS \"criterionId\", (ARRAY_AGG(LEAST(2,GREATEST(0,score)) ORDER BY evaluation_date DESC, updated_at DESC))[1]::float8 AS score FROM daily_evaluations WHERE evaluation_date BETWEEN $1::date AND $2::date GROUP BY institution_id,criterion_id"
          :"SELECT institution_id AS \"institutionId\", criterion_id AS \"criterionId\", (ARRAY_AGG(LEAST(2,GREATEST(0,score)) ORDER BY evaluation_date DESC, updated_at DESC))[1]::float8 AS score FROM daily_evaluations WHERE evaluation_date <= $1::date GROUP BY institution_id,criterion_id",
        selectedMonth?[periodStart,periodEnd]:[currentDate],
      ),
      db.pool.query("SELECT institution_id AS \"institutionId\",commission FROM institution_commission_exclusions"),
    ]);

    const evalMap=new Map(
      evaluationsResult.rows.map((row:any)=>[
        String(row.institutionId)+"::"+String(row.criterionId),
        Number(row.score||0),
      ]),
    );

    const excludedMap=new Map<string,Set<CommissionKey>>();
    for(const row of exclusionResult.rows){
      const institutionId=String(row.institutionId);
      const commission=String(row.commission) as CommissionKey;
      if(!KEYS.includes(commission))continue;
      if(!excludedMap.has(institutionId))excludedMap.set(institutionId,new Set<CommissionKey>());
      excludedMap.get(institutionId)!.add(commission);
    }

    const rows=institutionsResult.rows.map((institution:any)=>{
      const id=String(institution.id);
      const override=getMonthOverride(selectedMonth,id);
      const excluded=override?new Set<CommissionKey>(KEYS.filter((key)=>override[key]===null)):(excludedMap.get(id)??new Set<CommissionKey>());
      const parts=Object.fromEntries(KEYS.map((key)=>[key,0])) as Record<CommissionKey,number>;

      for(const key of KEYS){
        if(excluded.has(key))continue;
        let raw=0;
        for(const criterionId of IDS[key]){
          raw+=Number(evalMap.get(id+"::"+criterionId)||0);
        }
        parts[key]=score(raw,key);
        if(override)parts[key]=Number(override[key]||0);
      }

      const applicable=KEYS.filter((key)=>!excluded.has(key));
      const rawTotal=applicable.reduce((sum,key)=>sum+parts[key],0);
      const applicableMax=applicable.reduce((sum,key)=>sum+MAX[key],0);
      const total=applicableMax>0?Number(((rawTotal/applicableMax)*100).toFixed(1)):0;

      return{
        id,
        name:String(institution.name),
        district:String(institution.district||""),
        parts,
        total,
        excludedDirections:Array.from(excluded),
      };
    }).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,"uz"));

    const workbook=new ExcelJS.Workbook();
    workbook.creator="Buxoro SSB KPI";
    workbook.created=new Date();

    const subtitle=selectedMonth?"Hisobot oyi: "+selectedMonth+" · Davr: "+periodStart+" — "+periodEnd+" · Oylik baholar o‘rtachasi · N/A yo‘nalishlar hisobdan chiqarilgan · Jami maksimum 100 ball":"Holat sanasi: "+currentDate+" · Shu vaqtgacha saqlangan baholar o‘rtachasi · N/A yo‘nalishlar hisobdan chiqarilgan · Jami maksimum 100 ball";

    for(const key of KEYS){
      const sheet=workbook.addWorksheet(SHEET_NAMES[key]);
      sheet.getCell(1,1).value=TITLE[key];
      sheet.getCell(2,1).value=subtitle;
      sheet.getRow(4).values=["№","Muassasa","Hudud",HEADERS[key]];

      rows.forEach((row,index)=>{
        sheet.getRow(index+5).values=[
          index+1,
          row.name,
          row.district,
          row.excludedDirections.includes(key)?"N/A":row.parts[key],
        ];
      });

      styleSheet(sheet,4,rows.length);
      sheet.getColumn(1).width=7;
      sheet.getColumn(2).width=58;
      sheet.getColumn(3).width=24;
      sheet.getColumn(4).width=25;
    }

    const sheet=workbook.addWorksheet("JAMI");
    sheet.getCell(1,1).value="BUXORO VILOYATI TIBBIYOT MUASSASALARI — MONITORING KPI BALLARI";
    sheet.getCell(2,1).value=subtitle;
    sheet.getRow(4).values=[
      "№","Muassasa","Hudud",
      HEADERS.ijro,HEADERS.birlamchi,HEADERS.statsionar,HEADERS.raqam,HEADERS.moliya,
      "JAMI BALL",
    ];

    rows.forEach((row,index)=>{
      sheet.getRow(index+5).values=[
        index+1,row.name,row.district,
        row.excludedDirections.includes("ijro")?"N/A":row.parts.ijro,
        row.excludedDirections.includes("birlamchi")?"N/A":row.parts.birlamchi,
        row.excludedDirections.includes("statsionar")?"N/A":row.parts.statsionar,
        row.excludedDirections.includes("raqam")?"N/A":row.parts.raqam,
        row.excludedDirections.includes("moliya")?"N/A":row.parts.moliya,
        row.total,
      ];
    });

    // PATCH100_NA_FORMULA
    for(let r=5;r<5+rows.length;r++){
      const currentResult=Number(sheet.getCell(r,9).value||0);
      const formula="IFERROR(ROUND(SUM(D"+r+":H"+r+")/(IF(D"+r+"=\"N/A\",0,10.6)+IF(E"+r+"=\"N/A\",0,27.3)+IF(F"+r+"=\"N/A\",0,19.7)+IF(G"+r+"=\"N/A\",0,22.7)+IF(H"+r+"=\"N/A\",0,19.7))*100,1),0)";
      sheet.getCell(r,9).value={formula,result:currentResult};
    }
    workbook.calcProperties.fullCalcOnLoad=true;

    styleSheet(sheet,9,rows.length);
    sheet.getColumn(1).width=7;
    sheet.getColumn(2).width=58;
    sheet.getColumn(3).width=24;
    sheet.getColumn(4).width=23;
    sheet.getColumn(5).width=24;
    sheet.getColumn(6).width=24;
    sheet.getColumn(7).width=24;
    sheet.getColumn(8).width=27;
    sheet.getColumn(9).width=16;

    for(let r=5;r<5+rows.length;r++){
      const cell=sheet.getCell(r,9);
      cell.font={bold:true,color:{argb:"FF000000"}};
      cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF00B957"}};
      cell.numFmt="0.0";
    }

    const buffer=await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer),{headers:{
      "content-type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition":'attachment; filename="Buxoro_KPI_Monitoring_'+(selectedMonth||currentDate)+'.xlsx"',
      "cache-control":"no-store",
    }});
  }catch(error){
    return accessErrorResponse(error);
  }
}
