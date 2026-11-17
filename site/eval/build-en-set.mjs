// Builds an English evaluation set (JSONL) from the public Kaggle MBTI dataset mirror.
//   node eval/build-en-set.mjs [--csv path/to/transformed_dataset.csv] [--per-type 10] [--chars 1200] [--seed 1] [--out eval/data/en.jsonl]
// Without --csv the mirror is downloaded from Hugging Face into a temp directory (about 100 MB).
// The file is not committed (eval/data/ is git-ignored). Labels are the forum users' own claims, so they are noisy.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => x.startsWith("--") ? [...a, [x.slice(2), all[i + 1]]] : a, []));
const PER_TYPE = +(args["per-type"] ?? 10), CHARS = +(args.chars ?? 1200), SEED = +(args.seed ?? 1);
const OUT = args.out ?? "eval/data/en.jsonl";
const URL_ = "https://huggingface.co/datasets/gmnsong/MBTI.csv/resolve/main/transformed_dataset.csv";

let csvPath = args.csv;
if (!csvPath) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mbti-en-"));
  csvPath = path.join(dir, "transformed_dataset.csv");
  console.error("downloading", URL_);
  const r = await fetch(URL_);
  if (!r.ok) throw new Error("download failed: " + r.status);
  fs.writeFileSync(csvPath, Buffer.from(await r.arrayBuffer()));
}

/** minimal CSV reader: quoted fields may contain commas, doubled quotes and newlines */
function* rows(s) {
  let f = "", row = [], q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); f = ""; yield row; row = []; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); yield row; }
}

// seeded RNG so the set is reproducible
let st = SEED >>> 0;
const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const TYPES = "INTJ INTP ENTJ ENTP INFJ INFP ENFJ ENFP ISTJ ISFJ ESTJ ESFJ ISTP ISFP ESTP ESFP".split(" ");
// remove label leakage: type codes (with plurals / suffixes), function abbreviations, MBTI vocabulary, urls
const LEAK = [
  new RegExp(`\\b(${TYPES.join("|")})(s|'s|-ish|-like)?\\b`, "gi"),
  /\b(Ni|Ne|Si|Se|Ti|Te|Fi|Fe)\b/g,
  /\b(MBTI|Myers[- ]Briggs|Keirsey|Socionics|enneagram|cognitive functions?|sx\/so|sp\/sx|so\/sp)\b/gi,
  /https?:\/\/\S+/g,
];
const clean = p => LEAK.reduce((t, re) => t.replace(re, " "), p).replace(/\s+/g, " ").trim();

const byType = Object.fromEntries(TYPES.map(t => [t, []]));
let header = true;
for (const r of rows(fs.readFileSync(csvPath, "utf8"))) {
  if (header) { header = false; continue; }
  if (byType[r[0]]) byType[r[0]].push(r[1]);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const out = [];
for (const t of TYPES) {
  const users = shuffle(byType[t].slice()).slice(0, PER_TYPE);
  users.forEach((posts, i) => {
    const ps = shuffle(posts.split("|||").map(clean).filter(p => p.length > 25));
    let text = "";
    for (const p of ps) { if (text.length >= CHARS) break; text += (text ? " " : "") + p; }
    out.push({ id: `EN-${t}-${i + 1}`, type: t, lang: "en", source: "kaggle-mbti (self-reported on a forum)", trust: "self-report", text: text.slice(0, CHARS + 200) });
  });
}
fs.writeFileSync(OUT, out.map(o => JSON.stringify(o)).join("\n") + "\n");
console.error(`wrote ${out.length} samples to ${OUT} (users per type available: ${TYPES.map(t => t + "=" + byType[t].length).join(" ")})`);
