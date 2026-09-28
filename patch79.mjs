import fs from "node:fs";

function read(file){if(!fs.existsSync(file))throw new Error("PATCH79 missing "+file);return fs.readFileSync(file,"utf8")}
function write(file,source){fs.writeFileSync(file,source,"utf8");console.log("PATCH79: "+file)}

// Remove the legacy Faoliyat jurnali tab from Admin.
// Audit remains available inside the newer System Control page.
{
  const file="components/kpi-app.tsx";
  let s=read(file);

  s=s.replace(
    '<TabsTrigger value="logs" title="Faoliyat jurnali"><Activity /> Jurnal</TabsTrigger>',
    ''
  );

  const logsBlock=`<TabsContent value="logs" className="panel-content">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Vaqt</TableHead>
        <TableHead>Foydalanuvchi</TableHead>
        <TableHead>Amal</TableHead>
        <TableHead>Obyekt</TableHead>
        <TableHead>Tafsilot</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {data.auditLogs.map((log) => (
        <TableRow key={log.id}>
          <TableCell>{new Date(log.createdAt).toLocaleString("uz-UZ")}</TableCell>
          <TableCell>{log.actorEmail}</TableCell>
          <TableCell>{log.action}</TableCell>
          <TableCell>{log.targetType}: {log.targetId}</TableCell>
          <TableCell className="wrap-cell">{log.details}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</TabsContent>`;

  if(s.includes(logsBlock)) s=s.replace(logsBlock,"");
  else {
    const start=s.indexOf('<TabsContent value="logs" className="panel-content">');
    if(start>=0){
      const end=s.indexOf('</TabsContent>',start);
      if(end<0) throw new Error("PATCH79 logs content closing anchor missing");
      s=s.slice(0,start)+s.slice(end+'</TabsContent>'.length);
    }
  }

  // Use a natural plural label in the compact admin menu.
  s=s.replace(
    '<TabsTrigger value="users" title="Foydalanuvchilar"><UserCog /> Foydalanuvchi</TabsTrigger>',
    '<TabsTrigger value="users" title="Foydalanuvchilar"><UserCog /> Foydalanuvchilar</TabsTrigger>'
  );

  if(s.includes('value="logs"')) throw new Error("PATCH79 legacy logs tab still present");
  write(file,s);
}

// Normalize the admin navigation: six equal tabs, no clipped horizontal scroll on desktop.
{
  const file="app/globals.css";
  let s=read(file);
  if(!s.includes("PATCH79_NORMAL_ADMIN_NAV")){
    s+=`
/* PATCH79_NORMAL_ADMIN_NAV */
.workspace-toolbar{
  min-height:54px;
  padding:0 14px;
  display:grid;
  grid-template-columns:minmax(0,1fr) auto;
  align-items:center;
  gap:12px;
}
.workspace-tabs{
  min-height:52px;
  width:100%;
  max-width:none;
  display:grid;
  grid-template-columns:repeat(6,minmax(0,1fr));
  gap:4px;
  overflow:visible;
  scrollbar-width:auto;
}
.workspace-tabs [data-slot="tabs-trigger"]{
  width:100%;
  height:52px;
  min-width:0;
  padding:0 8px;
  justify-content:center;
  font-size:11px;
  gap:5px;
  white-space:nowrap;
}
.workspace-tabs [data-slot="tabs-trigger"] svg{
  width:15px;
  height:15px;
  flex:0 0 auto;
}
.workspace-toolbar>button{justify-self:end}
@media(max-width:980px){
  .workspace-toolbar{grid-template-columns:1fr;align-items:stretch;padding:8px 10px}
  .workspace-tabs{grid-template-columns:repeat(3,minmax(0,1fr));min-height:auto}
  .workspace-tabs [data-slot="tabs-trigger"]{height:44px}
  .workspace-toolbar>button{justify-self:end}
}
@media(max-width:560px){
  .workspace-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}
  .workspace-tabs [data-slot="tabs-trigger"]{font-size:10px;padding:0 5px}
}
`;
  }
  write(file,s);
}

console.log("PATCH79: legacy activity journal removed; admin navigation normalized; System Control audit preserved.");
