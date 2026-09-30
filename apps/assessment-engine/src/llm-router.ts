/**
 * LLM Router — Smart multi-provider AI gateway for LeetCAD.
 *
 * Automatically discovers which API keys are configured, tries providers
 * in priority order, tracks latency + success rates, and cascades to the
 * next provider on failure. The fastest successful provider is promoted
 * to the top of the queue for subsequent calls.
 */

// ── Types ────────────────────────────────────────────────────

export interface LLMResult {
  score: number;
  report: string;
  provider: string;
  model: string;
  latencyMs: number;
}

interface ProviderConfig {
  name: string;
  enabled: boolean;
  callFn: (pngBase64: string, prompt: string) => Promise<LLMResult>;
}

interface ProviderStats {
  successes: number;
  failures: number;
  avgLatencyMs: number;
}

// ── OpenAI-compatible API caller (works for OpenRouter, OpenAI, Groq, Together, etc.) ──

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  providerName: string,
  pngBase64: string,
  prompt: string,
  extraHeaders: Record<string, string> = {},
): Promise<LLMResult> {
  const start = Date.now();

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${pngBase64}` },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${providerName} API error ${response.status}: ${body.slice(0, 300)}`);
  }

  const data: any = await response.json();
  const text = data.choices?.[0]?.message?.content ?? "";

  // Handle markdown-wrapped JSON (```json ... ```)
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const parsed = JSON.parse(cleaned);

  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score))));
  if (Number.isNaN(score)) throw new Error("Parsed score is NaN");

  const report = typeof parsed.report === "string" && parsed.report.length > 0
    ? parsed.report
    : "No report generated.";

  const latencyMs = Date.now() - start;

  return { score, report, provider: providerName, model, latencyMs };
}

// ── Google Gemini direct (non-OpenAI format) ──

