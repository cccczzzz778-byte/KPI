import fs from "node:fs";

function read(file){if(!fs.existsSync(file))throw new Error("PATCH71 missing "+file);return fs.readFileSync(file,"utf8")}
function write(file,source){fs.mkdirSync(file.slice(0,file.lastIndexOf("/")),{recursive:true});fs.writeFileSync(file,source,"utf8");console.log("PATCH71: "+file)}

const route=String.raw`import ExcelJS from "exceljs";
import { commissions, criteria, type CommissionKey } from "@/lib/kpi-data";
import { getKpiDatabase } from "@/lib/netlify-db";
import { AccessError, accessErrorResponse, requireAppUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEYS: CommissionKey[] = ["ijro","birlamchi","statsionar","raqam","moliya"];
const MAX: Record<CommissionKey, number> = { ijro:10.3, birlamchi:29.4, statsionar:23.5, raqam:13.3, moliya:23.5 };
const IDS = Object.fromEntries(KEYS.map((key) => [key, criteria.filter((item) => item.commission === key).map((item) => item.id)])) as Record<CommissionKey,string[]>;

function score(raw:number,key:CommissionKey){
  const max=MAX[key];
  const count=IDS[key].length;
  if(!count) return 0;
  const value=Number(((raw/(count*2))*max).toFixed(1));
  return Math.max(0,Math.min(max,value));
}

function today(){
  const p=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tashkent",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const g=(t:string)=>p.find((x)=>x.type===t)?.value||"";
  return g("year")+"-"+g("month")+"-"+g("day");
}

export async function GET(request:Request){
  try{
    const session=await requireAppUser(request);
    if(!["admin","monitor"].includes(String(session.role))) throw new AccessError("Monitoring Excel hisobotiga ruxsat yo‘q.",403);

    const db=getKpiDatabase();
    const [institutionsResult,evaluationsResult]=await Promise.all([
      db.pool.query(`
        SELECT id,name,district,type
        FROM institutions
        WHERE active=1
        ORDER BY LOWER(name)
      `),
      db.pool.query(`
        SELECT DISTINCT ON (institution_id,criterion_id)
          institution_id AS "institutionId",
          criterion_id AS "criterionId",
          LEAST(2,GREATEST(0,score))::float8 AS score
        FROM evaluations
        ORDER BY institution_id,criterion_id,updated_at DESC
      `)
    ]);

    const evalMap=new Map(evaluationsResult.rows.map((row:any)=>[
      String(row.institutionId)+"::"+String(row.criterionId),
      Number(row.score||0)
    ]));

    const rows=institutionsResult.rows.map((institution:any)=>{
      const parts=Object.fromEntries(KEYS.map((key)=>[key,0])) as Record<CommissionKey,number>;
      let assessed=0;
      for(const key of KEYS){
        let raw=0;
        for(const criterionId of IDS[key]){
          const mapKey=String(institution.id)+"::"+criterionId;
          if(evalMap.has(mapKey)) assessed++;
          raw+=Number(evalMap.get(mapKey)||0);
        }
        parts[key]=score(raw,key);
      }
      const total=Number(KEYS.reduce((sum,key)=>sum+parts[key],0).toFixed(1));
      return {
        id:String(institution.id),
        name:String(institution.name),
        district:String(institution.district||""),
        type:String(institution.type||""),
        parts,
        total,
        assessed
      };
    }).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,"uz"));

    const workbook=new ExcelJS.Workbook();
    workbook.creator="Buxoro SSB KPI";
    workbook.created=new Date();
    const sheet=workbook.addWorksheet("Monitoring ballari",{views:[{state:"frozen",xSplit:3,ySplit:5}]});

    const headers=["№","Muassasa","Hudud",...KEYS.map((key)=>commissions.find((item)=>item.id===key)?.short||key),"JAMI BALL"];
    sheet.mergeCells(1,1,1,headers.length);
    const title=sheet.getCell(1,1);
    title.value="BUXORO VILOYATI TIBBIYOT MUASSASALARI — MONITORING KPI BALLARI";
    title.font={bold:true,size:16,color:{argb:"FFFFFFFF"}};
    title.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF155C57"}};
    title.alignment={horizontal:"center",vertical:"middle"};
    sheet.getRow(1).height=30;

    sheet.mergeCells(2,1,2,headers.length);
    const subtitle=sheet.getCell(2,1);
    subtitle.value="Holat sanasi: "+today()+" · Har bir yo‘nalish bo‘yicha oxirgi saqlangan baholar · Jami maksimum 100 ball";
    subtitle.font={italic:true,size:11,color:{argb:"FF475569"}};
    subtitle.alignment={horizontal:"center"};

    const headerRow=sheet.getRow(4);
    headerRow.values=headers;
    headerRow.height=42;
    for(let col=1;col<=headers.length;col++){
      const cell=headerRow.getCell(col);
      cell.font={bold:true,color:{argb:"FFFFFFFF"}};
      cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF14766F"}};
      cell.alignment={horizontal:"center",vertical:"middle",wrapText:true};
      cell.border={
        top:{style:"thin",color:{argb:"FFFFFFFF"}},
        bottom:{style:"thin",color:{argb:"FFFFFFFF"}},
        left:{style:"thin",color:{argb:"FFFFFFFF"}},
        right:{style:"thin",color:{argb:"FFFFFFFF"}}
      };
    }

    rows.forEach((row,index)=>{
      const excelRow=sheet.getRow(index+5);
      excelRow.values=[
        index+1,
        row.name,
        row.district,
        ...KEYS.map((key)=>row.parts[key]),
        row.total
      ];
      excelRow.height=30;
      for(let col=1;col<=headers.length;col++){
        const cell=excelRow.getCell(col);
        cell.alignment={horizontal:col===2||col===3?"left":"center",vertical:"middle",wrapText:true};
        cell.border={bottom:{style:"thin",color:{argb:"FFD8E6EA"}}};
        if(col>=4) cell.numFmt="0.0";
      }
      const totalCell=excelRow.getCell(headers.length);
      totalCell.font={bold:true,color:{argb:"FF0F766E"}};
      totalCell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF0FDFA"}};
    });

    const summaryRow=sheet.getRow(rows.length+6);
    summaryRow.getCell(1).value="";
    summaryRow.getCell(2).value="O‘RTACHA";
    summaryRow.getCell(2).font={bold:true};
    for(let i=0;i<KEYS.length;i++){
      const col=4+i;
      const avg=rows.length?rows.reduce((sum,row)=>sum+row.parts[KEYS[i]],0)/rows.length:0;
      summaryRow.getCell(col).value=Number(avg.toFixed(1));
      summaryRow.getCell(col).numFmt="0.0";
      summaryRow.getCell(col).font={bold:true};
    }
    const avgTotal=rows.length?rows.reduce((sum,row)=>sum+row.total,0)/rows.length:0;
    summaryRow.getCell(headers.length).value=Number(avgTotal.toFixed(1));
    summaryRow.getCell(headers.length).numFmt="0.0";
    summaryRow.getCell(headers.length).font={bold:true,color:{argb:"FF0F766E"}};
    summaryRow.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFEFF8F7"}};

    sheet.getColumn(1).width=7;
    sheet.getColumn(2).width=52;
    sheet.getColumn(3).width=22;
    for(let col=4;col<headers.length;col++) sheet.getColumn(col).width=19;
    sheet.getColumn(headers.length).width=15;
    sheet.autoFilter={from:{row:4,column:1},to:{row:4+rows.length,column:headers.length}};

    const buffer=await workbook.xlsx.writeBuffer();
    const filename="Buxoro_KPI_Monitoring_"+today()+".xlsx";
    return new Response(new Uint8Array(buffer),{
      headers:{
        "content-type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition":'attachment; filename="'+filename+'"',
        "cache-control":"no-store"
      }
    });
  }catch(error){
    return accessErrorResponse(error);
  }
}
`;

