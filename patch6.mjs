import fs from 'node:fs';
import path from 'node:path';

function patchFile(relative, patcher) {
  const target = path.join(process.cwd(), relative);
  const original = fs.readFileSync(target, 'utf8');
  const updated = patcher(original);
  if (updated === original) throw new Error(`Patch did not change ${relative}`);
  fs.writeFileSync(target, updated, 'utf8');
  console.log(`Patched ${relative}`);
}

const apiRoute = String.raw`import { randomBytes, scryptSync } from "node:crypto";
import { getKpiDatabase } from "@/lib/netlify-db";
import { AccessError, accessErrorResponse, requireAppUser } from "@/lib/server-auth";

export const runtime = "nodejs";

type InstitutionAccount = {
  id: string;
  name: string;
  district: string;
  type: string;
  active: boolean;
  login: string;
  accountActive: boolean;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return "scrypt$" + salt + "$" + hash;
}

function validatePassword(password: string) {
  if (password.length < 8) throw new AccessError("Parol kamida 8 ta belgidan iborat bo‘lsin.");
}

async function requireAdmin(request: Request) {
  const session = await requireAppUser(request);
  if (session.role !== "admin") throw new AccessError("Faqat admin muassasa loginlarini boshqara oladi.");
  return session;
}

async function loadAccounts() {
  const db = getKpiDatabase();
  const result = await db.pool.query(
    `SELECT i.id, i.name, COALESCE(i.district, '') AS district, COALESCE(i.type, '') AS type,
            i.active AS "institutionActive",
            COALESCE(u.email, '') AS login,
            COALESCE(u.active, 0) AS "accountActive"
       FROM institutions i
       LEFT JOIN LATERAL (
         SELECT email, active
           FROM users
          WHERE institution_id = i.id AND role = 'institution'
          ORDER BY active DESC, updated_at DESC, email ASC
          LIMIT 1
       ) u ON TRUE
      ORDER BY i.name ASC`,
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    district: String(row.district || ""),
    type: String(row.type || ""),
    active: Number(row.institutionActive) === 1 || row.institutionActive === true,
    login: String(row.login || ""),
    accountActive: Number(row.accountActive) === 1 || row.accountActive === true,
  })) as InstitutionAccount[];
}

async function nextNumber() {
  const db = getKpiDatabase();
  const result = await db.pool.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 3) AS INTEGER)), 0) AS n
       FROM institutions
      WHERE id ~ '^m-[0-9]+$'`,
  );
  return Number(result.rows[0]?.n || 0) + 1;
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const [institutions, n] = await Promise.all([loadAccounts(), nextNumber()]);
    return Response.json({
      institutions,
      nextId: "m-" + String(n).padStart(3, "0"),
      nextLogin: "muassasa-" + String(n).padStart(3, "0"),
    });
  } catch (error) {
    return accessErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const db = getKpiDatabase();
  const client = await db.pool.connect();
  try {
    await requireAdmin(request);
    const body = await request.json();
    const name = clean(body.name);
    const district = clean(body.district);
    const type = clean(body.type);
    let login = clean(body.login).toLowerCase();
    const password = clean(body.password);
    if (!name) throw new AccessError("Muassasa nomini kiriting.");
    if (!district) throw new AccessError("Tuman/shaharni kiriting.");
    if (!type) throw new AccessError("Muassasa turini kiriting.");
    validatePassword(password);

    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(739041)");
    const maxResult = await client.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 3) AS INTEGER)), 0) AS n
         FROM institutions
        WHERE id ~ '^m-[0-9]+$'`,
    );
    const n = Number(maxResult.rows[0]?.n || 0) + 1;
    const id = "m-" + String(n).padStart(3, "0");
    if (!login) login = "muassasa-" + String(n).padStart(3, "0");
    if (!/^[a-z0-9._-]{3,64}$/.test(login)) throw new AccessError("Login faqat lotin harfi, raqam, nuqta, _ yoki - dan iborat bo‘lsin.");

    const loginResult = await client.query("SELECT 1 FROM users WHERE email=$1 LIMIT 1", [login]);
    if (loginResult.rowCount) throw new AccessError("Bu login band. Boshqa login kiriting.");

    await client.query(
      "INSERT INTO institutions (id, name, district, type, active) VALUES ($1,$2,$3,$4,1)",
      [id, name, district, type],
    );
    await client.query(
      "INSERT INTO users (email, name, role, commission, active, password_hash, institution_id) VALUES ($1,$2,'institution','',1,$3,$4)",
      [login, name, passwordHash(password), id],
    );
    await client.query("COMMIT");
    return Response.json({ ok: true, id, login });
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    return accessErrorResponse(error);
  } finally {
    client.release();
  }
}

export async function PATCH(request: Request) {
  const db = getKpiDatabase();
  const client = await db.pool.connect();
  try {
    await requireAdmin(request);
    const body = await request.json();
    const institutionId = clean(body.institutionId);
    const name = clean(body.name);
    const district = clean(body.district);
    const type = clean(body.type);
    const password = clean(body.password);
    const active = body.active === false ? 0 : 1;
    if (!institutionId) throw new AccessError("Muassasa aniqlanmadi.");
    if (!name) throw new AccessError("Muassasa nomini kiriting.");
    if (!district) throw new AccessError("Tuman/shaharni kiriting.");
    if (!type) throw new AccessError("Muassasa turini kiriting.");
    if (password) validatePassword(password);

    await client.query("BEGIN");
    const institutionResult = await client.query("SELECT id FROM institutions WHERE id=$1 LIMIT 1", [institutionId]);
    if (!institutionResult.rowCount) throw new AccessError("Muassasa topilmadi.");

    await client.query(
      "UPDATE institutions SET name=$2, district=$3, type=$4, active=$5 WHERE id=$1",
      [institutionId, name, district, type, active],
    );

    const accountResult = await client.query(
      "SELECT email FROM users WHERE institution_id=$1 AND role='institution' ORDER BY active DESC, updated_at DESC LIMIT 1",
      [institutionId],
    );
    let login = String(accountResult.rows[0]?.email || "");
    if (!login) {
      const numberPart = institutionId.replace(/^m-/, "");
      login = "muassasa-" + numberPart;
      const exists = await client.query("SELECT 1 FROM users WHERE email=$1 LIMIT 1", [login]);
      if (exists.rowCount) login = "muassasa-" + numberPart + "-" + Date.now().toString().slice(-4);
      if (!password) throw new AccessError("Bu muassasada login yo‘q. Yangi parol kiriting, login avtomatik yaratiladi.");
      await client.query(
        "INSERT INTO users (email, name, role, commission, active, password_hash, institution_id) VALUES ($1,$2,'institution','',$3,$4,$5)",
        [login, name, active, passwordHash(password), institutionId],
      );
    } else {
      await client.query("DELETE FROM sessions WHERE user_email=$1", [login]);
      if (password) {
        await client.query(
          "UPDATE users SET name=$2, active=$3, password_hash=$4, updated_at=NOW() WHERE email=$1",
          [login, name, active, passwordHash(password)],
        );
      } else {
        await client.query(
          "UPDATE users SET name=$2, active=$3, updated_at=NOW() WHERE email=$1",
          [login, name, active],
        );
      }
    }
    await client.query("COMMIT");
    return Response.json({ ok: true, login });
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    return accessErrorResponse(error);
  } finally {
    client.release();
  }
}
`;

