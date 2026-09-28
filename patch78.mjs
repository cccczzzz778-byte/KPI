import fs from "node:fs";

function read(file){if(!fs.existsSync(file))throw new Error("PATCH78 missing "+file);return fs.readFileSync(file,"utf8")}
function write(file,source){fs.writeFileSync(file,source,"utf8");console.log("PATCH78: "+file)}

// Make the admin tab bar compact without changing any tab content or behavior.
{
  const file="components/kpi-app.tsx";
  let s=read(file);
  const replacements=[
    ['<TabsTrigger value="users"><UserCog /> Foydalanuvchilar</TabsTrigger>','<TabsTrigger value="users" title="Foydalanuvchilar"><UserCog /> Foydalanuvchi</TabsTrigger>'],
    ['<TabsTrigger value="institutions"><Hospital /> Muassasalar</TabsTrigger>','<TabsTrigger value="institutions" title="Muassasalar"><Hospital /> Muassasalar</TabsTrigger>'],
    ['<TabsTrigger value="orders"><Paperclip /> Yuklangan BUYRUQLAR</TabsTrigger>','<TabsTrigger value="orders" title="Yuklangan BUYRUQLAR"><Paperclip /> Buyruqlar</TabsTrigger>'],
    ['<TabsTrigger value="files">📂 Yuklangan fayllar</TabsTrigger>','<TabsTrigger value="files" title="Yuklangan fayllar">📂 Fayllar</TabsTrigger>'],
    ['<TabsTrigger value="evaluations"><ClipboardCheck /> Baholar va asoslar</TabsTrigger>','<TabsTrigger value="evaluations" title="Baholar va asoslar"><ClipboardCheck /> Baholar</TabsTrigger>'],
    ['<TabsTrigger value="system">🛠 Tizim nazorati</TabsTrigger>','<TabsTrigger value="system" title="Tizim nazorati">🛠 Tizim</TabsTrigger>'],
    ['<TabsTrigger value="logs"><Activity /> Faoliyat jurnali</TabsTrigger>','<TabsTrigger value="logs" title="Faoliyat jurnali"><Activity /> Jurnal</TabsTrigger>'],
  ];
  for(const [from,to] of replacements){
    if(s.includes(from)) s=s.replace(from,to);
  }
  if(!s.includes('title="Baholar va asoslar"')) throw new Error("PATCH78 admin tab labels anchor missing");
  write(file,s);
}

{
  const file="app/globals.css";
  let s=read(file);
  if(!s.includes("PATCH78_COMPACT_ADMIN_TABS")){
    s+=`
/* PATCH78_COMPACT_ADMIN_TABS */
.workspace-toolbar{min-height:50px;padding:0 12px 0 14px;gap:10px}
.workspace-tabs{min-height:49px;gap:8px;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;max-width:100%;flex:1}
.workspace-tabs [data-slot="tabs-trigger"]{height:49px;padding:0 7px;font-size:11px;gap:5px;white-space:nowrap;flex:0 0 auto}
.workspace-tabs [data-slot="tabs-trigger"] svg{width:15px;height:15px}
.workspace-toolbar>button{flex:0 0 auto}
@media(max-width:900px){
  .workspace-toolbar{padding:0 8px;gap:6px}
  .workspace-tabs{gap:5px}
  .workspace-tabs [data-slot="tabs-trigger"]{height:46px;padding:0 6px;font-size:10px}
}
`;
  }
  write(file,s);
}

console.log("PATCH78: admin navigation compacted; labels shortened; full labels remain in title tooltips; tab content unchanged.");
