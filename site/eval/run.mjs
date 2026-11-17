// Scores labelled samples with the local fallback rules (no API key needed) and, optionally, with Claude.
//   node eval/run.mjs --samples eval/data/en.jsonl [--mode local|claude|both] [--limit N] [--out results.json]
//                     [--local-module path/to/module.cjs] [--concurrency 3]
// Samples are JSON lines: {"id","type","text", "lang"?, "trust"?}. See eval/README.md.
// --mode claude / both needs ANTHROPIC_API_KEY and `npm install` in site/ (it runs the same code as /api/judge).
// --local-module lets you compare another version of the local rules: a CommonJS file exporting judge(text) -> {scores} | {unsupported}.
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PAIRS, CODE } from "../netlify/lib/pairs.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => x.startsWith("--") ? [...a, [x.slice(2), all[i + 1]]] : a, []));
if (!args.samples) { console.error("usage: node eval/run.mjs --samples file.jsonl [--mode local|claude|both] [--limit N] [--out file.json]"); process.exit(2); }
const mode = args.mode ?? "local";
let samples = fs.readFileSync(args.samples, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
if (args.limit) samples = samples.slice(0, +args.limit);
for (const s of samples) if (!PAIRS.some(p => CODE[p] === s.type)) throw new Error(`sample ${s.id}: unknown type ${s.type}`);

/* ---- judges: each returns {scores} or {unsupported} ---- */
function localJudge() {
  if (args["local-module"]) return createRequire(import.meta.url)(path.resolve(args["local-module"])).judge;
  const pub = path.join(here, "../public"), ctx = {}; ctx.self = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(pub, "local-judge.js"), "utf8"), ctx);
  const nbm = JSON.parse(fs.readFileSync(path.join(pub, "nbm.json"), "utf8"));
  return text => ctx.LocalJudge.localJudge(text, nbm);
}
async function claudeJudge() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set; use --mode local");
  const { judgeText } = await import(pathToFileURL(path.join(here, "../netlify/lib/judge.mjs")).href);
  return async text => { const r = await judgeText(text); return { scores: r.scores, dims: r.dims }; };
}

async function runAll(judge, concurrency = 1) {
  const out = new Array(samples.length); let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < samples.length) {
      const i = next++;
      try { out[i] = await judge(samples[i].text); } catch (e) { out[i] = { error: String(e?.message ?? e) }; }
    }
  }));
  return out;
}

/* ---- metrics ---- */
const LETTERS = ["E", "I", "S", "N", "T", "F", "J", "P"], DIMS = [[0, "E/I"], [1, "S/N"], [2, "T/F"], [3, "J/P"]];
const rank = scores => PAIRS.slice().sort((a, b) => scores[b] - scores[a]).map(p => CODE[p]);
const wilson = (k, n) => { if (!n) return [0, 0]; const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - m) / d, (c + m) / d]; };
const pct = (k, n) => n ? `${(100 * k / n).toFixed(1)}%` : "n/a";
const ci = (k, n) => { const [a, b] = wilson(k, n); return `${(100 * a).toFixed(0)}–${(100 * b).toFixed(0)}%`; };

function metrics(results) {
  const m = { n: samples.length, answered: 0, abstained: 0, errors: 0, top1: 0, top3: 0, dim: [0, 0, 0, 0], letter: Object.fromEntries(LETTERS.map(l => [l, { n: 0, ok: 0 }])), predicted: {}, truthDist: {} };
  samples.forEach((s, i) => {
    m.truthDist[s.type] = (m.truthDist[s.type] ?? 0) + 1;
    const r = results[i];
    if (r.error) { m.errors++; return; }
    if (r.unsupported || !r.scores) { m.abstained++; return; }
    m.answered++;
    const rk = rank(r.scores), t1 = rk[0];
    m.predicted[t1] = (m.predicted[t1] ?? 0) + 1;
    if (t1 === s.type) m.top1++;
    if (rk.slice(0, 3).includes(s.type)) m.top3++;
    DIMS.forEach(([k]) => { if (t1[k] === s.type[k]) m.dim[k]++; });
    for (let k = 0; k < 4; k++) { const L = m.letter[s.type[k]]; L.n++; if (t1[k] === s.type[k]) L.ok++; }
  });
  return m;
}

function report(name, m) {
  const out = [];
  out.push(`\n=== ${name} ===`);
  out.push(`samples ${m.n}; answered ${m.answered}; abstained (no result given) ${m.abstained}; errors ${m.errors}`);
  out.push(`4-letter, #1 right : ${m.top1}/${m.answered} answered = ${pct(m.top1, m.answered)} (95% CI ${ci(m.top1, m.answered)})  | counting abstentions as wrong: ${pct(m.top1, m.n)}   [chance 6.25%]`);
  out.push(`right type in top 3: ${m.top3}/${m.answered} = ${pct(m.top3, m.answered)} (95% CI ${ci(m.top3, m.answered)})   [chance 18.75%]`);
  out.push("per dimension (#1): " + DIMS.map(([k, n]) => `${n} ${pct(m.dim[k], m.answered)}`).join("   ") + "   [chance 50%]");
  out.push("accuracy by true letter (#1): " + LETTERS.map(l => `${l} ${pct(m.letter[l].ok, m.letter[l].n)} (n=${m.letter[l].n})`).join("  "));
  const pj = (m.predicted ? Object.entries(m.predicted) : []).reduce((a, [t, c]) => { for (const l of t) a[l] = (a[l] ?? 0) + c; return a; }, {});
  const tj = Object.entries(m.truthDist).reduce((a, [t, c]) => { for (const l of t) a[l] = (a[l] ?? 0) + c; return a; }, {});
  out.push("predicted vs true letter counts: " + LETTERS.map(l => `${l} ${pj[l] ?? 0}/${tj[l] ?? 0}`).join("  "));
  out.push("predicted type distribution: " + (Object.entries(m.predicted).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t}:${c}`).join(" ") || "(none)"));
  console.log(out.join("\n"));
}

process.on("uncaughtException", e => { console.error("error:", e.message); process.exit(2); });
const report_ = {};
if (mode === "local" || mode === "both") { const r = await runAll(localJudge()); report_.local = { metrics: metrics(r), results: r }; report("local rules", report_.local.metrics); }
if (mode === "claude" || mode === "both") { const r = await runAll(await claudeJudge(), +(args.concurrency ?? 3)); report_.claude = { metrics: metrics(r), results: r }; report("Claude (netlify/lib/judge.mjs)", report_.claude.metrics); }
if (args.out) { fs.writeFileSync(args.out, JSON.stringify({ samples: samples.map(({ id, type, lang }) => ({ id, type, lang })), ...report_ }, null, 1)); console.log("\nwrote", args.out); }
