# wordmbti

- `site/`：Netlify 网站（原样保留，部署方式不变，见 `site/README.md`）。
- 根目录：CrewAI 多智能体项目 `wordmbti_crew`，用于在 CrewAI 平台部署。

## CrewAI 多智能体：改进判断规则

三个智能体按顺序协作，目标是改进网站的判断规则（`site/netlify/lib/method.mjs` 里的 `METHOD`）：

1. **MBTI 文风研究员**：用 Claude 自带的网络搜索，查不同类型说话和写文章的特征，每条附来源。
2. **事实与逻辑审核员**：逐条审核，拒绝刻板印象、话题特征、来源不明和会让已确认例子判错的说法。
3. **判断规则修改工程师**：把通过审核的发现以最小改动写进 `METHOD`，输出修改清单和新全文。

输入（都可不填）：`focus`（研究重点，默认是最容易判错的几组），`max_searches`（搜索次数上限，默认 5，最多 10）。

输出只是**修改建议**，不会自动改代码。人工看过修改清单、确认合理后，再改进 `method.mjs`（同时同步 `src/wordmbti_crew/method.py`）并部署。

### 部署到 CrewAI
1. 在 CrewAI 的 Environment Variables 里填写 `ANTHROPIC_API_KEY`（可选 `MODEL`，默认 `anthropic/claude-haiku-5-5`）。
2. 在 Anthropic Console 的设置里确认已开启 Web search（网络搜索按次另外计费）。
3. 重新部署这个仓库。

### 本地运行
```bash
cp .env.example .env   # 填入 ANTHROPIC_API_KEY
uv sync
uv run run_crew
```
