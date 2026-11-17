# 推断你的MBTI人格 · Netlify 部署包（Claude Haiku 5.5）

## 文件
- `public/index.html`：网页。提交文字后调用 `/api/judge`，失败时自动改用浏览器内的本地规则。
- `netlify/functions/judge.mjs`：服务器函数。收到文字后调用 Claude Haiku 5.5，返回 16 组打分和理由。
- `netlify/functions/ask.mjs`：服务器函数（`/api/ask`）。文字初判之后，每一题都由 Claude 根据文字、候选组合和已答的题现场出题，并给出每个选项对各候选的加减分。连不上、超时或用户点“不等了”时，网页自动改用固定题库。
- `netlify/lib/method.mjs`：两个函数共用的判断规则、16 组签名和错误处理。
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

## 可调的设置（`netlify/lib/method.mjs`、`netlify/functions/ask.mjs`）
- `MODEL`：换模型，例如 `claude-sonnet-5-5`。
- `MAX_CHARS`：单次文字长度上限，用来限制成本。
- `ASK_RULES`（`ask.mjs`）：Claude 出题的规则。出的题分不开第 1、2 名时会自动重试一次（`MIN_TOP2_GAP`）。
- 题数：`index.html` 里的 `MIN_Q`、`MAX_Q`（默认至少 3 题、最多 7 题，最后再加一道固定的劣势验证题）。
- `effort: "low"`：思考深度。改成 `"medium"` 更仔细，但更慢、更贵。

## GitHub Pages 版本
网页同时发布在 GitHub Pages：https://lsray.github.io/mbti/
- `.github/workflows/pages.yml`：每次 `main` 里的 `site/public` 有改动，就自动把它发布到 GitHub Pages。
- GitHub Pages 只能放静态网页，所以 不在 Netlify 上打开的网页（GitHub Pages、以后的自定义域名）都会调用 Netlify 上的 `/api/judge` 和 `/api/ask`（见 `index.html` 里的 `API_BASE`），API key 仍然只放在 Netlify。
- 函数只接受本站网页和 `https://lsray.github.io` 的请求（`netlify/lib/method.mjs` 里的 `ALLOWED_ORIGINS`）。要再允许别的网址（比如以后买的域名），在 Netlify 的环境变量里加 `ALLOWED_ORIGINS`，多个网址用逗号分开，例如 `https://wordmbti.com,https://www.wordmbti.com`。
- 第一次使用前，在 GitHub 仓库的 Settings → Pages → Build and deployment → Source 选 **GitHub Actions**。
- 打开 Netlify 网址首页的人会被 302 跳转到 GitHub Pages（`netlify.toml` 里的 `[[redirects]]`），`/api/*` 不受影响。
