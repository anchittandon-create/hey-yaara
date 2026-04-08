/**
 * api/chat.ts
 *
 * Secure Proxy using GROQ (Llama 3.3 70B) as the Lead Driver.
 * Optimized for Human-First Greeting and Roman Scripts.
 */

export const config = {
  runtime: 'edge',
};

export default async function (req: Request) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;

  try {
    const body = await req.json();
    const messages = body.messages || [];
    
    // 1. EXTRACT PROMPT
    const sysMsg = messages.find((m: any) => m.role === "system");
    const userMessages = messages.filter((m: any) => m.role !== "system");
    
    const baseSystemPrompt = sysMsg?.content || body.systemInstruction || "You are Yaara, a friendly voice agent.";
    const FINAL_INSTRUCTION = "\n\nCRITICAL: RESPOND IN ROMAN ENGLISH SCRIPT (A-Z) ONLY. NEVER USE REGIONAL SCRIPTS. 1-2 SHORT SENTENCES. BE SPONTANEOUS AND WARM.";

    // 2. CALL GROQ (Primary Brain)
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
            const text = groqData?.choices?.[0]?.message?.content;
            if (text) return new Response(JSON.stringify({ text }), { status: 200 });
        }
        
        const errText = await groqResp.text();
        console.error(`[AI] Groq Failed Status: ${groqResp.status}`, errText);
    } catch(e) {
        console.error("[AI] Groq Fetch Error", e);
    }

    return new Response(JSON.stringify({ 
        error: "Brain connection lost. Please check your Groq API key or network.", 
    }), { status: 500 });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Context processing error. Please refresh." }), { status: 500 });
  }
}
