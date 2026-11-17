// Netlify Function: reads one user text, asks Claude for a four-dimension reading and scores for the 16 dominant–auxiliary pairs.
// Each text is read twice and averaged (see lib/judge.mjs). The API key comes from the ANTHROPIC_API_KEY environment variable set in Netlify (never in code).
// Response: { dims, core, scores, top, runs } — the page only needs core, scores and top; dims and runs are extra.
import { MAX_CHARS, json, guard, withCors, apiError } from "../lib/method.mjs";
import { judgeText } from "../lib/judge.mjs";

export const config = { path: "/api/judge" };

export default withCors(async (req) => {
  const blocked = guard(req); if (blocked) return blocked;
  let text;
  try { text = String((await req.json()).text ?? "").trim(); } catch { return json(400, { error: "bad_request" }); }
  if (!text) return json(400, { error: "empty_text" });
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);

  try {
    return json(200, await judgeText(text));
  } catch (err) {
    if (err?.code === "refused") return json(422, { error: "refused" });
    if (err?.code === "no_output") return json(502, { error: "no_output" });
    return apiError(err);
  }
});
