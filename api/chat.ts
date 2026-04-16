/**
 * api/chat.ts
 *
 * Secure Proxy supporting both GROQ (Llama) and Gemini.
 * Uses whichever API key is configured.
 *
 * v4.0 FIXES:
 * - Supports both Groq and Gemini backends
 * - Auto-detects available API key
 * - Better error handling
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
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  try {
    const body = await req.json();
    const messages = body.messages || [];
    
    const systemMessages = messages.filter((m: any) => m.role === "system");
    const conversationMessages = messages.filter((m: any) => m.role !== "system");
    
    const baseSystemPrompt = systemMessages.map((m: any) => m.content).join("\n\n") 
      || body.systemInstruction 
      || "You are Yaara, a friendly voice agent.";

    const FINAL_INSTRUCTION = `
CRITICAL OUTPUT RULES:
- Write in Roman English script (A-Z alphabet). You may use Hindi words in Roman script (Hinglish) like "kya haal hai", "bahut accha".
- Keep responses to 1-2 short sentences. Be concise and conversational.
- Be spontaneous, warm, and human-like. Sound like a real phone call.
- DO NOT repeat back what the user said. Always add new meaning.
- If you are unsure about something, ask a brief clarification question.
- NEVER hallucinate or make up facts.`;

    if (groqKey) {
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
              ...conversationMessages.slice(-10)
            ],
            temperature: 0.7,
            max_tokens: 200,
            top_p: 0.9,
            frequency_penalty: 0.3,
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
        
        if (errStatus === 429) {
          return new Response(JSON.stringify({ error: "Rate limit reached. Please wait.", details: errText }), { 
            status: 429, 
            headers: jsonHeaders 
          });
        }
        
        console.error("[API] Groq error:", errStatus, errText);
      } catch (groqErr) {
        console.error("[API] Groq call failed:", groqErr);
      }
    }

    if (geminiKey) {
      try {
        const geminiMessages = [
          { role: "user", parts: [{ text: baseSystemPrompt + FINAL_INSTRUCTION }] },
          ...conversationMessages.slice(-10).map((m: any) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }]
          }))
        ];

        const geminiResp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: geminiMessages,
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 200,
                topP: 0.9,
                topK: 40,
              }
            }),
          }
        );

        if (geminiResp.ok) {
          const geminiData = await geminiResp.json();
          const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return new Response(JSON.stringify({ text }), { 
            status: 200, 
            headers: jsonHeaders 
          });
        }
        
        const errStatus = geminiResp.status;
        const errText = await geminiResp.text();
        console.error("[API] Gemini error:", errStatus, errText);
        
        if (errStatus === 429) {
          return new Response(JSON.stringify({ error: "Gemini rate limit reached.", details: errText }), { 
            status: 429, 
            headers: jsonHeaders 
          });
        }
      } catch (geminiErr) {
        console.error("[API] Gemini call failed:", geminiErr);
      }
    }

    if (!groqKey && !geminiKey) {
      return new Response(JSON.stringify({ error: "No AI API key configured." }), { 
        status: 500, 
        headers: jsonHeaders 
      });
    }

    return new Response(JSON.stringify({ error: "AI provider error. Both backends failed." }), { 
      status: 502, 
      headers: jsonHeaders 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Context processing error." }), { 
      status: 500, 
      headers: jsonHeaders 
    });
  }
}
