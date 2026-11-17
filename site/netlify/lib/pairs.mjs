// The 16 dominant–auxiliary pairs and their facts. No imports, so the eval scripts can use it without the SDK.
export const PAIRS = ["Ti-Ne","Ti-Se","Te-Ni","Te-Si","Fi-Ne","Fi-Se","Fe-Ni","Fe-Si","Ni-Fe","Ni-Te","Ne-Ti","Ne-Fi","Si-Te","Si-Fe","Se-Ti","Se-Fi"];
export const SIGS = {
  "Ti-Ne":"先验逻辑，再发散找可能","Ti-Se":"先验逻辑，再动手试",
  "Te-Ni":"先定效率目标，再锁定一个未来","Te-Si":"先定效率目标，再按过去经验执行",
  "Fi-Ne":"先定价值，再发散幻想","Fi-Se":"先定价值，再靠当下体验",
  "Fe-Ni":"先照顾氛围，再锁定一个未来","Fe-Si":"先照顾氛围，再按过去习惯照顾",
  "Ni-Fe":"先锁定未来，再用温度和关系去推进","Ni-Te":"先锁定未来，再用执行去推进",
  "Ne-Ti":"先发散可能，再用逻辑过滤","Ne-Fi":"先发散可能，再用价值筛选",
  "Si-Te":"先回放过去细节，再按标准执行","Si-Fe":"先回放过去细节，再照顾人",
  "Se-Ti":"先抓当下，再用逻辑分析","Se-Fi":"先抓当下，再用价值判断"
};

const OPP = { T: "F", F: "T", S: "N", N: "S" };
export const opp = f => OPP[f[0]] + (f[1] === "i" ? "e" : "i");
/** dominant, auxiliary, tertiary, inferior for a pair such as "Ti-Ne" */
export const stackOf = pair => { const [d, a] = pair.split("-"); return [d, a, opp(a), opp(d)]; };

const isJudging = f => f[0] === "T" || f[0] === "F";
/** the four-letter type of a pair: E/I from the dominant's attitude, J/P from whether the extraverted function judges */
export function codeOf(pair) {
  const [d, a] = pair.split("-");
  const per = isJudging(d) ? a : d, jud = isJudging(d) ? d : a, ext = d[1] === "e" ? d : a;
  return (d[1] === "e" ? "E" : "I") + per[0] + jud[0] + (isJudging(ext) ? "J" : "P");
}
export const CODE = Object.fromEntries(PAIRS.map(p => [p, codeOf(p)]));
export const PAIR_OF = Object.fromEntries(PAIRS.map(p => [CODE[p], p]));
