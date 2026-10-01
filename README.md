# AI 电商热点营销工作台

轻量 Next.js Demo。LLM 通过服务端 OpenAI Compatible 接口封装，新闻搜索通过独立 `searchNews()` 适配器接入 Tavily。系统会把同一热点和商品整理成微博、小红书图文和短视频脚本。缺少新闻 Key 时使用演示新闻继续分析；没有完整模型配置时使用纯 Mock 模式。

## 本地运行

需要 Node.js 20.9 或更新版本，并安装 pnpm（或启用 Corepack）。Next.js 官方要求 Node.js 最低 20.9。

```bash
pnpm install
pnpm dev
```

打开 `http://localhost:3000`。页面会请求 `POST /api/generate`，普通热点由本地 Mock 数据返回三条完整的平台内容；输入“地震”“洪水”“事故”等关键词，可体验高风险 Gate，输入“无商品匹配”可体验商品未命中的状态。高风险或无商品结果不会生成平台内容。

## 导入商品表

把商品 `.xlsx` 文件路径传给转换脚本，默认读取第一个有内容的工作表，输出到 `data/products.json`：

```bash
pnpm products:convert "C:/path/to/商品详情数据.xlsx"
```

也可使用 `--sheet Sheet1` 指定工作表，或 `--output data/products.json` 指定输出位置。当前脚本会映射 SKU、品类、名称、售价、成本、毛利、销售、退货、库存、评分和详情字段，并将每行的所有原始列和值按顺序保存在 `sourceFields` 中。运行转换需要支持原生 TypeScript 类型剥离的 Node.js 22.6 或更新版本。

## 启用真实 LLM 和新闻搜索

复制 `.env.example` 为 `.env.local`，填写 `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`，然后设置 `MOCK_MODE=false` 并重启开发服务器。`LLM_BASE_URL` 填服务商 API 根地址（可包含 `/v1`，也可直接填到 `/chat/completions`）。

新闻搜索服务建议先用 [Tavily](https://www.tavily.com/)。注册后在 [Tavily 控制台](https://app.tavily.com/)创建并复制 API Key，放进本地 `.env.local`：

```dotenv
NEWS_API_URL=https://api.tavily.com/search
NEWS_API_KEY=你的_Tavily_API_Key
```

Tavily 当前免费方案每月包含 1,000 API credits，无需信用卡；具体额度以其[定价页](https://www.tavily.com/pricing)为准。Key 只在服务端读取，切勿使用 `NEXT_PUBLIC_` 前缀或提交到代码仓库。未设置 `NEWS_API_KEY` 或实时搜索失败时，工作台会显示提示并用 Mock 新闻继续走完 LLM 流程。`NEWS_API_URL` 可用于替换搜索端点。

## 当前阶段

- Phase 1：工作台交互、进度展示、Mock API、结果卡片和高风险文案 Gate。
- Phase 2：Excel 导入和 `products.json` 商品目录。
- Phase 3：OpenAI Compatible LLM、集中 Prompt、商品匹配、文案数据白名单过滤和高风险 Gate。
- Phase 4：Tavily 新闻搜索适配、最多三条新闻映射、超时处理和 Mock 回退。
- Phase 5：结果状态与失败原因提示、分析中顶部模式状态优化。
- V1.2：微博、小红书和短视频内容生成、独立平台状态与复制、Mock 平台内容。

API 凭据只会在服务端环境中配置。`.env.example` 当前仅记录后续配置项。
