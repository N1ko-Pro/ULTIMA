const OLLAMA_DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const OLLAMA_API_CHAT = "/api/chat";
const OLLAMA_API_TAGS = "/api/tags";
const OLLAMA_API_PULL = "/api/pull";
const OLLAMA_API_DELETE = "/api/delete";

const DEFAULT_OLLAMA_MODEL = "hf.co/IlyaGusev/saiga_yandexgpt_8b_gguf:Q8_0";
const DEFAULT_OLLAMA_TEMPERATURE = 0.15;

function normalizeOllamaModel(modelId) {
  const candidate = typeof modelId === "string" ? modelId.trim() : "";
  if (!candidate) return DEFAULT_OLLAMA_MODEL;
  return candidate;
}

module.exports = {
  OLLAMA_DEFAULT_BASE_URL,
  OLLAMA_API_CHAT,
  OLLAMA_API_TAGS,
  OLLAMA_API_PULL,
  OLLAMA_API_DELETE,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_TEMPERATURE,
  normalizeOllamaModel,
};
