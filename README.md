# wordmbti

- `site/`：Netlify 网站（原样保留，部署方式不变，见 `site/README.md`）。
- 根目录：CrewAI 多智能体项目 `wordmbti_crew`，用于在 CrewAI 平台部署。

## CrewAI 多智能体

四个智能体按顺序协作，判断规则沿用网站的 `method.mjs`：

1. **主导功能分析师**：看文字在纠结什么核心问题，判断主导功能。
2. **写法与劣势分析师**：看写法判断辅助功能，并找出 loop 和劣势线索。
3. **首席判读官**：综合两人意见，给 16 组打分，选出前 4 名（结构化 JSON）。
4. **验证题设计师**：针对前几名候选，出几道能把它们分开的选择题。

输入：`text`（要分析的文字，必填）、`num_questions`（验证题数，默认 3）。

### 部署到 CrewAI
1. 在 CrewAI 的 Environment Variables 里填写 `ANTHROPIC_API_KEY`（可选 `MODEL`，默认 `anthropic/claude-haiku-5-5`）。
2. 重新部署这个仓库。

### 本地运行
```bash
cp .env.example .env   # 填入 ANTHROPIC_API_KEY
uv sync
uv run run_crew
```
