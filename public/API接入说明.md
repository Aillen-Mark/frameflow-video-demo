# 映序：视频 API 接入

打开左侧 **API 接入**。选择供应商，填写模型和凭据，**保存接入配置 → 测试连接 → 创作工作台选择服务 → 提交到 API**。

## 火山方舟 / Seedance

- Base URL：`https://ark.cn-beijing.volces.com/api/v3`
- 鉴权：API Key · Bearer。
- 模型：填写控制台已开通的 Model ID 或 Endpoint ID（`ep-…`），不要填写产品中文名。
- 当前接入首帧图生视频；创建 `POST /contents/generations/tasks`，查询 `GET /contents/generations/tasks/{id}`。
- 只读连接测试使用任务列表接口。测试成功只表示查询接口连通和鉴权有效，不能证明指定模型额度、余额或生成权限。
- 此 API 为火山方舟协议。即梦视觉服务的 AK/SK 请求签名接口是另一套协议，不能把其密钥直接填在方舟 API Key 中。
- 参考：[创建任务](https://docs.volcengine.com/docs/ark/create-video-generation-task-api?lang=zh)、[查询任务](https://docs.volcengine.com/docs/ark/get-video-generation-task-api?lang=zh)。

## 可灵

- 默认海外 Base URL：`https://api-singapore.klingai.com`。国内账户请按开放平台提供的地区地址填写。
- API Key：选择 Bearer；旧版 Access Key + Secret Key：选择 AK + SK。JWT 在服务端临时签发，不存到浏览器。
- 适配可灵 `/v1/videos/image2video` 协议（例如 `kling-v2-6`、`kling-v3`）；模型必须在账户中可用。采用新版本协议的模型需按其文档通过第三方 JSON 配置或新增适配器接入。
- 模式：`pro` / `std`，以所选模型支持范围为准；时长当前为 5 或 10 秒。
- 可灵首帧图生视频通常按原图比例输出，工作台比例选项不会强制更改此协议的输出比例。
- 参考：[鉴权](https://kling.ai/document-api/api/get-started/authentication)、[图生视频 v1 接口](https://kling.ai/document-api/api/video/3-0-omni/image-to-video/legacy)。

## 第三方 JSON 接口

支持“POST JSON 创建异步任务 + GET 查询任务”的接口。填写 Base URL、创建路径、查询路径、只读测试路径、模型 ID 和返回字段。Base URL 不含结尾斜线；所有路径以 `/` 开头，查询路径必须包含 `{id}`。

示例：供应商响应 `{"data":{"task_id":"abc","status":"completed","videos":[{"url":"https://cdn.example.com/video.mp4"}]}}`，字段映射为：

- 任务 ID：`data.task_id`
- 状态：`data.status`
- 视频地址：`data.videos.0.url`
- 成功状态：`completed`；多个值用英文逗号分隔。

请求模板可使用 `{{model}}`、`{{prompt}}`、`{{image}}`（JPEG Data URL）、`{{image_base64}}`（纯 Base64）、`{{duration}}`、`{{aspect}}`、`{{request_id}}`。变量作为完整值时保留数据类型，因此 `"duration":"{{duration}}"` 最终发送数值。

支持 Bearer，或 Authorization / X-API-Key / Api-Key / X-Token 请求头。请求模板中不放凭据。第三方须接受 Data URL 或 Base64 图片；仅接受公网图片 URL、multipart 上传、WebSocket、HMAC 或其他专有协议的服务仍需增加适配器，不是所有视频 API 都是通用协议。

可从页面下载 `api-config-example.json`。替换其中的地址与模型后导入，密钥在独立输入框中填写。

## JSON 导入与导出

可选择文件，或粘贴 JSON。`provider` 为 `ark`、`kling`、`custom`。导入只填表，不会自动保存或访问供应商。

如已有凭据配置，可附 `credentials` 对象：API Key 对应 `apiKey`；可灵旧版对应 `accessKey` 和 `secretKey`。导入后检查内容并保存。不要分享包含 `credentials` 的原文件。

导出仅包含非敏感配置，不含密钥。修改地址或鉴权方式后必须重新填写凭据，避免把原来的密钥发往新的目的地址。

## 生成、记录与下载

- 模型密钥 AES-GCM 加密后保存在服务端数据库，配置和任务按登录账号隔离。
- 实际提交前，浏览器将图片转为 JPEG、最长边不超过 2048px，以兼容三类接口；图片宽高至少 300px，宽高比 0.4–2.5。
- 调用计费直接记在所填供应商账户。项目预算页是早期即梦接口的参考测算，**不是当前选定 Seedance / 可灵模型的实时账单**。
- 本次 API 功能设有服务端 10 次额度，与可重置的本地演示额度分开。成功、处理中和待核对任务占用额度；明确失败释放。它不代替活动级金额预算、用户管理与 100 并发调度。
- 同一个请求标识只提交一次。网络超时或无法解析任务 ID 时保留“待核对”，不会自动重新发起收费任务。
- 在供应商控制台找到既有任务 ID 后，使用“关联任务 ID”恢复查询；只关联对应的原任务。
- “后台继续”只停止当前页面轮询，不取消供应商任务。刷新后到 API 任务记录点击“查询进度”。
- 可在记录里预览、下载，或打开原始结果链接。供应商链接可能过期，当前未将生成视频长期转存到对象存储。

## 开发接口

- `GET /api/configs`：仅返回非敏感配置与凭据是否已保存。
- `PUT /api/configs/{provider}`：保存配置和加密凭据。
- `DELETE /api/configs/{provider}`：移除配置，已有任务保留其调用快照。
- `POST /api/configs/{provider}/test`：调用只读连接测试接口。
- `POST /api/tasks`：提交生成，包含 `requestId/provider/title/prompt/image/duration/aspect`。
- `GET /api/tasks`：列出当前账号任务。
- `GET /api/tasks/{id}`：查询并同步任务状态。
- `GET /api/tasks/{id}/download`：流式下载已完成视频。
- `POST /api/tasks/{id}/recover`：以 `externalId` 关联未确认的提交。

服务由 Sites 身份头鉴权，写接口检查同源和 `X-Frameflow-Request: 1`。不要在公共服务器上直接信任客户端提交的身份头；迁移至阿里云时应换成后端校验的会话和登录系统。

真实供应商验收需要你填写已开通服务的有效凭据。当前自动化测试使用本地固定响应，未调用收费生成接口。
