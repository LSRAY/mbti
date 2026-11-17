# 评估脚本

用带类型标签的文字样本，衡量判读的准确率和偏差。没有 API key 也能跑本地规则；设置了 `ANTHROPIC_API_KEY`（并在 `site/` 里 `npm install` 过）才能跑 Claude。

## 样本文件格式

JSON Lines，一行一个样本（不要把样本原文提交进仓库；`eval/data/` 已在 `.gitignore` 里）：

```json
{"id": "ZH-INTJ-1", "type": "INTJ", "text": "……文字原文……", "lang": "zh", "trust": "中高", "source": "https://…"}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 编号 |
| `type` | 是 | 作者自报的 4 字母类型，大写，16 型之一 |
| `text` | 是 | 文字原文。**先删掉所有类型代码、功能缩写（Ni、Fe 等）和 MBTI 字样**，否则会泄露答案 |
| `lang`、`trust`、`source` | 否 | 只记录，不参与计算 |

## 脚本

```bash
# 1. 构造英文评估集：下载 Kaggle MBTI 数据集的公开镜像（约 100 MB），每型随机抽 N 个人
node eval/build-en-set.mjs --per-type 12 --out eval/data/en.jsonl
#    已有 CSV 时：--csv /path/to/transformed_dataset.csv ；--chars 控制每条长度，--seed 控制抽样

# 2. 本地规则（不需要 API key）
node eval/run.mjs --samples eval/data/en.jsonl --mode local

# 3. Claude 判读（需要 ANTHROPIC_API_KEY；每条样本调用 2 次 Claude，和线上完全同一段代码）
ANTHROPIC_API_KEY=... node eval/run.mjs --samples eval/data/zh.jsonl --mode claude --limit 20 --concurrency 3

# 4. 比较另一版本的本地规则：模块是 CommonJS，导出 judge(text) -> {scores} 或 {unsupported}
node eval/run.mjs --samples eval/data/en.jsonl --local-module /path/to/old.cjs

# 5. 改完 netlify/lib/method.mjs 里的 METHOD 后，同步到 Python 智能体
node eval/sync-method.mjs          # --check 只检查不改
```

`run.mjs` 输出：4 字母第一名命中率（含 95% 置信区间）、正确类型进前三的比例、E/I、S/N、T/F、J/P 四个维度各自的准确率、按真实字母分的准确率（看 J 是不是被判成 P）、预测的字母和类型分布（看是否只集中在几型）。本地规则对非中文文字会“拒绝作答”，统计里单独列为 abstained，不会当作答对。`--out file.json` 保存每条样本的原始分数。

## 注意

- 标签是网友自报的，本身有噪声，数字只适合做**前后对比**，不要当作“真实准确率”。
- 英文集来自论坛帖子，和网站要的“即兴写一段最近反复想起的事”体裁不同。
- 本地规则只支持中文，英文集主要用来确认它不再输出固定结果；评估中文要自备中文样本。
- 样本少时置信区间很宽（几十条样本差几个百分点没有意义），每次改提示词都用同一批样本、看准确率和预测分布是否均衡。
