# 推断你的MBTI人格 · Netlify 部署包（Claude Haiku 5.5）

## 文件
- `public/index.html`：网页。提交文字后调用 `/api/judge`，失败时自动改用浏览器内的本地规则。
- `netlify/functions/judge.mjs`：服务器函数。收到文字后调用 Claude Haiku 5.5，返回 16 组打分和理由。
- `netlify.toml`、`package.json`：Netlify 配置和依赖。

## 部署步骤
1. 在 https://console.anthropic.com 创建 API key，并在 Console 里设置每月消费上限。
2. 在 Netlify 打开你的站点 → Site configuration → Environment variables，新增：
   - Key：`ANTHROPIC_API_KEY`
   - Value：你的 API key
3. 在电脑上安装 Node.js，然后在本文件夹里运行：

```bash
npm install
```

```bash
npx netlify-cli login
```

```bash
npx netlify-cli link
```

```bash
npx netlify-cli deploy --prod
```

`link` 时选择已有的站点（wordmbti）。带服务器函数的站点要用命令行或 Git 仓库部署；只拖拽上传 `index.html` 不会部署函数，网页会一直使用本地规则。

## 部署后检查
打开网站，写一段文字并提交。文字初判页显示“Claude 整体判读”就说明接通了；显示“本地规则判断”说明函数没接通，先检查环境变量和部署日志。

## 可调的设置（`netlify/functions/judge.mjs`）
- `MODEL`：换模型，例如 `claude-sonnet-5-5`。
- `MAX_CHARS`：单次文字长度上限，用来限制成本。
- `effort: "low"`：思考深度。改成 `"medium"` 更仔细，但更慢、更贵。
