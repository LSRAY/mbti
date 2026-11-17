// Netlify Function: reads one user text, asks Claude to score the 16 dominant–auxiliary pairs.
// The API key comes from the ANTHROPIC_API_KEY environment variable set in Netlify (never in code).
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MODEL, MAX_CHARS, PAIRS, METHOD, json, guard, withCors, client, apiError } from "../lib/method.mjs";

export const config = { path: "/api/judge" };

const FORMAT_NOTE = "只回复一个 JSON 对象，不要其他文字，格式：\n{\"core\":\"一句话：这段文字在纠结什么核心问题\",\"scores\":{\"Ti-Ne\":7,\"Ti-Se\":3, ...16 组全部给分},\"top\":[{\"pair\":\"Ti-Ne\",\"dominant\":\"一句话：主导是什么，依据是什么\",\"auxiliary\":\"一句话：辅助是怎么配合主导展开的\"}]}\ntop 给分数最高的 4 组，从高到低。所有说明用中文。";

const Judgement = z.object({
  core: z.string(),
  scores: z.object(Object.fromEntries(PAIRS.map(p => [p, z.number()]))),
  top: z.array(z.object({ pair: z.enum(PAIRS), dominant: z.string(), auxiliary: z.string() })),
});

export default withCors(async (req) => {
  const blocked = guard(req); if (blocked) return blocked;
  let text;
  try { text = String((await req.json()).text ?? "").trim(); } catch { return json(400, { error: "bad_request" }); }
  if (!text) return json(400, { error: "empty_text" });
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);

  try {
    const response = await client().messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: METHOD,
      messages: [{ role: "user", content: `<文字>\n${text}\n</文字>\n\n${FORMAT_NOTE}` }],
      output_config: { effort: "low", format: zodOutputFormat(Judgement) },
    });
    if (response.stop_reason === "refusal") return json(422, { error: "refused" });
    if (!response.parsed_output) return json(502, { error: "no_output" });
    return json(200, response.parsed_output);
  } catch (err) { return apiError(err); }
});
