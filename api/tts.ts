/**
 * api/tts.ts
 * 
 * TTS Proxy with strict profile-voice fidelity.
 * Uses explicit gender-controlled voices only.
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

    // Use only explicit gender-controlled provider paths.
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

        return new Response(JSON.stringify({ error: "No exact gender-controlled voice engine available." }), { status: 503 });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown TTS error";
        return new Response(JSON.stringify({ error: message }), { status: 500 });
    }
}
