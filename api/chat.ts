/**
 * api/chat.ts
 *
 * Secure Proxy with Edge Runtime, Absolute Resilience, and Human-First Greeting Protocol.
 */

export const config = {
  runtime: 'edge',
};

export default async function (req: Request) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  // FALLBACK CHAIN: 
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "AIzaSyAsBjO93qjzt7k7ZMTmGKWQ-do-mvAEqiI";
  const groqKey = process.env.GROQ_API_KEY || "gsk_6u7nHcB7KvXgY9ZbF4WdE8RtY5UoI2pL3QmN6PqSjF0aDcVbKx";

  try {
    const body = await req.json();
    const messages = body.messages || [];
    
    // 1. EXTRACT SYSTEM PROMPT (Gemini Requirement)
    const sysMsg = messages.find((m: any) => m.role === "system");
    const userMessages = messages.filter((m: any) => m.role !== "system");
    
    const baseSystemPrompt = sysMsg?.content || body.systemInstruction || "You are Yaara, a friendly voice agent.";
    const FINAL_INSTRUCTION = "\n\nCRITICAL: RESPOND IN ROMAN ENGLISH SCRIPT (A-Z) ONLY. 1-2 SHORT SENTENCES. BE SPONTANEOUS AND WARM.";

    // 2. STAGE 1: GEMINI
    try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiKey}`;
        const geminiResp = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: baseSystemPrompt + FINAL_INSTRUCTION }] },
                contents: userMessages.map((m: any) => ({
                    role: m.role === "assistant" ? "model" : "user",
                    parts: [{ text: m.content }]
                })),
                generationConfig: { temperature: 0.8, maxOutputTokens: 256 }
            }),
        });

        if (geminiResp.ok) {
            const gData = await geminiResp.json();
            const text = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) return new Response(JSON.stringify({ text }), { status: 200 });
        }
        console.error(`[AI] Gemini Failed: ${geminiResp.status}`);
    } catch(e) {
        console.error("[AI] Gemini Fetch Error", e);
    }

    // 3. STAGE 2: GROQ (FAILOVER)
    try {
        const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${groqKey}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: baseSystemPrompt + FINAL_INSTRUCTION },
                    ...userMessages.slice(-6)
                ],
                temperature: 0.8,
                max_tokens: 256
            }),
        });

        if (groqResp.ok) {
            const groqData = await groqResp.json();
            const textArea = groqData?.choices?.[0]?.message?.content;
            if (textArea) return new Response(JSON.stringify({ text: textArea }), { status: 200 });
        }
        console.error(`[AI] Groq Failed: ${groqResp.status}`);
    } catch(e) {
        console.error("[AI] Groq Fetch Error", e);
    }

    return new Response(JSON.stringify({ 
        error: "Connectivity issues with AI providers. Please check your network or API keys.", 
    }), { status: 500 });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Context processing error. Please refresh." }), { status: 500 });
  }
}
