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