write("app/api/reports/monitoring-scores/route.ts",route);

{
  const file="components/kpi-period-reports.tsx";
  let s=read(file);
  if(!s.includes("/api/reports/monitoring-scores")){
    const anchor='{links.map(({ period, href }) => <a key={period} href={href} className="kpi-export-button"><Download size={16} />{labels[period]}</a>)}';
    if(!s.includes(anchor)) throw new Error("PATCH71 monitoring Excel button anchor missing");
    s=s.replace(
      anchor,
      anchor+'<a href="/api/reports/monitoring-scores" className="kpi-export-button kpi-export-monitoring"><Download size={16} />Monitoring Excel</a>'
    );
  }
  write(file,s);
}

{
  const file="app/globals.css";
  let s=read(file);
  if(!s.includes("PATCH71_MONITORING_EXCEL")){
    s+='\n/* PATCH71_MONITORING_EXCEL */\n.kpi-export-monitoring{background:#0f5f9f!important}.kpi-export-monitoring:hover{background:#0b4f87!important}\n';
  }
  write(file,s);
}

console.log("PATCH71: Monitoring panel Excel export added.");
console.log("PATCH71: columns = Muassasa, Hudud, 5 directions, JAMI BALL.");
console.log("PATCH71: report uses the latest persisted score for each institution/criterion and keeps the 100-point weighting.");
