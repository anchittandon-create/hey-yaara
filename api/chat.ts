import { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * api/chat.ts
 *
 * Final Resilience Layer with Diagnostic Passthrough.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // KEY CHECK: Prioritize GEMINI_API_KEY then VITE_ version
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "AIzaSyAsBjO93qjzt7k7ZMTmGKWQ-do-mvAEqiI";
  const groqKey = process.env.GROQ_API_KEY || "gsk_6u7nHcB7KvXgY9ZbF4WdE8RtY5UoI2pL3QmN6PqSjF0aDcVbKx";

  const { systemInstruction, contents, messages } = req.body;

  const FINAL_INSTRUCTION = "\n\nCRITICAL: ALWAYS RESPOND IN ROMAN ENGLISH SCRIPT (A-Z) ONLY. NEVER USE DEVANAGARI. 1-2 SENTENCES. TALK LIKE A FRIEND ON A CALL.";

  try {
    // Attempt 1: Gemini
    const geminiResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: (systemInstruction || "") + FINAL_INSTRUCTION }] },
        contents: contents || [],
        generationConfig: { temperature: 0.7, maxOutputTokens: 512 }
      }),
    });

    if (geminiResp.ok) {
      const gData = await geminiResp.json();
      const outputTxt = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (outputTxt) return res.status(200).json({ text: outputTxt });
    }

    // Attempt 2: Groq Fallback
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
        max_tokens: 512
      }),
    });

    if (groqResp.ok) {
      const groqData = await groqResp.json();
      const contentText = groqData?.choices?.[0]?.message?.content;
      if (contentText) return res.status(200).json({ text: contentText });
    }

    // Both failed
    return res.status(500).json({ 
       error: "Connectivity issues. Please refresh and try again.", 
       diagnostic: `GStatus: ${geminiResp.status}, QStatus: ${groqResp.status}` 
    });

  } catch (err) {
    console.error("[Yaara-API] Fatal:", err);
    return res.status(500).json({ error: "Network error in backend. Please check connection." });
  }
}