async function callGeminiDirect(
  apiKey: string,
  model: string,
  pngBase64: string,
  prompt: string,
): Promise<LLMResult> {
  const start = Date.now();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: "image/png", data: pngBase64 } },
          { text: prompt + '\n\nRespond ONLY with valid JSON: { "score": <integer 0-100>, "report": "<markdown>" }' },
        ],
      }],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini Direct API error ${response.status}: ${body.slice(0, 300)}`);
  }

  const data: any = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const parsed = JSON.parse(cleaned);

  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score))));
  if (Number.isNaN(score)) throw new Error("Parsed score is NaN");

  const report = typeof parsed.report === "string" && parsed.report.length > 0
    ? parsed.report
    : "No report generated.";

  const latencyMs = Date.now() - start;

  return { score, report, provider: "gemini-direct", model, latencyMs };
}

// ── Router ───────────────────────────────────────────────────

export class LLMRouter {
  private providers: ProviderConfig[] = [];
  private stats = new Map<string, ProviderStats>();

  constructor() {
    this.discoverProviders();
    console.log(
      `[llm-router] Initialized with ${this.providers.filter(p => p.enabled).length} provider(s): ` +
      this.providers.filter(p => p.enabled).map(p => p.name).join(", "),
    );
  }

  private discoverProviders(): void {
    // ── 1. OpenRouter (best: unified gateway to 200+ models) ──
    const openrouterKey = process.env.OPENROUTER_API_KEY || "";
    const openrouterModel = process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001";
    if (openrouterKey) {
      // Primary model
      this.addProvider(`openrouter/${openrouterModel}`, true, (png, prompt) =>
        callOpenAICompatible(
          "https://openrouter.ai/api/v1", openrouterKey, openrouterModel,
          `openrouter/${openrouterModel}`, png, prompt,
          { "HTTP-Referer": "https://leetcad.dev", "X-Title": "LeetCAD" },
        ),
      );

      // Backup models via OpenRouter (tried if primary model fails)
      const backupModels = [
        "google/gemini-2.0-flash-001",
        "meta-llama/llama-4-maverick",
        "deepseek/deepseek-chat-v3-0324",
        "qwen/qwen-2.5-vl-72b-instruct",
      ].filter(m => m !== openrouterModel);

      for (const model of backupModels) {
        this.addProvider(`openrouter/${model}`, true, (png, prompt) =>
          callOpenAICompatible(
            "https://openrouter.ai/api/v1", openrouterKey, model,
            `openrouter/${model}`, png, prompt,
            { "HTTP-Referer": "https://leetcad.dev", "X-Title": "LeetCAD" },
          ),
        );
      }
    }

    // ── 2. Google Gemini Direct ──
    const geminiKey = process.env.GEMINI_API_KEY || "";
    if (geminiKey && geminiKey.startsWith("AIza")) {
      const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash";
      this.addProvider(`gemini-direct/${geminiModel}`, true, (png, prompt) =>
        callGeminiDirect(geminiKey, geminiModel, png, prompt),
      );
    }

    // ── 3. OpenAI Direct ──
    const openaiKey = process.env.OPENAI_API_KEY || "";
    if (openaiKey) {
      const openaiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
      this.addProvider(`openai/${openaiModel}`, true, (png, prompt) =>
        callOpenAICompatible(
          "https://api.openai.com/v1", openaiKey, openaiModel,
          `openai/${openaiModel}`, png, prompt,
        ),
      );
    }

    // ── 4. Groq ──
    const groqKey = process.env.GROQ_API_KEY || "";
    if (groqKey) {
      const groqModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
      this.addProvider(`groq/${groqModel}`, true, (png, prompt) =>
        callOpenAICompatible(
          "https://api.groq.com/openai/v1", groqKey, groqModel,
          `groq/${groqModel}`, png, prompt,
        ),
      );
    }

    // ── 5. Together AI ──
    const togetherKey = process.env.TOGETHER_API_KEY || "";
    if (togetherKey) {
      const togetherModel = process.env.TOGETHER_MODEL || "meta-llama/Llama-3.3-70B-Instruct-Turbo";
      this.addProvider(`together/${togetherModel}`, true, (png, prompt) =>
        callOpenAICompatible(
          "https://api.together.xyz/v1", togetherKey, togetherModel,
          `together/${togetherModel}`, png, prompt,
        ),
      );
    }
  }

  private addProvider(name: string, enabled: boolean, callFn: ProviderConfig["callFn"]): void {
    this.providers.push({ name, enabled, callFn });
    this.stats.set(name, { successes: 0, failures: 0, avgLatencyMs: 0 });
  }

  /**
   * Call the best available LLM. Cascades through providers in priority order.
   * On success, the winning provider is promoted for future calls.
   */
  async evaluate(pngBase64: string, prompt: string): Promise<LLMResult | null> {
    // Sort by success rate (descending), then by latency (ascending)
    const sorted = this.getEnabledProviders();

    for (const provider of sorted) {
      try {
        console.log(`[llm-router] Trying ${provider.name}...`);
        const result = await Promise.race([
          provider.callFn(pngBase64, prompt),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout (30s)")), 30_000),
          ),
        ]);

        // Track success
        const s = this.stats.get(provider.name)!;
        s.successes++;
        s.avgLatencyMs = s.avgLatencyMs === 0
          ? result.latencyMs
          : s.avgLatencyMs * 0.7 + result.latencyMs * 0.3; // exponential moving average

        console.log(
          `[llm-router] ✓ ${provider.name} responded in ${result.latencyMs}ms (score: ${result.score})`,
        );
        return result;
      } catch (err: unknown) {
        const s = this.stats.get(provider.name)!;
        s.failures++;

        console.warn(
          `[llm-router] ✗ ${provider.name} failed: ${(err as Error).message?.slice(0, 200)}`,
        );
      }
    }

    console.error("[llm-router] All providers exhausted.");
    return null;
  }

  private getEnabledProviders(): ProviderConfig[] {
    const enabled = this.providers.filter(p => p.enabled);

    // Sort: highest success-rate first, then lowest latency
    return enabled.sort((a, b) => {
      const sa = this.stats.get(a.name)!;
      const sb = this.stats.get(b.name)!;

      const rateA = sa.successes + sa.failures > 0
        ? sa.successes / (sa.successes + sa.failures)
        : 0.5; // untested providers get a neutral score
      const rateB = sb.successes + sb.failures > 0
        ? sb.successes / (sb.successes + sb.failures)
        : 0.5;

      if (rateA !== rateB) return rateB - rateA; // higher success rate first
      return (sa.avgLatencyMs || 99999) - (sb.avgLatencyMs || 99999); // lower latency first
    });
  }

  /** Prints a summary of provider stats */
  printStats(): void {
    console.log("\n[llm-router] Provider stats:");
    for (const [name, s] of this.stats.entries()) {
      const total = s.successes + s.failures;
      const rate = total > 0 ? ((s.successes / total) * 100).toFixed(0) : "N/A";
      console.log(
        `  ${name}: ${s.successes}/${total} success (${rate}%), avg latency: ${Math.round(s.avgLatencyMs)}ms`,
      );
    }
    console.log();
  }
}
