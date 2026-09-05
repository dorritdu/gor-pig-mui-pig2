import { buildExtractPrompt, parseExtractJson } from "./extract.js";
import { buildQaContext } from "./qa.js";
import type { AgendaItem } from "./format.js";
import type { Child, ExtractResult, Organisation, Task } from "./types.js";

export interface GeminiClient {
  extract(input: {
    text?: string;
    imageBase64?: string;
    mimeType?: string;
    children: Child[];
    organisations: Organisation[];
  }): Promise<ExtractResult>;
  answer(question: string, items: AgendaItem[], tasks: Task[], children: Child[], snippets: string[]): Promise<string>;
}

export class HttpGeminiClient implements GeminiClient {
  constructor(
    private readonly apiKey: string,
    private readonly model = "gemini-2.0-flash",
  ) {}

  async extract(input: {
    text?: string;
    imageBase64?: string;
    mimeType?: string;
    children: Child[];
    organisations: Organisation[];
  }): Promise<ExtractResult> {
    const parts: Array<Record<string, unknown>> = [{ text: buildExtractPrompt(input.children, input.organisations) }];
    if (input.text) parts.push({ text: `Notice text / caption:\n${input.text}` });
    if (input.imageBase64 && input.mimeType) {
      parts.push({ inline_data: { mime_type: input.mimeType, data: input.imageBase64 } });
    }
    const text = await this.generate(parts);
    const parsed = parseExtractJson(text);
    if (!parsed.rawText && input.text) parsed.rawText = input.text;
    return parsed;
  }

  async answer(
    question: string,
    items: AgendaItem[],
    tasks: Task[],
    children: Child[],
    snippets: string[],
  ): Promise<string> {
    const prompt = buildQaContext(question, items, tasks, children, snippets);
    return this.generate([{ text: prompt }]);
  }

  private async generate(parts: Array<Record<string, unknown>>): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.2 },
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini ${response.status}: ${err.slice(0, 300)}`);
    }
    const json = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!text.trim()) throw new Error("Gemini returned an empty response");
    return text.trim();
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
