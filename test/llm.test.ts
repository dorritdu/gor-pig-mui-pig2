import { describe, expect, it } from "vitest";
import { buildOpenAiContent, hasLlmKey, inferProvider, kimiApiKey, modelsToTry, parseOpenAiChatText } from "../src/llm.js";

describe("LLM provider helpers", () => {
  it("uses Kimi when that key or provider is set", () => {
    expect(inferProvider({ LLM_PROVIDER: "kimi", MOONSHOT_API_KEY: "sk" })).toBe("kimi");
    expect(inferProvider({ LLM_PROVIDER: "moonshot", KIMI_API_KEY: "sk" })).toBe("kimi");
    expect(inferProvider({ MOONSHOT_API_KEY: "sk" })).toBe("kimi");
    expect(kimiApiKey({ KIMI_API_KEY: "sk-kimi" })).toBe("sk-kimi");
    expect(hasLlmKey({ LLM_PROVIDER: "kimi" })).toBe(false);
    expect(hasLlmKey({ LLM_PROVIDER: "kimi", MOONSHOT_API_KEY: "sk" })).toBe(true);
    expect(inferProvider({ LLM_PROVIDER: "ollama" })).toBe("ollama");
    expect(inferProvider({ OPENAI_BASE_URL: "http://127.0.0.1:11434/v1" })).toBe("ollama");
    expect(inferProvider({ GROQ_API_KEY: "gsk", DEEPSEEK_API_KEY: "sk-ds" })).toBe("groq");
    expect(inferProvider({ DEEPSEEK_API_KEY: "sk-ds" })).toBe("deepseek");
    expect(inferProvider({ OPENROUTER_API_KEY: "sk-or-v1-x" })).toBe("openrouter");
    expect(inferProvider({ GEMINI_API_KEY: "g" })).toBe("gemini");
    expect(inferProvider({})).toBe("none");
  });

  it("builds a data-URL image part for screenshots", () => {
    const parts = buildOpenAiContent({
      text: "read this circular",
      imageBase64: "abc",
      mimeType: "image/jpeg",
    });
    expect(parts[0]).toEqual({ type: "text", text: "read this circular" });
    expect(parts[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64,abc" },
    });
  });

  it("retries Kimi vision models in official-id order", () => {
    expect(modelsToTry("kimi-k3", ["kimi-k3", "kimi-k2.6"])).toEqual(["kimi-k3", "kimi-k2.6"]);
  });

  it("reads OpenAI-style chat text", () => {
    expect(parseOpenAiChatText(JSON.stringify({ choices: [{ message: { content: "  hello  " } }] }))).toBe("hello");
  });
});
