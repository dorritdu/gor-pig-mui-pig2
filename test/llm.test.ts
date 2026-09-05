import { describe, expect, it } from "vitest";
import { buildOpenAiContent, inferProvider, modelsToTry, parseOpenAiChatText } from "../src/llm.js";

describe("LLM provider helpers", () => {
  it("prefers OpenRouter when that key is present (HK-friendly default)", () => {
    expect(inferProvider({ OPENROUTER_API_KEY: "sk-or-v1-x", GEMINI_API_KEY: "g" })).toBe("openrouter");
    expect(inferProvider({ GEMINI_API_KEY: "g" })).toBe("gemini");
    expect(inferProvider({ GROQ_API_KEY: "gsk" })).toBe("groq");
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

  it("retries a dead free slug with working free vision models", () => {
    expect(modelsToTry("qwen/qwen2.5-vl-72b-instruct:free", ["google/gemma-4-31b-it:free", "openrouter/free"])).toEqual([
      "qwen/qwen2.5-vl-72b-instruct:free",
      "google/gemma-4-31b-it:free",
      "openrouter/free",
    ]);
  });

  it("reads OpenAI-style chat text", () => {
    expect(parseOpenAiChatText(JSON.stringify({ choices: [{ message: { content: "  hello  " } }] }))).toBe("hello");
  });
});
