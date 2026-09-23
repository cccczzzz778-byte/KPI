import fs from "node:fs";

function read(file) {
  if (!fs.existsSync(file)) throw new Error("PATCH63 missing " + file);
  return fs.readFileSync(file, "utf8");
}
function write(file, source) {
  fs.writeFileSync(file, source, "utf8");
  console.log("PATCH63: " + file);
}

const file = "components/institution-portal.tsx";
let s = read(file);

const oldBlock = [
  "  const currentSubmissions = useMemo(() => new Map(",
  "    (data?.submissions ?? [])",
  "      .filter((item) => item.submissionDate === data?.today)",
  "      .map((item) => [item.criterionId, item]),",
  "  ), [data]);",
].join("\n");

const newBlock = [
  "  const currentSubmissions = useMemo(() => {",
  "    const result = new Map<string, Submission>();",
  "    const items = (data?.submissions ?? []).filter((item) => item.submissionDate >= \"2026-09-14\");",
  "    const now = Date.now();",
  "",
  "    for (const criterion of criteria) {",
  "      const latest = items.find((item) => item.criterionId === criterion.id);",
  "      if (!latest) continue;",
  "",
  "      const deadline = String(criterion.deadline || \"\").toLocaleLowerCase(\"uz\");",
  "      const daily = deadline.includes(\"har kuni\")",
  "        || deadline.includes(\"doimiy\")",
  "        || deadline.includes(\"muntazam\")",
  "        || deadline.includes(\"1 kun\");",
  "",
  "      let locked = false;",
  "      if (daily) {",
  "        locked = latest.submissionDate === data?.today;",
  "      } else {",
  "        let intervalDays: number | null = null;",
  "        if (deadline.includes(\"1 hafta\") || deadline.includes(\"haftada 1 marta\")) intervalDays = 7;",
  "        else if (deadline.includes(\"10 kun\")) intervalDays = 10;",
  "        else if (deadline.includes(\"1 oy\") || deadline.includes(\"har oyda\")) intervalDays = 30;",
  "        else if (deadline.includes(\"60 kun\")) intervalDays = 60;",
  "        else if (deadline.includes(\"ikkinchi yarim yillik\")) intervalDays = 180;",
  "",
  "        if (intervalDays) {",
  "          const lastAt = new Date(latest.createdAt).getTime();",
  "          locked = Number.isFinite(lastAt) && now < lastAt + intervalDays * 24 * 60 * 60 * 1000;",
  "        } else {",
  "          locked = latest.submissionDate === data?.today;",
  "        }",
  "      }",
  "",
  "      if (locked) result.set(criterion.id, latest);",
  "    }",
  "    return result;",
  "  }, [data]);",
].join("\n");

if (s.includes(oldBlock)) {
  s = s.replace(oldBlock, newBlock);
} else if (!s.includes('const items = (data?.submissions ?? []).filter((item) => item.submissionDate >= "2026-09-14");')) {
  throw new Error("PATCH63 currentSubmissions anchor missing");
}

s = s.replace(
  'if (currentSubmissions.has(criterionId)) { toast.error("Bu mezon uchun bugungi fayl yuklangan. Ertaga yana 1 marta yuklash mumkin."); return; }',
  'if (currentSubmissions.has(criterionId)) { toast.error("Bu mezon uchun joriy davr fayli allaqachon yuklangan. Keyingi ijro muddati kelganda qayta yuklash mumkin."); return; }',
);

s = s.replaceAll("<strong>Bugun yuklangan</strong>", "<strong>Joriy davr fayli yuklangan</strong>");
s = s.replaceAll(" · Ertaga yana yuklash mumkin", " · Keyingi ijro muddati kelganda qayta yuklash mumkin");
s = s.replaceAll("Bugungi faylni yuklash", "Faylni yuklash");
s = s.replaceAll("Mezon fayllari faqat 08:00–18:00 oralig‘ida yuklanadi.", "Mezon fayllari faqat 08:00–19:00 oralig‘ida yuklanadi.");

write(file, s);

console.log("PATCH63: institution UI now mirrors daily/weekly/monthly/10/60/180-day recurrence.");
console.log("PATCH63: daily files reopen on the next Tashkent date; weekly after 7 days; monthly after 30 days.");
console.log("PATCH63: old pre-2026-09-14 evidence is archive-only for recurrence; upload window remains 08:00-19:00.");
