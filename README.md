# 🎬 FrameWhisper — 用声音，预见画面

> "在开机之前，我们就已经看到了杀青的画面。"

**FrameWhisper** 是一款专为自媒体博主和短视频团队打造的**「AI 分镜预览工具」**。
在实际拍摄前，你只需要**动动嘴**描述一下脑海中的分镜画面，FrameWhisper 就能调用火山引擎强大的 AI 模型，把你的语音变成脚本，再把脚本直接生成高清的预览视频！

无论是团队开会过脚本、确定演员走位、还是向客户展示拍摄构想，FrameWhisper 都能让你做到“心中有数，眼中有画”。

---

## ✨ 核心亮点

- 🎙️ **实时语音转写 (ASR)**：不用辛苦码字！按下麦克风直接说，火山引擎大模型流式语音识别，边说边转字，准到离谱。
- 🤖 **一键生视频 (Seedance 1.5 Pro)**：文本一键生成高质量视频。我们帮你接入了豆包最强的 `Seedance 1.5 Pro` 视频大模型，支持精准的物理法则与运镜还原。
- 🎨 **多风格预设模板**：
  - `🎥 实拍`：真实场景，自然光影，适合剧情号/Vlog 团队定机位。
  - `🎨 动漫`：色彩鲜艳的二次元风格，适合漫剪/脑洞号预览。
  - `✨ 特效`：好莱坞级粒子与 CG，帮你预览复杂的后期效果。
- 🚀 **极简的交互工作流**：选风格 -> 录音描述 -> 等待生成 -> 生成故事板。
- 🌐 **Vercel 一键部署**：前后端分离但又极其轻量，自带 Serverless 函数代理，完美解决跨域与 API Key 隐藏问题。

---

## 🛠️ 技术栈

- **前端**：HTML5 + Vanilla JavaScript + CSS3 (原生的浪漫，丝滑的玻璃拟态设计 ✨)
- **后端 (本地)**：Node.js + WebSocket 代理服务器 (`server.js`)
- **后端 (云端)**：Vercel Serverless Functions (`/api`)
- **AI 引擎**：
  - **语音识别**：火山引擎大模型流式语音识别 API (WebSocket 二进制协议传输 + Web Audio API 16kHz 实时重采样)
  - **视频生成**：火山引擎 Doubao Seedance 1.5 Pro 视频生成大模型 (支持智能长宽比与轮询查询)

---

## 🚀 快速开始

### 1. 准备你的魔法钥匙 🔑
你需要前往 [火山引擎控制台](https://console.volcengine.com/) 获取以下两组凭证：
1. **语音识别 (ASR)** 的 `APP_ID` 和 `TOKEN`
2. **火山方舟 (Ark)** 的 Seedance 1.5 Pro 的 `API_KEY`

### 2. 配置秘钥 ⚙️
打开 `js/config.js`，将你获取到的凭证填入相应位置：
```javascript
const CONFIG = {
  VOLCENGINE_ASR: {
    APP_ID: '你的 APP_ID',
    TOKEN: '你的 TOKEN',
    // ...
  },
  SEEDANCE: {
    API_KEY: '你的 API_KEY', // 如果部署到 Vercel，请配置到环境变量中
    MODEL: 'doubao-seedance-1-5-pro-251215',
    // ...
  }
}
```

### 3. 本地把玩 🎮
1. 安装依赖：
```bash
npm install
```
2. 启动本地代理服务器（解决跨域及 WebSocket 鉴权）：
```bash
npm run dev
```
3. 浏览器会自动为你指向 `http://localhost:3000`。尽情发挥你的导演才华吧！

---

## ☁️ 部署到 Vercel
想要把这个工具发给团队成员用？直接丢上 Vercel：

1. 确保安装了 Vercel CLI 并已登录（`npx vercel login`）
2. 在项目根目录执行：
```bash
npx vercel --prod -e SEEDANCE_API_KEY="你的_SEEDANCE_API_KEY"
```
3. 部署后，项目会自动切换为使用浏览器原生的 `Web Speech API` 进行语音识别，并使用 Vercel 的云函数来代理 Seedance 视频生成请求。

---

## 👨‍💻 开发者备忘录

- 项目中包含了一个 `MOCK_MODE`。如果在高铁上或者没有网络，可以在 `config.js` 开启 `MOCK_VIDEO = true` 体验 UI 流程。
- WebSocket 代理：前端由于浏览器的限制，无法直接给 WebSocket 握手请求加自定义 Header（火山引擎 ASR 鉴权必需）。这也是我们为什么需要一个 Node 代理层的根本原因。

---
*Made with ❤️ by 喵喵 & Trae.*
