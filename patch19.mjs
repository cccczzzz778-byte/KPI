import fs from 'node:fs';
import path from 'node:path';

const evaluatorPath = path.join(process.cwd(), 'components/evaluator-reference-panel.tsx');
if (!fs.existsSync(evaluatorPath)) throw new Error('PATCH19: evaluator-reference-panel.tsx not found.');

let text = fs.readFileSync(evaluatorPath, 'utf8');
const oldBlock = `  useEffect(() => {
    const controller = new AbortController();
    fetch(\`/api/evaluator/archive?mode=counts&roundDay=\${encodeURIComponent(String(roundDay))}\`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json() as { counts?: Record<string, number> };
        if (!response.ok) throw new Error("Mezon fayllari sonini yuklab bo‘lmadi.");
        return payload.counts || {};
      })
      .then((counts) => { if (!controller.signal.aborted) setFileCounts(counts); })
      .catch(() => { if (!controller.signal.aborted) setFileCounts({}); });
    return () => controller.abort();
  }, [roundDay, session.commission]);`;

const uploadedCriterionOldBlock = oldBlock.replace(
  'Mezon fayllari sonini yuklab bo‘lmadi.',
  'Yuklangan mezonlar sonini yuklab bo‘lmadi.',
);

const newBlock = `  useEffect(() => {
    let active = true;

    const loadFileCounts = async () => {
      try {
        const response = await fetch(\`/api/evaluator/archive?mode=counts&roundDay=\${encodeURIComponent(String(roundDay))}&_ts=\${Date.now()}\`, {
          cache: "no-store",
        });
        const payload = await response.json() as { counts?: Record<string, number> };
        if (!response.ok) throw new Error("Yuklangan mezonlar sonini yuklab bo‘lmadi.");
        if (active) setFileCounts(payload.counts || {});
      } catch {
        // Old values are kept on a temporary network error so visible counts do not jump to zero.
      }
    };

    void loadFileCounts();
    const timer = window.setInterval(() => { void loadFileCounts(); }, 5000);
    const onFocus = () => { void loadFileCounts(); };
    const onVisibility = () => { if (document.visibilityState === "visible") void loadFileCounts(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [roundDay, session.commission]);`;

const matchedOldBlock = [oldBlock, uploadedCriterionOldBlock].find((block) => text.includes(block));
if (matchedOldBlock) {
  text = text.replace(matchedOldBlock, newBlock);
} else if (!text.includes('const loadFileCounts = async () =>')) {
  throw new Error('PATCH19: evaluator count effect not found.');
}

fs.writeFileSync(evaluatorPath, text, 'utf8');
console.log('PATCH19: evaluator uploaded-criterion counts refresh every 5 seconds and on focus.');
