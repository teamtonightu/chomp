// Shared logic for POST /api/claude — forwards the app's AI requests to an AI provider.
// FREE option: set GEMINI_API_KEY (Google AI Studio free tier).
// Paid option: set ANTHROPIC_API_KEY (Claude). If both are set, Gemini is used unless AI_PROVIDER=anthropic.

const CLAUDE_MODELS = { quick: "claude-haiku-4-5-20251001", default: "claude-sonnet-5", complex: "claude-sonnet-5" };
const GEMINI_MODEL = () => process.env.GEMINI_MODEL || "gemini-3.5-flash";
const JSON_RULE = "Reply with only valid JSON: no markdown fences and no text before or after it.";

function pickProvider() {
  const want = (process.env.AI_PROVIDER || "").toLowerCase();
  if (want === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (want === "gemini" && process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export async function handleClaude(body, origin) {
  const provider = pickProvider();
  if (!provider) return [500, { code: "no_key", message: "Set GEMINI_API_KEY (free) or ANTHROPIC_API_KEY" }];

  const allowed = process.env.ALLOWED_ORIGIN; // optional, e.g. https://chomp.vercel.app
  if (allowed && origin && origin !== allowed) return [403, { code: "not_granted", message: "Origin not allowed" }];

  let { input, images = [], tier = "default", json = false } = body || {};
  let messages = null;
  if (typeof input === "string" && input.trim()) messages = [{ role: "user", content: input }];
  else if (Array.isArray(input)) {
    messages = input
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .map(m => ({ role: m.role, content: m.content }));
  }
  if (!messages || !messages.length || messages[messages.length - 1].role !== "user")
    return [400, { code: "invalid_request", message: "Bad input" }];
  if (JSON.stringify(messages).length > 70000) return [413, { code: "prompt_too_large", message: "Prompt too long" }];
  images = (Array.isArray(images) ? images : []).filter(s => typeof s === "string" && s.length < 6_000_000).slice(0, 4);
  const maxTokens = tier === "complex" ? 8000 : 4000;

  try {
    return provider === "gemini"
      ? await callGemini(messages, images, json, maxTokens)
      : await callClaude(messages, images, json, maxTokens, tier);
  } catch (e) {
    return [502, { code: "upstream_error", message: String(e) }];
  }
}

async function callGemini(messages, images, json, maxTokens) {
  const contents = messages.map((m, i) => {
    const parts = [];
    if (i === messages.length - 1) images.forEach(data => parts.push({ inline_data: { mime_type: "image/jpeg", data } }));
    parts.push({ text: m.content });
    return { role: m.role === "assistant" ? "model" : "user", parts };
  });
  // Gemini's "thinking" counts toward the output limit, so give it plenty of room
  // or long answers (3 recipes, week plans) get cut off mid-JSON.
  const payload = { contents, generationConfig: { maxOutputTokens: Math.max(maxTokens, 32768) } };
  if (json) {
    payload.systemInstruction = { parts: [{ text: JSON_RULE }] };
    payload.generationConfig.responseMimeType = "application/json";
  }
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL())}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message || `Gemini API error ${r.status}`;
    if (r.status === 429) return [429, { code: "rate_limited", message: msg }];
    if (r.status === 400 && /api key/i.test(msg)) return [500, { code: "no_key", message: "Gemini key was rejected: " + msg }];
    if (r.status === 401 || r.status === 403) return [500, { code: "no_key", message: "Gemini key was rejected: " + msg }];
    return [502, { code: "upstream_error", message: msg }];
  }
  const cand = (data.candidates || [])[0] || {};
  const text = (cand.content?.parts || []).map(p => p.text || "").join("");
  if (!text && cand.finishReason === "SAFETY") return [422, { code: "refused", message: "Blocked by safety filter" }];
  return [200, { text, truncated: cand.finishReason === "MAX_TOKENS" }];
}

async function callClaude(messages, images, json, maxTokens, tier) {
  if (images.length) {
    const last = messages[messages.length - 1];
    last.content = [
      ...images.map(data => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } })),
      { type: "text", text: last.content },
    ];
  }
  const payload = { model: CLAUDE_MODELS[tier] || CLAUDE_MODELS.default, max_tokens: maxTokens, messages };
  if (json) payload.system = JSON_RULE;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message || `Claude API error ${r.status}`;
    if (r.status === 429) return [429, { code: "rate_limited", message: msg }];
    if (r.status === 401) return [500, { code: "no_key", message: "API key was rejected: " + msg }];
    return [502, { code: "upstream_error", message: msg }];
  }
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  return [200, { text, truncated: data.stop_reason === "max_tokens" }];
}
