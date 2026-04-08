/**
 * api/tts.ts
 * 
 * Multi-Provider TTS Proxy.
 * Leads with premium voices while preferring explicit gender-controlled output when available.
 */

export const config = {
    runtime: 'edge',
};

type TtsRequest = {
    text?: string;
    gender?: "FEMALE" | "MALE";
};

const escapeForSsml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

export default async function (req: Request) {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    // API Priority: Google -> OpenAI -> Fallback
    const openaiKey = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    const googleKey = process.env.VITE_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    try {
        const { text = "", gender = "FEMALE" } = (await req.json()) as TtsRequest;
        const cleanText = text.trim();

        if (!cleanText) {
            return new Response(JSON.stringify({ error: "Text is required." }), { status: 400 });
        }

        if (googleKey) {
            const googleUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleKey}`;
            const ssmlText = escapeForSsml(cleanText);
            const gBody = {
                input: {
                    ssml: `<speak><prosody rate="96%" pitch="${gender === "MALE" ? "-2st" : "+1st"}">${ssmlText}</prosody></speak>`,
                },
                voice: {
                    languageCode: "en-IN",
                    name: gender === "MALE" ? "en-IN-Wavenet-B" : "en-IN-Wavenet-D",
                    ssmlGender: gender,
                },
                audioConfig: {
                    audioEncoding: "MP3",
                    pitch: gender === "MALE" ? -2.5 : 1.2,
                    speakingRate: 0.96,
                    effectsProfileId: ["small-bluetooth-speaker-class-device"],
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

        const openAiVoice = gender === "MALE" ? "cedar" : "marin";
        const speechInstructions =
            gender === "MALE"
                ? "Speak like a warm, clearly male Indian companion on a real phone call. Sound natural, emotionally responsive, and reassuring. Use subtle pauses, gentle emphasis, and realistic conversational flow."
                : "Speak like a warm, clearly female Indian companion on a real phone call. Sound natural, emotionally responsive, and reassuring. Use subtle pauses, gentle emphasis, and realistic conversational flow.";

        if (openaiKey) {
            try {
                const oaResp = await fetch("https://api.openai.com/v1/audio/speech", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${openaiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: "gpt-4o-mini-tts",
                        voice: openAiVoice,
                        input: cleanText,
                        instructions: speechInstructions,
                        response_format: "mp3",
                        speed: 0.95,
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

        return new Response(JSON.stringify({ error: "No Voice Engine ready." }), { status: 404 });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown TTS error";
        return new Response(JSON.stringify({ error: message }), { status: 500 });
    }
}
