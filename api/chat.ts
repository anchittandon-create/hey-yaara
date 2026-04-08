/**
 * api/chat.ts
 *
 * Secure Proxy using GROQ (Llama 3.3 70B).
 * Fixed to include CORRECT Content-Type headers for frontend parsing.
 */

export const config = {
  runtime: 'edge',
};

export default async function (req: Request) {
  const jsonHeaders = { "Content-Type": "application/json" };
  
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { 
      status: 405, 
      headers: jsonHeaders 
    });
  }

  const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;

  if (!groqKey) {
    return new Response(JSON.stringify({ error: "No Groq API key configured." }), { 
        status: 500, 
        headers: jsonHeaders 
    });
  }

  try {
    const body = await req.json();
    const messages = body.messages || [];
    
    // 1. EXTRACT PROMPT
    const sysMsg = messages.find((m: any) => m.role === "system");
    const userMessages = messages.filter((m: any) => m.role !== "system");
    
    const baseSystemPrompt = sysMsg?.content || body.systemInstruction || "You are Yaara, a friendly voice agent.";
    const FINAL_INSTRUCTION = "\n\nCRITICAL: RESPOND IN ROMAN ENGLISH SCRIPT (A-Z) ONLY. 1-2 SHORT SENTENCES. BE SPONTANEOUS AND WARM.";

    // 2. CALL GROQ
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
            if (text) return new Response(JSON.stringify({ text }), { 
                status: 200, 
                headers: jsonHeaders 
            });
        }
        
        const errText = await groqResp.text();
        return new Response(JSON.stringify({ error: "Groq provider error", details: errText }), { 
            status: 502, 
            headers: jsonHeaders 
        });

    } catch(e) {
        return new Response(JSON.stringify({ error: "Network error calling AI provider" }), { 
            status: 503, 
            headers: jsonHeaders 
        });
    }

  } catch (err) {
    return new Response(JSON.stringify({ error: "Context processing error." }), { 
        status: 500, 
        headers: jsonHeaders 
    });
  }
}
