# 映序 · Frameflow

会议需求对应的可运行图生视频交互原型，采用原生 HTML/CSS/JavaScript，无运行时 npm 依赖。

## 本地启动

```powershell
Set-Location 'E:\codex\projects\frameflow-video-demo'
node server.mjs
```

打开 http://127.0.0.1:4173 。H5 简化布局：`http://127.0.0.1:4173/?embed=1`。

执行 `npm run check` 验证 JavaScript 语法。

## 交付范围

- 图片选择、拖放、格式/大小校验，示例原创 SVG 山湖插画。
- 提示词、三种运镜、模板对话、5/10 秒、16:9/9:16/1:1。
- Canvas + MediaRecorder 制作真实可播放的图片运镜短片；生成期间保持页面在前台。优先 WebM，支持时可降级 MP4。
- IndexedDB 保存作品与 Blob、事务结算 10 次演示额度、取消不扣除、可重置。
- 项目架构、验收和预算计算，官方计费链接与下载说明。

真实模型推理、认证、服务器限额、任务队列和 100 并发验收未实现。本地模板助手不会调用大模型。视频标记 DEMO。

静态部署入口：`dist/index.html`。项目方案：`dist/项目方案.md`。所有用户图片与演示视频留在浏览器 IndexedDB，源码部署不包含用户输入。Google Fonts 只用于字体，失败时使用系统回退字体。

生产版需增加服务端模型适配与队列，保持密钥在服务端，详见项目方案。服务品牌是封装名称，不表示自研基础模型。
