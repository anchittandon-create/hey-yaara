/**
 * api/chat.ts
 *
 * Secure Proxy using GROQ (Llama 3.3 70B).
 *
 * v3.0 FIXES:
 * - Proper system/user role handling (system triggers stay as system role)
 * - Better instruction that allows Hinglish without forced ASCII
 * - Temperature tuned for more relevant, less hallucinatory responses
 * - Proper error status propagation
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
    
    // 1. EXTRACT & RESTRUCTURE MESSAGES
    // Separate system messages from conversation messages
    const systemMessages = messages.filter((m: any) => m.role === "system");
    const conversationMessages = messages.filter((m: any) => m.role !== "system");
    
    // Combine all system instructions into one coherent system message
    const baseSystemPrompt = systemMessages.map((m: any) => m.content).join("\n\n") 
      || body.systemInstruction 
      || "You are Yaara, a friendly voice agent.";

    // Refined instruction — allows Hinglish, focuses on response quality
    const FINAL_INSTRUCTION = `

CRITICAL OUTPUT RULES:
- Write in Roman English script (A-Z alphabet). You may use Hindi words in Roman script (Hinglish) like "kya haal hai", "bahut accha".
- Keep responses to 1-2 short sentences. Be concise and conversational.
- Be spontaneous, warm, and human-like. Sound like a real phone call.
- DO NOT repeat back what the user said. Always add new meaning.
- If you are unsure about something, ask a brief clarification question.
- NEVER hallucinate or make up facts.`;

    // 2. CALL GROQ with refined parameters
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
                    ...conversationMessages.slice(-10) // Keep last 10 conversation messages for context
                ],
                temperature: 0.7,   // Lowered from 0.8 — less random, more relevant
                max_tokens: 200,    // Lowered from 256 — forces concise answers
                top_p: 0.9,         // Focus on higher-probability tokens
                frequency_penalty: 0.3, // Discourage repetitive responses
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
        
        const errStatus = groqResp.status;
        const errText = await groqResp.text();
        
        // Differentiate error types for the client
        if (errStatus === 429) {
          return new Response(JSON.stringify({ error: "Rate limit reached. Please wait a moment.", details: errText }), { 
            status: 429, 
            headers: jsonHeaders 
          });
        }
        
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
