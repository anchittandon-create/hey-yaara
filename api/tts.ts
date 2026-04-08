/**
 * api/tts.ts
 * 
 * Multi-Provider TTS Proxy.
 * Priority: OpenAI Nova (Best for Hinglish/Flow) -> Google Wavenet -> Browser Fallback.
 */

export const config = {
    runtime: 'edge',
};

export default async function (req: Request) {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    // Prefer OpenAI for "Fluent Flowing" Indian Voice
    const openaiKey = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    const googleKey = process.env.VITE_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    try {
        const { text, gender = "FEMALE" } = await req.json();

        // 1. TRY OPENAI (Premium Sound)
        if (openaiKey) {
            try {
                const oaResp = await fetch("https://api.openai.com/v1/audio/speech", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${openaiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: "tts-1",
                        voice: gender === "MALE" ? "onyx" : "nova", // Nova is very fluent
                        input: text,
                    }),
                });

                if (oaResp.ok) {
                    const blob = await oaResp.arrayBuffer();
                    const base64 = btoa(String.fromCharCode(...new Uint8Array(blob)));
                    return new Response(JSON.stringify({ audioContent: base64, provider: "openai" }), {
                        headers: { "Content-Type": "application/json" }
                    });
                }
            } catch (e) { console.warn("OpenAI TTS Failed, falling back...", e); }
        }

        // 2. TRY GOOGLE (Professional Indian Accents)
        if (googleKey) {
            const googleUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleKey}`;
            const gBody = {
                input: { text },
                voice: {
                    languageCode: "en-IN",
                    name: gender === "MALE" ? "en-IN-Wavenet-B" : "en-IN-Wavenet-A",
                },
                audioConfig: { audioEncoding: "MP3" },
            };

            const gResp = await fetch(googleUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(gBody),
            });

            if (gResp.ok) {
                const data = await gResp.json();
                return new Response(JSON.stringify({ audioContent: data.audioContent, provider: "google" }), {
                    headers: { "Content-Type": "application/json" }
                });
            }
        }

        // 3. NO PROVIDER CONFIGURED
        return new Response(JSON.stringify({ error: "No TTS providers configured. Use fallback." }), { status: 404 });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
