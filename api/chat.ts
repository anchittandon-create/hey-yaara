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

  // Pick the keys safely from environment (Server-side only)
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY || "gsk_6u7nHcB7KvXgY9ZbF4WdE8RtY5UoI2pL3QmN6PqSjF0aDcVbKx";

  if (!geminiKey) {
    return res.status(500).json({ error: "API Key not configured on server" });
  }

  const { systemInstruction, contents, generationConfig, messages } = req.body;

  try {
    // Attempt 1: Gemini
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

    if (googleResp.ok) {
      const data = await googleResp.json();
      return res.status(200).json(data);
    }

    throw new Error(`Gemini failed with ${googleResp.status}`);

  } catch (error) {
    console.warn("[Backend-Chat] Gemini failed, trying Groq fallback...", error);
    
    // Attempt 2: Groq Fallback (Using server-side key)
    try {
      const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages,
          temperature: 0.7,
          response_format: { type: "json_object" }
        }),
      });

      if (groqResp.ok) {
        const data = await groqResp.json();
        // Return in a unified format or return Groq raw (I'll map it to Gemini-like if needed but easier to just return)
        return res.status(200).json({
          candidates: [{ 
            content: { parts: [{ text: data?.choices?.[0]?.message?.content }] } 
          }]
        });
      }
    } catch (groqErr) {
      console.error("[Backend-Chat] Fatal: All providers failed", groqErr);
    }

    return res.status(500).json({ error: "Failed to communicate with AI providers" });
  }
}
