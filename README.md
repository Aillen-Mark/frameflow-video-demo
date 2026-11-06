# 映序 · Frameflow API 接入版

原生 HTML/CSS/JavaScript 工作台，使用 Sites Vinext + Cloudflare D1 承载视频 API 配置与任务。

打开网站 `/#api`，选择火山方舟、可灵或第三方 JSON 接口，填写模型与密钥，保存并测试连接。回到工作台选择生成服务，再提交图片。详见 [API 接入说明](public/API接入说明.md)。

支持方舟 Bearer；可灵 Bearer 或 AK/SK JWT（v1 image2video 协议）；第三方 JSON 模板、字段映射和自定义鉴权头。包含 JSON 导入/导出、加密保存、账号隔离、重复提交去重、进度查询、未确认任务关联及下载。

## 本地启动

当前工作区依赖、加密密钥和本地数据库已准备好：

```powershell
Set-Location 'E:\codex\projects\frameflow-video-demo'
npm run local
```

访问 `http://127.0.0.1:4173/signin-with-chatgpt?return_to=%2F%23api` 使用 Sites 本地身份；线上身份由 Sites 提供。

新环境需 Node.js >= 22.13.0，执行 `npm run install:ci`，在未跟踪的 `.dev.vars` 设置至少 32 字符的随机 `VIDEO_CONFIG_KEY`，然后构建并对空的本地数据库执行一次迁移：

```powershell
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_bent_vargas.sql
npm run local
```

已有加密数据后不要随意更换 `VIDEO_CONFIG_KEY`。线上通过 Sites secret 配置该值。本地 `.dev.vars` 和数据库不提交。

## 文件与验证

- `ui/index.html`、`public/`：前端；`server/`：供应商适配、凭据和任务服务。
- `app/api/[...path]/route.ts`：同源接口；`db/schema.ts`、`drizzle/`：数据库迁移。
- `npm run check`：语法；`npm test`：服务端固定响应测试；`npm run build`：Worker 部署产物。

保留免费本地运镜演示。API 模式使用你填写的供应商账户，实际模型权限、费用和生成效果需有效凭据验收；当前测试未调用收费生成接口。第三方支持 POST JSON + GET 异步查询，不覆盖任意专有协议。

未完成赛事名单登录、活动总金额限额、100 人调度队列、长期对象存储和正式负载验收。部署包不含本地数据库、浏览器作品或供应商密钥。
