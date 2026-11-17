/* Local fallback judge (Chinese only): concern rules + a character n-gram model, used when Claude cannot be reached.
   Works in the browser (window.LocalJudge) and in node (require), so eval/run.mjs can score labelled samples without an API key.
   The n-gram model lives in nbm.json and is loaded only when the fallback is actually needed. */
(function (root) {
"use strict";
const FN = ["Ti","Te","Fi","Fe","Si","Se","Ni","Ne"];
const isJ = f => f[0]==="T" || f[0]==="F";
const opp = f => ({T:"F",F:"T",S:"N",N:"S"})[f[0]] + (f[1]==="i"?"e":"i");
const stackOf = (d,a) => [d,a,opp(a),opp(d)];
const PAIRS = ["Ti-Ne","Ti-Se","Te-Ni","Te-Si","Fi-Ne","Fi-Se","Fe-Ni","Fe-Si","Ni-Fe","Ni-Te","Ne-Ti","Ne-Fi","Si-Te","Si-Fe","Se-Ti","Se-Fi"];
const charLen = t => t.replace(/\s/g,"").length;

/** "zh" when the text is mostly Chinese, otherwise "other" (the rules below only know Chinese wording) */
function detectLang(text){
  const cjk = (text.match(/[㐀-鿿]/g)||[]).length, words = (text.match(/[A-Za-z]+/g)||[]).length;
  return cjk >= 15 && cjk >= words ? "zh" : "other";
}
/* local judge v2 — concern rules + character-pattern model learned from labelled texts */
const LEX = {"Ti":["说得通","说不通","逻辑","矛盾","自相矛盾","哪里不对","出在哪","哪一步","为什么","到底","原因","站不住","漏洞","想不明白","想清楚","没想清楚","搞清楚","弄明白","推一下","推下去","推了一遍","推导","前提","本质","自洽","定义","解释","不成立","依据","判断","验证","变量","规律","假设","结论","拆开","拆成","拆给","分析","论证","信息量","动机","合理性","理智","无数次分析","弄明白一件事","想办法弄明白","思考"],"Fi":["值不值得","值得","应不应该","我不想","不想变成","真心","心里过不去","心里不舒服","不甘心","对不起","违背","配不配","意义","接受不了","原谅","委屈","底线","做自己","忠于","不认同","不认","不公平","这样不对","觉得对","我宁愿","真的喜欢","喜欢的","骗自己","说话算话","心动","心里很清楚，我喜欢","自己在意","难过","重要","我其实","其实我","我只是想","只是想和","真正想要","真正在意"],"Te":["怎么解决","有没有用","效率","浪费","结果","目标","计划","进度","方法有效","搞定","落实","损失","最快","有效","标准","安排","执行","时间表","时间节点","指标","节点","方案","数据","调研","成本","收益","优先级","算过账","清单","步骤","流程","检查","推进","布局","落地","按时","定下来","没用","有用","没多大","浪费时间","干不了","首先","其次","难度","百分百","能不能过","机票","房租","打工","省事","省心","行吧","算了一下","就这么定","定了","目标是"],"Fe":["会不会难过","别人怎么看","大家","气氛","尴尬","伤害","失望","失落","照顾","不好意思","怕他","怕她","生怕","体谅","面子","场面","冷场","得罪","难堪","安慰","招呼","心软","被冷落","团建","互相照应","一起吃饭","担心","我们的关系","关系变","陪他","陪她","陪陪","融不进","团圆","伤到","心疼他","心疼她","大家都开心","别人的感受","他的感受","她的感受"],"Ni":["注定","总有一天","早晚","迟早","未来","走向","预感","终究","意味着","结局","方向","早就知道","果然","将来","趋势","以后会","最后会","最后的结果","往哪走","年后","看得很清楚","很清楚地看到","早有征兆","直觉","隐约","指向","长期","愿景","前景","越来越清晰","会显现","一定会","想好了","决定了","已经决定","错误的路","走下去","硬走","一眼能看到头","看到头","路线","路径","到时候","下一步","长远","不重要","真正要","明年","十年后","没前景","根本"],"Ne":["还有一种可能","另一种可能","好几种可能","好多种可能","新的可能","换个角度","说不定","万一","假如","如果","也许","会不会","要是","突然想到","又想到","冒出","念头","点子","主意","好玩","有意思","脑子里","幻想","想象","切入角度","延伸","随机","要不","又或者","再不然","突然有个想法","越想越多","可能性","思考可能"],"Si":["那天","记得","第一次","当时","以前","回放","忘不掉","想起","小时候","那时候","曾经","每次","每年","往年","习惯","上次","惯例","规矩","老家","老房子","旧","外婆","爷爷","几十年","十年前","一直记着","还记得","从小","像以前","和以前一样","以前一样","回忆","记忆","往日","忘却","忘不了","无法忘","过去的"],"Se":["此刻","眼前","声音","味道","看到","听到","闻到","身体","手心","阳光","刚刚","当下","马上","温度","颜色","风","浪","海边","灯光","当场","现场","立刻","动手","试了一下","试着","亲手","趴到","拆开","骑","爽","打着火","化妆","唱歌","火锅","音乐一响","立马","摸了一下","看一眼","吹风","太香","刺激","手感","现场的情况"]};
const LOOP = {
  rum: /反复|无数个夜晚|无数次|直到天亮|停不下来|连续一周|一直在想|翻来覆去|睡不着|缠绕|走不出来|卡在/g,
  TiSi: {a:["分析","弄明白","想明白","合理性","可能性","逻辑","为什么"], b:["回忆","记忆","过去","以前","那天","细节","回放","曾经"]},
  NiTi: {a:["抽离","冷漠","不想感受","麻木","旁观"], b:["分析","逻辑","看透","本质"]},
  FiSi: {a:["心痛","难过","委屈","不甘","想你","心里"], b:["回忆","记得","那天","第一次","回放","以前"]}
};
const INFCUE = {
  Fe:["不善言辞","不善表达","不会表达","不能很好感受情感","感受不到","不知道怎么安慰","原谅我","对不起","感谢你","祝你"],
  Fi:["不知道自己想要什么","说不出自己的感受","突然很委屈","莫名其妙地难过"],
  Te:["拖延","效率很低","效率太低","做不了决定","没有执行力","突然变得特别较真","控制欲"],
  Ti:["钻牛角尖","非要弄明白谁对谁错","挑别人的逻辑漏洞"],
  Se:["生活自理能力差","不会照顾自己","忘了吃饭","暴饮暴食","冲动消费","找刺激"],
  Si:["存下来了","一直留到现在","留着","导过去","每换一台","我记得这个价格","犹豫了三天","舍不得删","一直保存","我没有再"],
  Ne:["最坏的情况","胡思乱想","往坏处想","万一出事"],
  Ni:["不祥的预感","总觉得要出事","一切都完了"]
};
const STRUCT = {
  Ne:[/就像|好像|像是|像个|像一|如同|仿佛|一般用于|相当于|一座[^，。]{1,8}的|[^，。]{1,6}的褶皱|当作[^，。]{1,6}的容器/g, /也许不全是|其实是|换句话说|说白了|反过来/g, /[一二三四五六七八九十\d]+年后|多年后|那年/g],
  Ti:[/当然，|不难，|麻烦的是|也许不全是|并不是因为|恰恰是/g, /全部相信[^。]*。[^。]*不信|不是[^，。]{1,10}，而是/g]
};
const NEG = /(不在乎|不管|无所谓|才不管)$/;
const STUCK = /[？?]|到底|该不该|要不要|是不是|会不会|不知道|想不通|没想清楚|还没想|卡在|放不下|一直在想|反复|犹豫|纠结|怎么办/;
const LEXALL = []; FN.forEach(f=>LEX[f].forEach(w=>LEXALL.push([w,f]))); LEXALL.sort((a,b)=>b[0].length-a[0].length);
const CONCERN_DESC = {Ti:"逻辑对不对、说不说得通",Fi:"价值对不对、自己能不能接受",Te:"效率行不行、事情能不能解决",Fe:"别人会不会难受、关系会不会变",
  Ni:"未来会怎样",Ne:"还有什么别的可能",Si:"过去那个细节忘不掉",Se:"当下的感受是什么"};
const UNFOLD_DESC = {Ne:"用发散的可能来展开",Se:"用当下的细节和动手试错来展开",Ni:"用一个锁定的未来方向来推进",Si:"用过去的经验和细节来展开",
  Ti:"用逻辑分析来过滤",Te:"用执行和效率来推进",Fi:"用自己的价值来筛选",Fe:"用照顾人和关系来推进"};
const JP = {stuck:1.6,first:1.3,last:1.5,cap:2,enumD:1,enumU:2,sm:0.5,beta:1,gamma:0.5,loopW:2,infW:2,pd:0.5,pthr:0.75,st:0.3,lenRef:400,covRef:0.5,lam:1.5,T:2};
function lexHits(s){const h={};FN.forEach(f=>h[f]=[]);let t=s;
  for(const [w,f] of LEXALL){let i;while((i=t.indexOf(w))>=0){if(!NEG.test(t.slice(Math.max(0,i-3),i)))h[f].push(w);t=t.slice(0,i)+"\u0000".repeat(w.length)+t.slice(i+w.length);}}
  return h;}
function lexFeatures(text){
  const sents=text.split(/(?<=[。！？!?；;\n])/).map(x=>x.trim()).filter(x=>x.length>1);
  const D={},U={},ex={};FN.forEach(f=>{D[f]=0;U[f]=0;ex[f]=[];});
  let best={w:-1,s:""};
  sents.forEach((s,i)=>{
    const h=lexHits(s),stuck=STUCK.test(s);
    let w=1; if(stuck)w*=JP.stuck; if(i===0)w*=JP.first; if(i===sents.length-1)w*=JP.last;
    let sw=0;
    FN.forEach(f=>{const n=h[f].length;if(!n)return;D[f]+=w*Math.min(n,JP.cap);U[f]+=n;sw+=w*n;h[f].forEach(x=>{if(!ex[f].includes(x))ex[f].push(x);});});
    const enumN=(s.match(/、/g)||[]).length+(s.match(/或者|还是|要不/g)||[]).length;
    if(enumN>=2){D.Ne+=w*JP.enumD;U.Ne+=JP.enumU;}
    if(stuck)sw*=1.3; if(sw>best.w)best={w:sw,s};
  });
  return {D,U,ex,core:best.s};
}
function nbGrams(t){const c=t.replace(/[\s，。！？、；：“”‘’（）,.!?;:"'()…—\-《》]/g,"|"),g=[];for(let n=1;n<=3;n++)for(let i=0;i+n<=c.length;i++){const s=c.slice(i,i+n);if(!s.includes("|"))g.push(s);}return g;}
function nbScore(M,gs){const o={};M.c.forEach(y=>o[y]=0);let n=0;gs.forEach(g=>{const w=M.W[g];if(!w)return;n++;M.c.forEach((y,i)=>o[y]+=w[i]);});M.c.forEach(y=>o[y]/=Math.max(1,n));return o;}
const zNorm=s=>{const v=Object.values(s),m=v.reduce((a,b)=>a+b,0)/v.length,sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length)||1;const o={};for(const k in s)o[k]=(s[k]-m)/sd;return o;};
function structCues(text){const o={};for(const k in STRUCT)o[k]=STRUCT[k].reduce((n,re)=>n+(text.match(re)||[]).length,0);return o;}
function literary(text){
  const len=text.replace(/\s/g,"").length, dlg=(text.match(/[她他]说[，：,]|我说[，：,]|“[^”]{1,40}”/g)||[]).length, third=(text.match(/[她他]/g)||[]).length;
  return len>700 && (dlg>=4 || third/len>0.02);
}
function loopInf(text){
  const cnt=list=>list.reduce((n,w)=>n+(text.split(w).length-1),0);
  const rum=(text.match(LOOP.rum)||[]).length, loop={};
  for(const k of ["TiSi","NiTi","FiSi"]){const a=cnt(LOOP[k].a),b=cnt(LOOP[k].b);loop[k]=rum>=2&&a>=2&&b>=2?Math.min(1,(rum+Math.min(a,b))/8):0;}
  /* your Q5 rule: remembering every 'first time' and detail of someone you love = Fi dominant with Si (Fi-Si) */
  { const firsts=(text.match(/第一次/g)||[]).length, love=cnt(["喜欢","爱","心里","想你","在意"]); loop.FiFirst=(firsts>=2&&love>=2)?Math.min(1,0.4+0.15*firsts):0; }
  const inf={};for(const k in INFCUE)inf[k]=Math.min(1,cnt(INFCUE[k])/4);
  return {loop,inf};
}
function localJudge(text, NBM){
  if(detectLang(text)!=="zh") return {unsupported:"lang"};   /* English and other languages: no fake result */
  const F=lexFeatures(text), {D,U}=F, P=JP, LI=loopInf(text);
  { const Ps=["Si","Se","Ni","Ne"], ut=FN.reduce((s,f)=>s+U[f],0)||1, ps=Ps.reduce((s,f)=>s+U[f],0)/ut; if(ps>P.pthr) Ps.forEach(f=>D[f]*=P.pd); }
  { const SC=structCues(text); D.Ne+=P.st*SC.Ne; U.Ne+=P.st*SC.Ne; D.Ti+=P.st*SC.Ti; U.Ti+=P.st*SC.Ti; }
  const loopB=(d,a)=>{const s=new Set([d,opp(a)]);let v=0;if(s.has("Ti")&&s.has("Si"))v+=LI.loop.TiSi;if(s.has("Ni")&&s.has("Ti"))v+=LI.loop.NiTi;if(s.has("Fi")&&s.has("Si"))v+=LI.loop.FiSi;if(d==="Fi")v+=1.5*(LI.loop.FiFirst||0);return v;};
  const Dt=FN.reduce((s,f)=>s+D[f],0)+FN.length*P.sm, Ut=FN.reduce((s,f)=>s+U[f],0)+P.sm*8;
  const R={};
  PAIRS.forEach(pr=>{const [d,a]=pr.split("-");const partners=FN.filter(x=>isJ(x)!==isJ(d)&&x[1]!==d[1]);
    const aS=(U[a]+P.sm)/(partners.reduce((s,x)=>s+U[x],0)+2*P.sm);
    R[pr]=P.loopW*loopB(d,a)+P.infW*(LI.inf[opp(d)]||0)+Math.log((D[d]+P.sm)/Dt)+P.beta*Math.log(aS)+P.gamma*Math.log((U[d]+U[a]+P.sm)/Ut);});
  /* the n-gram model is optional: without it (not loaded yet, or the download failed) only the concern rules are used */
  const N={}; let lam=0;
  if(NBM){
    const gs=nbGrams(text), nd=nbScore(NBM.d,gs), nj=nbScore(NBM.j,gs), np=nbScore(NBM.p,gs);
    PAIRS.forEach(pr=>{const [a,b]=pr.split("-");const J=isJ(a)?a:b,Pp=isJ(a)?b:a;N[pr]=(nd[a]||0)+(nj[J]||0)+(np[Pp]||0);});
    const len=charLen(text), cov=gs.length?gs.filter(g=>NBM.d.W[g]).length/gs.length:0;
    lam=P.lam*Math.min(1,P.lenRef/Math.max(len,1))**0.5*Math.min(1,cov/P.covRef);
  }
  const zr=zNorm(R), zn=NBM?zNorm(N):{}, S={}; PAIRS.forEach(p=>S[p]=zr[p]+lam*(zn[p]||0));
  const mx=Math.max(...Object.values(S)), scores={};
  PAIRS.forEach(p=>scores[p]=Math.round(90*Math.exp((S[p]-mx)/P.T))/10);
  const q=w=>"“"+w+"”";
  const top=PAIRS.slice().sort((x,y)=>scores[y]-scores[x]).map(p=>{
    const [d,a]=p.split("-"), other=FN.filter(x=>isJ(x)!==isJ(d)&&x[1]!==d[1]&&x!==a)[0];
    const lp=loopB(d,a)>0.3?`文字里有明显的 ${d}-${opp(a)} loop 痕迹（反复思考、停不下来），显眼的${opp(a)}是第三位，不是主导。`:"";
    const infc=(LI.inf[opp(d)]||0)>=0.5?`道歉、感谢、“不善表达”这类内容更像劣势 ${opp(d)} 的表现。`:"";
    return {pair:p,
      dominant: lp+infc+(F.ex[d].length ? `文字反复回到「${CONCERN_DESC[d]}」这个问题（如${F.ex[d].slice(0,2).map(q).join("、")}），整体写法也接近 ${d} 主导的文字，主导判为 ${d}。` : `整体的写法和措辞更接近 ${d} 主导的文字，主导判为 ${d}。`),
      auxiliary: F.ex[a].length ? `展开方式更像是${UNFOLD_DESC[a]}（如${F.ex[a].slice(0,2).map(q).join("、")}），${U[other]<U[a]?`多于${UNFOLD_DESC[other]}`:`和${UNFOLD_DESC[other]}都有`}，辅助判为 ${a}。` : `${d} 主导时辅助只能是 ${a} 或 ${other}，从整体写法看更接近 ${a}。`};
  });
  return {core:F.core, scores, top, literary:literary(text)};
}

const api = {localJudge, detectLang, literary};
if (typeof module !== "undefined" && module.exports) module.exports = api; else root.LocalJudge = api;
})(typeof self !== "undefined" ? self : globalThis);
