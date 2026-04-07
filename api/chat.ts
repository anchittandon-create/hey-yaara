import { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * api/chat.ts
 *
 * Secure Proxy with Absolute Resilience and Roman Script Enforcement.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY || "gsk_6u7nHcB7KvXgY9ZbF4WdE8RtY5UoI2pL3QmN6PqSjF0aDcVbKx";

  if (!geminiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY missing on Vercel dashboard." });
  }

  const { systemInstruction, contents, messages } = req.body;

  // Final Roman Script Enforcement
  const FINAL_INSTRUCTION = "\n\nCRITICAL: ALWAYS RESPOND IN ROMAN ENGLISH SCRIPT (A-Z) ONLY. 1-2 SENTENCES. FRIENDLY SPONTANEOUS TONE.";

  try {
    // Stage 1: GEMINI
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiKey}`;
    const geminiResp = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: (systemInstruction || "") + FINAL_INSTRUCTION }] },
        contents: contents || [],
        generationConfig: { temperature: 0.7, maxOutputTokens: 256 }
      }),
    });

    if (geminiResp.ok) {
      const gData = await geminiResp.json();
      const outputTxt = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (outputTxt) {
        return res.status(200).json({ text: outputTxt });
      }
    }

    throw new Error(`Gemini status ${geminiResp.status}`);

  } catch (err) {
    console.warn("[Yaara-API] Attempt 1 (Gemini) failed. Trying fallback...", err);

    // Stage 2: GROQ
    try {
      const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: (messages || []).map((m: any) => ({
            role: m.role === "assistant" ? "assistant" : m.role,
            content: m.role === "system" ? m.content + FINAL_INSTRUCTION : m.content
          })),
          temperature: 0.7,
          max_tokens: 256
        }),
      });

      if (groqResp.ok) {
        const groqData = await groqResp.json();
        const contentText = groqData?.choices?.[0]?.message?.content;
        if (contentText) {
           return res.status(200).json({ text: contentText });
        }
      }
    } catch (gErr) {
      console.error("[Yaara-API] Fallback failed:", gErr);
    }

    return res.status(500).json({ 
       error: "Connection unstable. AI providers unreachable.", 
       details: String(err)
    });
  }
}
