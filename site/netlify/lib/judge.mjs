// Reads one text with Claude: four dimensions first (evidence), then the 16 pairs. Shared by /api/judge and eval/run.mjs.
// One read of a text is noisy (the same text flipped #1 in 2 of 8 repeats in testing), so every text is read RUNS times in
// parallel and the scores are averaged: a short text is read twice in full, a long text is cut into two parts at a sentence
// boundary and each part is read once (about the same cost as one full read, and no slower).
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MODEL, MAX_CHARS, PAIRS, METHOD, client } from "./method.mjs";

export const RUNS = Math.max(1, Math.min(3, Number(process.env.JUDGE_RUNS) || 2));
export const SPLIT_AT = 1500;     // texts longer than this many characters (spaces excluded) are split instead of read twice
const MIN_PART = 400;             // never cut a part shorter than this

const FORMAT_NOTE = "只回复一个 JSON 对象，不要其他文字，格式：\n" +
  "{\"dims\":{\"EI\":{\"lean\":\"E 或 I\",\"strength\":0到10,\"evidence\":\"一句话证据\"},\"SN\":{\"lean\":\"S 或 N\",...},\"TF\":{\"lean\":\"T 或 F\",...},\"JP\":{\"lean\":\"J 或 P\",...}}," +
  "\"core\":\"一句话：这段文字最关心的核心问题\",\"scores\":{\"Ti-Ne\":7,\"Ti-Se\":3, ...16 组全部给分}," +
  "\"top\":[{\"pair\":\"Ti-Ne\",\"dominant\":\"一句话：主导是什么，依据是什么\",\"auxiliary\":\"一句话：辅助是怎么配合主导展开的\"}]}\n" +
  "先写 dims（四个维度都要写，证据要引用文字里的具体写法），再写 core 和 scores，scores 要和 dims 的结论一致。top 给分数最高的 4 组，从高到低。所有说明用中文。";

const dim = (a, b) => z.object({ lean: z.enum([a, b]), strength: z.number(), evidence: z.string() });
export const Judgement = z.object({
  dims: z.object({ EI: dim("E", "I"), SN: dim("S", "N"), TF: dim("T", "F"), JP: dim("J", "P") }),
  core: z.string(),
  scores: z.object(Object.fromEntries(PAIRS.map(p => [p, z.number()]))),
  top: z.array(z.object({ pair: z.enum(PAIRS), dominant: z.string(), auxiliary: z.string() })),
});

const fail = code => Object.assign(new Error(code), { code });
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const round1 = x => Math.round(x * 10) / 10;
const size = t => t.replace(/\s/g, "").length;

/** one Claude read of one text (or one part of a long text) */
export async function judgeOnce(text, part) {
  const note = part ? `（这是一篇长文的第 ${part.i} 部分，共 ${part.of} 部分，只根据这一部分打分。）\n\n` : "";
  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: [{ type: "text", text: METHOD, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `<文字>\n${text}\n</文字>\n\n${note}${FORMAT_NOTE}` }],
    output_config: { effort: "low", format: zodOutputFormat(Judgement) },
  });
  if (response.stop_reason === "refusal") throw fail("refused");
  if (!response.parsed_output) throw fail("no_output");
  return response.parsed_output;
}

/** cut a long text into `parts` pieces of similar length at sentence ends; returns [text] when it cannot be cut sensibly */
export function splitText(text, parts) {
  const sentences = text.split(/(?<=[。！？!?；;\n]|[.!?]\s)/).filter(s => s.length);
  const total = size(text);
  if (parts < 2 || total < parts * MIN_PART || sentences.length < parts) return [text];
  const out = []; let cur = "", curSize = 0;
  for (const s of sentences) {
    cur += s; curSize += size(s);
    if (out.length < parts - 1 && curSize >= total / parts) { out.push(cur); cur = ""; curSize = 0; }
  }
  if (cur.trim()) out.push(cur);
  return out.length === parts && out.every(p => size(p) >= MIN_PART / 2) ? out : [text];
}

/** average several reads into one judgement with the same shape as a single read */
export function mergeJudgements(list) {
  const n = list.length;
  const scores = {};
  for (const p of PAIRS) scores[p] = round1(clamp(list.reduce((s, j) => s + clamp(j.scores[p], 0, 10), 0) / n, 0, 10));

  // for each pair in the merged top 4, keep the wording from the read that liked it most
  const order = PAIRS.slice().sort((a, b) => scores[b] - scores[a]);
  const top = order.slice(0, 4).map(pair => {
    const withText = list.filter(j => j.top.some(t => t.pair === pair)).sort((a, b) => b.scores[pair] - a.scores[pair]);
    const t = withText[0]?.top.find(x => x.pair === pair);
    return { pair, dominant: t?.dominant ?? "", auxiliary: t?.auxiliary ?? "" };
  });

  // dimensions: signed average (first letter positive), evidence from the read that agrees with the result and is strongest
  const dims = {};
  for (const k of ["EI", "SN", "TF", "JP"]) {
    const signed = j => (j.dims[k].lean === k[0] ? 1 : -1) * clamp(j.dims[k].strength, 0, 10);
    const mean = list.reduce((s, j) => s + signed(j), 0) / n;
    const lean = mean >= 0 ? k[0] : k[1];
    const best = list.filter(j => j.dims[k].lean === lean).sort((a, b) => b.dims[k].strength - a.dims[k].strength)[0] ?? list[0];
    dims[k] = { lean, strength: round1(Math.abs(mean)), evidence: best.dims[k].evidence };
  }
  const core = list.slice().sort((a, b) => Math.max(...Object.values(b.scores)) - Math.max(...Object.values(a.scores)))[0].core;
  return { dims, core, scores, top, runs: n };
}

/** the full judgement of a text: RUNS parallel reads, averaged; fails only when every read fails */
export async function judgeText(text, { runs = RUNS } = {}) {
  text = String(text ?? "").trim().slice(0, MAX_CHARS);
  const parts = runs > 1 && size(text) > SPLIT_AT ? splitText(text, runs) : null;
  const jobs = parts && parts.length > 1
    ? parts.map((t, i) => judgeOnce(t, { i: i + 1, of: parts.length }))
    : Array.from({ length: runs }, () => judgeOnce(text));
  const settled = await Promise.allSettled(jobs);
  const ok = settled.filter(r => r.status === "fulfilled").map(r => r.value);
  if (!ok.length) throw settled[0].reason;
  return mergeJudgements(ok);
}
