import { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * api/chat.ts
 *
 * Secure server-side proxy for Gemini API calls.
 * This prevents the API key from being exposed to the browser.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Pick the key safely from environment (Server-side only)
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!geminiKey) {
    return res.status(500).json({ error: "API Key not configured on server" });
  }

  try {
    const { systemInstruction, contents, generationConfig } = req.body;

    const googleResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: generationConfig || { temperature: 0.7, maxOutputTokens: 512 }
        }),
      }
    );

    const data = await googleResp.json();

    if (!googleResp.ok) {
      console.error("[Backend-Gemini] Error:", data);
      return res.status(googleResp.status).json(data);
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error("[Backend-Chat] Fatal:", error);
    return res.status(500).json({ error: "Failed to communicate with AI provider" });
  }
}
