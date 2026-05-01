import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const EMOTIONS = ["joy", "sadness", "anger", "fear", "surprise", "disgust", "love"];

/** Anthropic Messages API expects dated model ids; many *-latest aliases return 404. */
const CLAUDE_MODEL_ALIASES = {
  "claude-3-5-sonnet-latest": "claude-sonnet-4-5-20250929",
  "claude-3-7-sonnet-latest": "claude-sonnet-4-5-20250929",
  "claude-sonnet-latest": "claude-sonnet-4-5-20250929",
  "claude-3-5-haiku-latest": "claude-haiku-4-5-20251001",
  "claude-haiku-latest": "claude-haiku-4-5-20251001"
};

const DEFAULT_CLAUDE_FALLBACKS = ["claude-sonnet-4-5-20250929", "claude-haiku-4-5-20251001"];

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("."));

app.post("/api/analyze", async (req, res) => {
  try {
    const { provider, userInput, mode, model } = req.body || {};
    if (!provider || !userInput) {
      return res.status(400).send("provider and userInput are required");
    }

    const systemPrompt = buildSystemPrompt();
    const userPrompt =
      mode === "dialogue"
        ? `Two-person dialogue. Analyze sentence by sentence and output the required JSON:\n${userInput}`
        : `User input. Analyze sentence by sentence and output the required JSON:\n${userInput}`;

    let text = "";
    if (provider === "claude") {
      text = await callAnthropic({ model }, systemPrompt, userPrompt);
    } else if (provider === "chatgpt") {
      text = await callOpenAICompatible(
        {
          endpoint: process.env.OPENAI_ENDPOINT || "https://api.openai.com/v1/chat/completions",
          apiKey: process.env.OPENAI_API_KEY,
          model: model || process.env.OPENAI_MODEL || "gpt-4o-mini"
        },
        systemPrompt,
        userPrompt
      );
    } else if (provider === "deepseek") {
      text = await callOpenAICompatible(
        {
          endpoint: process.env.DEEPSEEK_ENDPOINT || "https://api.deepseek.com/chat/completions",
          apiKey: process.env.DEEPSEEK_API_KEY,
          model: model || process.env.DEEPSEEK_MODEL || "deepseek-chat"
        },
        systemPrompt,
        userPrompt
      );
    } else if (provider === "doubao") {
      text = await callOpenAICompatible(
        {
          endpoint:
            process.env.DOUBAO_ENDPOINT ||
            "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
          apiKey: process.env.DOUBAO_API_KEY,
          model: model || process.env.DOUBAO_MODEL
        },
        systemPrompt,
        userPrompt
      );
    } else {
      return res.status(400).send(`Unsupported provider: ${provider}`);
    }

    const parsed = parseJsonFromText(text);
    if (!parsed) {
      return res.status(502).send("Model output could not be parsed as JSON");
    }

    return res.json({ analysis: parsed });
  } catch (error) {
    return res.status(500).send(error.message || "Server error");
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

function buildSystemPrompt() {
  return `
You are an emotion analysis assistant. Base your analysis only on the input text.
You must output JSON only, with no text before or after the JSON.
Use exactly these 7 emotion labels: joy, sadness, anger, fear, surprise, disgust, love.
Each score must be a decimal from 0 to 1.
Requirements:
1) For every sentence in the input, output the 7 emotion scores.
2) Output overall 7 emotion scores for the entire input.
3) extra_analysis: Write a substantive narrative in plain language (not JSON inside this field). Aim for roughly 180–350 words, or at least 8–14 sentences—never just one or two short sentences. Cover: the overall emotional arc; how emotion shifts across lines; dominant vs. subtle feelings; interpersonal dynamics or subtext if it is a dialogue; how the numeric factors relate to concrete phrases; any ambiguity or mixed emotions worth noting.
4) final_result: A concise closing takeaway (about 2–4 sentences) that synthesizes the main emotional reading.
The JSON shape must be:
{
  "sentence_analysis": [
    {
      "sentence": "original sentence text",
      "emotion_factors": {
        "joy": 0,
        "sadness": 0,
        "anger": 0,
        "fear": 0,
        "surprise": 0,
        "disgust": 0,
        "love": 0
      }
    }
  ],
  "overall_emotion_factors": {
    "joy": 0,
    "sadness": 0,
    "anger": 0,
    "fear": 0,
    "surprise": 0,
    "disgust": 0,
    "love": 0
  },
  "extra_analysis": "multi-sentence narrative as described above",
  "final_result": "short synthesis as described above"
}
`;
}

async function callOpenAICompatible(cfg, systemPrompt, userPrompt) {
  if (!cfg.apiKey) throw new Error("Server is missing API key environment variable");
  if (!cfg.model) throw new Error("Server is missing model configuration");

  const res = await fetch(cfg.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Upstream HTTP ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

function normalizeClaudeModelId(raw) {
  const id = String(raw || "").trim();
  if (!id) return "";
  const lower = id.toLowerCase();
  if (CLAUDE_MODEL_ALIASES[lower]) return CLAUDE_MODEL_ALIASES[lower];
  if (lower.endsWith("-latest")) {
    return "claude-sonnet-4-5-20250929";
  }
  return id;
}

function parseClaudeFallbacksFromEnv() {
  const raw = process.env.ANTHROPIC_MODEL_FALLBACKS || "";
  return raw
    .split(",")
    .map((s) => normalizeClaudeModelId(s))
    .filter(Boolean);
}

function buildClaudeModelCandidates(requestedFromBody) {
  const primary = normalizeClaudeModelId(requestedFromBody || process.env.ANTHROPIC_MODEL);
  if (!primary) {
    throw new Error("Missing ANTHROPIC_MODEL in .env; set a dated Claude model id");
  }
  const fromEnv = parseClaudeFallbacksFromEnv();
  const fallbacks = fromEnv.length ? fromEnv : DEFAULT_CLAUDE_FALLBACKS;
  const out = [];
  const seen = new Set();
  for (const m of [primary, ...fallbacks]) {
    if (!m || seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
}

function isClaudeModelNotFound(status, errText) {
  if (status !== 404) return false;
  try {
    const j = JSON.parse(errText);
    return j?.error?.type === "not_found_error" && String(j?.error?.message || "").includes("model:");
  } catch (_e) {
    return false;
  }
}

async function callAnthropic({ model }, systemPrompt, userPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const endpoint = process.env.ANTHROPIC_ENDPOINT || "https://api.anthropic.com/v1/messages";
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const candidates = buildClaudeModelCandidates(model);
  let lastErr = "";

  for (const chosenModel of candidates) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": process.env.ANTHROPIC_VERSION || "2023-06-01"
      },
      body: JSON.stringify({
        model: chosenModel,
        max_tokens: 4096,
        temperature: 0.2,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }]
      })
    });

    const errText = await res.text();

    if (res.ok) {
      const data = JSON.parse(errText);
      const textChunk = data?.content?.find((x) => x.type === "text");
      return textChunk?.text || "";
    }

    if (isClaudeModelNotFound(res.status, errText)) {
      lastErr = errText;
      continue;
    }

    throw new Error(`Upstream HTTP ${res.status}: ${errText}`);
  }

  throw new Error(
    `No working Claude model (tried: ${candidates.join(
      ", "
    )}). Set ANTHROPIC_MODEL in .env to a model id your account can use, or list models: curl https://api.anthropic.com/v1/models -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01". Last error: ${lastErr}`
  );
}

function parseJsonFromText(text) {
  if (!text) return null;
  try {
    return normalizeAnalysisJson(JSON.parse(text));
  } catch (_e) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const sliced = text.slice(start, end + 1);
    try {
      return normalizeAnalysisJson(JSON.parse(sliced));
    } catch (_err) {
      return null;
    }
  }
}

function normalizeAnalysisJson(raw) {
  const out = {
    sentence_analysis: [],
    overall_emotion_factors: emptyFactors(),
    extra_analysis: String(raw?.extra_analysis || ""),
    final_result: String(raw?.final_result || "")
  };

  if (Array.isArray(raw?.sentence_analysis)) {
    out.sentence_analysis = raw.sentence_analysis.map((item) => ({
      sentence: String(item?.sentence || ""),
      emotion_factors: normalizeFactors(item?.emotion_factors || {})
    }));
  }
  out.overall_emotion_factors = normalizeFactors(raw?.overall_emotion_factors || {});
  return out;
}

function normalizeFactors(input) {
  const factors = {};
  EMOTIONS.forEach((emotion) => {
    factors[emotion] = clamp(Number(input?.[emotion] ?? 0), 0, 1);
  });
  return factors;
}

function emptyFactors() {
  return normalizeFactors({});
}

function clamp(val, min, max) {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}
