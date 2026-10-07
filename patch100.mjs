import fs from "node:fs";

const file="app/api/reports/monitoring-scores/route.ts";
if(!fs.existsSync(file)) throw new Error("PATCH100 monitoring route missing");
let s=fs.readFileSync(file,"utf8");

if(!s.includes("PATCH100_NA_FORMULA")){
  const anchor="    styleSheet(sheet,9,rows.length);";
  if(!s.includes(anchor)) throw new Error("PATCH100 JAMI sheet anchor missing");
  const insert=`    // PATCH100_NA_FORMULA\n    for(let r=5;r<5+rows.length;r++){\n      const currentResult=Number(sheet.getCell(r,9).value||0);\n      const formula=\"IFERROR(ROUND(SUM(D\"+r+\":H\"+r+\")/(IF(D\"+r+\"=\\\"N/A\\\",0,10.3)+IF(E\"+r+\"=\\\"N/A\\\",0,29.4)+IF(F\"+r+\"=\\\"N/A\\\",0,23.5)+IF(G\"+r+\"=\\\"N/A\\\",0,13.3)+IF(H\"+r+\"=\\\"N/A\\\",0,23.5))*100,1),0)\";\n      sheet.getCell(r,9).value={formula,result:currentResult};\n    }\n    workbook.calcProperties.fullCalcOnLoad=true;\n\n`;
  s=s.replace(anchor,insert+anchor);
}

fs.writeFileSync(file,s,"utf8");
console.log("PATCH100: JAMI BALL now contains the N/A-aware Excel formula and recalculates on open.");
