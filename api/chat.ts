/**
 * api/chat.ts
 *
 * Secure Proxy with Edge Runtime, Absolute Resilience, and Key Sync Failsafe.
 */

export const config = {
  runtime: 'edge',
};

export default async function (req: Request) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  // FALLBACK CHAIN: 
  // 1. Process.env (Vercel)
  // 2. High-performance hardcoded backup (to bypass stuck Vercel sync)
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "AIzaSyAsBjO93qjzt7k7ZMTmGKWQ-do-mvAEqiI";
  const groqKey = process.env.GROQ_API_KEY || "gsk_6u7nHcB7KvXgY9ZbF4WdE8RtY5UoI2pL3QmN6PqSjF0aDcVbKx";

  try {
    const { systemInstruction, contents, messages } = await req.json();

    const FINAL_INSTRUCTION = "\n\nCRITICAL: ALWAYS RESPOND IN ROMAN ENGLISH SCRIPT (A-Z) ONLY. 1-2 SENTENCES. FRIENDLY SPONTANEOUS TONE.";

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
        const text = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return new Response(JSON.stringify({ text }), { status: 200 });
    }

    // Stage 2: GROQ
    const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: (messages || []).map((m: any) => ({
          role: m.role,
          content: m.role === "system" ? m.content + FINAL_INSTRUCTION : m.content
        })),
        temperature: 0.7,
        max_tokens: 256
      }),
    });

    if (groqResp.ok) {
        const groqData = await groqResp.json();
        const textArea = groqData?.choices?.[0]?.message?.content;
        if (textArea) return new Response(JSON.stringify({ text: textArea }), { status: 200 });
    }

    return new Response(JSON.stringify({ 
        error: "AI Providers failed. Please check keys.", 
        diagnostic: `GStatus: ${geminiResp.status}` 
    }), { status: 500 });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Edge Proxy Error. Please refresh." }), { status: 500 });
  }
}
