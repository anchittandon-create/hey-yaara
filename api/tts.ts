/**
 * api/tts.ts
 * 
 * Multi-Provider TTS Proxy.
 * Leads with Groq (for intelligence) + Premium Voices (OpenAI/Google) for fluency.
 */

export const config = {
    runtime: 'edge',
};

export default async function (req: Request) {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    // API Priority: OpenAI -> Google -> Fallback
    const openaiKey = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    const googleKey = process.env.VITE_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    try {
        const { text, gender = "FEMALE" } = await req.json();

        // 1. TRY OPENAI (Premium 'Smooth' Voice)
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
                        voice: gender === "MALE" ? "onyx" : "shimmer", // Shimmer is gentle and fluent
                        input: text,
                        speed: 1.05
                    }),
                });

                if (oaResp.ok) {
                    const blob = await oaResp.arrayBuffer();
                    const base64 = btoa(String.fromCharCode(...new Uint8Array(blob)));
                    return new Response(JSON.stringify({ audioContent: base64, provider: "openai" }), {
                        headers: { "Content-Type": "application/json" }
                    });
                }
            } catch (e) { console.warn("OpenAI Failed:", e); }
        }

        // 2. TRY GOOGLE (Natural Indian Female/Male)
        if (googleKey) {
            const googleUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleKey}`;
            const gBody = {
                input: { text },
                voice: {
                    languageCode: "en-IN",
                    // Wavenet-D is the most natural 'Fluent Indian Female'
                    name: gender === "MALE" ? "en-IN-Wavenet-B" : "en-IN-Wavenet-D", 
                },
                audioConfig: { 
                    audioEncoding: "MP3",
                    pitch: 0,
                    speakingRate: 1.1 // Slightly faster for spontaneous feel
                },
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

        return new Response(JSON.stringify({ error: "No Voice Engine ready." }), { status: 404 });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
