# Emotion Analyzer AI Chat

一个可公网部署的情绪分析网站，支持：
- ChatGPT
- Claude
- DeepSeek
- Volcengine (Ark)

## 已实现功能

- 左侧模型切换栏
- 普通输入 / 双人对话输入模式切换
- 逐句输出 7 类情绪因子（0-1）
- 整体对话输出 7 类情绪因子（0-1）
- 每个模型独立保存聊天记录（localStorage）
- 顶部提供“复制网址”和“二维码显示”

## 本地运行

1) 安装依赖

```bash
npm install
```

2) 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填写你的 API Key（至少填你要用的模型）。

3) 启动

```bash
npm run dev
```

浏览器打开 `http://localhost:3000`

## 你需要替换的信息

### 1) `config.js`（前端）
- 只需要改各模型的 `model`（可选，按你账号可用模型）

### 2) `.env`（后端，必须）
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `DEEPSEEK_API_KEY`
- `DOUBAO_API_KEY`
- `DOUBAO_MODEL` (endpoint id or model id from the [Volcengine Ark](https://www.volcengine.com/product/ark) console; env vars keep the `DOUBAO_*` prefix for compatibility)

#### Claude（Anthropic）模型名注意

Anthropic 的 `model` 参数需要使用**控制台 / 文档里给出的完整模型 id**（通常形如 `claude-sonnet-4-5-20250929`）。像 `claude-3-7-sonnet-latest` 这类 **`*-latest` 在 Messages API 里经常会直接 404**。

- 默认示例：`ANTHROPIC_MODEL=claude-sonnet-4-5-20250929`
- 可用下面命令列出你账号当前可用的模型 id（把 key 换成你自己的）：

```bash
curl https://api.anthropic.com/v1/models \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01"
```

- 可选：设置 `ANTHROPIC_MODEL_FALLBACKS=模型1,模型2`，主模型不可用时服务端会依次尝试。

> API Key 放在 `.env`，不会暴露到前端。

## 部署到公网（别人通过网址访问）

原理：在云端跑 `node server.js`，由 Express 同时提供静态页面和 `/api/analyze`；你把 **API Key 写在平台的环境变量里**，不要提交到 Git。

### 方式 A：Render（免费档可用，步骤最少）

1. **准备代码仓库**  
   - 注册 [GitHub](https://github.com)，新建一个仓库。  
   - 只上传 **`AIemotion` 文件夹里的内容** 作为仓库根目录（或上传整个仓库但在 Render 里设 **Root Directory** 为 `AIemotion`）。

2. **注册 Render**  
   - 打开 [render.com](https://render.com)，用 GitHub 登录。

3. **新建 Web Service**  
   - Dashboard → **New +** → **Web Service** → 选中你的仓库。  
   - **Runtime**：Node  
   - **Build Command**：`npm install`  
   - **Start Command**：`npm start`  
   - **Instance type**：Free 即可（免费实例冷启动会慢几秒，属正常）。

4. **环境变量**  
   - 打开该服务的 **Environment** 页面，参照本地 `.env.example` **逐条添加**（名称一致、值为你的真实 Key）。  
   - 至少配置你会用到的模型；未配置的模型在页面上点了会报缺 Key。

5. **部署与访问**  
   - 保存后等待首次 Deploy 成功，会得到 **`https://你的服务名.onrender.com`**。  
   - 把该链接发给别人即可使用；页面里 **Copy page URL / Show QR code** 也基于这个地址。

### 方式 B：Railway / Fly.io / 自己的 VPS

- 同样：**Node 18+**、`npm install`、`npm start`，端口用平台提供的 **`PORT`**（本项目已 `process.env.PORT || 3000`，无需改代码）。  
- 在平台后台配置与 `.env.example` 相同的环境变量。

### 注意

- **不要把 `.env` 或真实 Key 推送到 Git**；`.gitignore` 已忽略 `.env`。  
- 若仓库在 GitHub 上是「大仓库里的子文件夹」，在 Render 的 Web Service 里设置 **Root Directory** 为 `AIemotion`（路径按你仓库实际为准）。  
- 自定义域名：在 Render 该服务的 **Settings → Custom Domain** 里按提示绑定。
