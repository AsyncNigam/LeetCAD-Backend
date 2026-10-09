const fetch = require('node-fetch') || globalThis.fetch;
require('dotenv').config();

async function test() {
  const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const metricsPrompt = "test";
  const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:8080",
      "X-Title": "LeetCAD"
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: metricsPrompt + "\n\nProvide the response as a JSON object with 'aiScore' (number 0-40) and 'reportMarkdown' (string)." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${pngBase64}` } }
          ]
        }
      ]
    }),
  });
  
  if (openRouterRes.ok) {
    const data = await openRouterRes.json();
    console.log("SUCCESS:", JSON.stringify(data, null, 2));
  } else {
    const errText = await openRouterRes.text();
    console.error(`ERROR: ${openRouterRes.status} ${openRouterRes.statusText}`, errText);
  }
}
test();