const apiTarget = path.join(process.cwd(), 'app/api/admin/institutions/route.ts');
fs.mkdirSync(path.dirname(apiTarget), { recursive: true });
fs.writeFileSync(apiTarget, apiRoute, 'utf8');
console.log('Created app/api/admin/institutions/route.ts');

const component = String.raw`"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  id: string;
  name: string;
  district: string;
  type: string;
  active: boolean;
  login: string;
  accountActive: boolean;
};

type ApiData = { institutions: Row[]; nextId: string; nextLogin: string };

const fieldStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 38,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "8px 10px",
  background: "white",
  color: "#0f172a",
  fontSize: 13,
};

const buttonStyle: React.CSSProperties = {
  minHeight: 38,
  border: 0,
  borderRadius: 8,
  padding: "8px 14px",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
};

function generatePassword() {
  const bytes = new Uint32Array(2);
  window.crypto.getRandomValues(bytes);
  return "Kpi" + bytes[0].toString(36).slice(0, 5) + "-" + bytes[1].toString(36).slice(0, 5) + "!26";
}

export function AdminInstitutionManager({ onChanged }: { onChanged?: () => void }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [name, setName] = useState("");
  const [district, setDistrict] = useState("");
  const [type, setType] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/institutions", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Muassasalar yuklanmadi.");
      setData(payload);
      if (!editing) setLogin(payload.nextLogin || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Muassasalar yuklanmadi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data?.institutions || [];
    return (data?.institutions || []).filter((row) =>
      (row.name + " " + row.district + " " + row.type + " " + row.login).toLowerCase().includes(q),
    );
  }, [data, search]);

  function resetForm() {
    setEditing(null);
    setName("");
    setDistrict("");
    setType("");
    setLogin(data?.nextLogin || "");
    setPassword("");
    setActive(true);
    setMessage("");
    setError("");
  }

  function editRow(row: Row) {
    setEditing(row);
    setName(row.name);
    setDistrict(row.district);
    setType(row.type);
    setLogin(row.login || "");
    setPassword("");
    setActive(row.active && row.accountActive);
    setMessage("");
    setError("");
    window.setTimeout(() => document.getElementById("institution-account-form")?.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
  }

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const body = editing
        ? { institutionId: editing.id, name, district, type, password, active }
        : { name, district, type, login, password };
      const response = await fetch("/api/admin/institutions", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Saqlashda xatolik.");
      setMessage(editing ? "Muassasa ma’lumotlari saqlandi. Login: " + payload.login : "Muassasa va kabinet yaratildi. Login: " + payload.login);
      setEditing(null);
      setName("");
      setDistrict("");
      setType("");
      setPassword("");
      setActive(true);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlashda xatolik.");
    } finally {
      setSaving(false);
    }
  }

  return <div style={{ display: "grid", gap: 14, marginBottom: 20 }}>
    <div id="institution-account-form" style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 16, background: "#f8fafc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <div>
          <strong style={{ fontSize: 16, color: "#0f172a" }}>{editing ? "Muassasa kabinetini tahrirlash" : "Yangi muassasa + login/parol"}</strong>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{editing ? "Login saqlanadi. Yangi parol kiritsangiz eski parol almashtiriladi." : "Muassasa qo‘shilishi bilan unga alohida kabinet akkaunti ham yaratiladi."}</div>
        </div>
        {editing && <button type="button" style={{ ...buttonStyle, background: "#e2e8f0", color: "#0f172a" }} onClick={resetForm}>Bekor qilish</button>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Muassasa nomi<input style={fieldStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Muassasa to‘liq nomi" /></label>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Tuman / shahar<input style={fieldStyle} value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Buxoro shahar" /></label>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Muassasa turi<input style={fieldStyle} value={type} onChange={(e) => setType(e.target.value)} placeholder="Markaz / shifoxona / poliklinika" /></label>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Login<input style={{ ...fieldStyle, background: editing ? "#e2e8f0" : "white" }} value={login} onChange={(e) => setLogin(e.target.value)} disabled={Boolean(editing)} placeholder="muassasa-039" /></label>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>{editing ? "Yangi parol (ixtiyoriy)" : "Parol"}<div style={{ display: "flex", gap: 6 }}><input style={fieldStyle} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={editing ? "Bo‘sh qoldirilsa o‘zgarmaydi" : "Kamida 8 belgi"} /><button type="button" style={{ ...buttonStyle, whiteSpace: "nowrap", background: "#e2e8f0", color: "#0f172a" }} onClick={() => setPassword(generatePassword())}>Parol yaratish</button></div></label>
        {editing && <label style={{ display: "flex", gap: 8, alignItems: "center", alignSelf: "end", minHeight: 38, fontSize: 13, fontWeight: 700, color: "#334155" }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Kabinet faol</label>}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" disabled={saving} style={{ ...buttonStyle, background: saving ? "#94a3b8" : "#0f766e", color: "white" }} onClick={() => void save()}>{saving ? "Saqlanmoqda..." : editing ? "O‘zgarishlarni saqlash" : "Muassasa va login yaratish"}</button>
        {message && <span style={{ fontSize: 12, fontWeight: 700, color: "#047857" }}>{message}</span>}
        {error && <span style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c" }}>{error}</span>}
      </div>
    </div>

    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "white" }}>
      <div style={{ padding: 12, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid #e2e8f0" }}>
        <strong style={{ color: "#0f172a" }}>Muassasa kabinetlari {data ? "(" + data.institutions.length + ")" : ""}</strong>
        <input style={{ ...fieldStyle, maxWidth: 330 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nomi, tuman yoki login bo‘yicha qidirish" />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860, fontSize: 12 }}>
          <thead><tr style={{ background: "#f8fafc", textAlign: "left" }}><th style={{ padding: 10 }}>Muassasa</th><th style={{ padding: 10 }}>Tuman/shahar</th><th style={{ padding: 10 }}>Turi</th><th style={{ padding: 10 }}>Login</th><th style={{ padding: 10 }}>Holat</th><th style={{ padding: 10 }}></th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={6} style={{ padding: 18 }}>Yuklanmoqda...</td></tr> : filtered.length ? filtered.map((row) => <tr key={row.id} style={{ borderTop: "1px solid #e2e8f0" }}><td style={{ padding: 10, maxWidth: 360 }}><strong>{row.name}</strong><div style={{ color: "#94a3b8", marginTop: 2 }}>{row.id}</div></td><td style={{ padding: 10 }}>{row.district || "—"}</td><td style={{ padding: 10 }}>{row.type || "—"}</td><td style={{ padding: 10 }}><code style={{ fontWeight: 700 }}>{row.login || "Login yaratilmagan"}</code></td><td style={{ padding: 10 }}><span style={{ display: "inline-block", padding: "4px 8px", borderRadius: 999, fontWeight: 700, background: row.active && row.accountActive ? "#d1fae5" : "#fee2e2", color: row.active && row.accountActive ? "#065f46" : "#991b1b" }}>{row.active && row.accountActive ? "Faol" : "Nofaol"}</span></td><td style={{ padding: 10, textAlign: "right" }}><button type="button" style={{ ...buttonStyle, background: "#e0f2fe", color: "#075985" }} onClick={() => editRow(row)}>Tahrirlash / parol</button></td></tr>) : <tr><td colSpan={6} style={{ padding: 18 }}>Muassasa topilmadi.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  </div>;
}
`;

const componentTarget = path.join(process.cwd(), 'components/admin-institution-manager.tsx');
fs.mkdirSync(path.dirname(componentTarget), { recursive: true });
fs.writeFileSync(componentTarget, component, 'utf8');
console.log('Created components/admin-institution-manager.tsx');

patchFile('components/kpi-app.tsx', (text) => {
  if (text.includes('AdminInstitutionManager')) return text;
  if (text.includes('"use client";')) {
    text = text.replace('"use client";', '"use client";\n\nimport { AdminInstitutionManager } from "@/components/admin-institution-manager";');
  } else if (text.includes('"use client"')) {
    text = text.replace('"use client"', '"use client"\n\nimport { AdminInstitutionManager } from "@/components/admin-institution-manager";');
  } else {
    throw new Error('kpi-app use client anchor not found');
  }

  const anchor = '<TabsContent value="institutions" className="panel-content">';
  if (!text.includes(anchor)) throw new Error('institutions tab anchor not found');
  text = text.replace(anchor, anchor + '<AdminInstitutionManager onChanged={onRefresh} />');
  return text;
});

console.log('Admin institution/login/password manager patch applied.');
