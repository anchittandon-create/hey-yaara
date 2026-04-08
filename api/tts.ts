/**
 * api/tts.ts
 * 
 * ElevenLabs-backed TTS Proxy.
 * Keeps voice generation server-side so the API key never reaches the client.
 */

export const config = {
    runtime: 'edge',
};

type TtsRequest = {
    text?: string;
    gender?: "FEMALE" | "MALE";
    voiceId?: string;
};

const ELEVENLABS_VOICE_IDS = {
    FEMALE: "21m00Tcm4TlvDq8ikWAM",
    MALE: "pNInz6obpgDQGcFmaJgB",
} as const;

export default async function (req: Request) {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

    try {
        const { text = "", gender = "FEMALE", voiceId } = (await req.json()) as TtsRequest;
        const cleanText = text.trim();

        if (!cleanText) {
            return new Response(JSON.stringify({ error: "Text is required." }), { status: 400 });
        }

        if (!elevenLabsKey) {
            return new Response(JSON.stringify({ error: "ElevenLabs API key is not configured." }), { status: 503 });
        }

        const selectedVoiceId = voiceId?.trim() || ELEVENLABS_VOICE_IDS[gender];
        const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`;
        const response = await fetch(elevenLabsUrl, {
            method: "POST",
            headers: {
                "xi-api-key": elevenLabsKey,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            body: JSON.stringify({
                text: cleanText,
                model_id: "eleven_flash_v2_5",
                voice_settings: {
                    stability: gender === "MALE" ? 0.48 : 0.42,
                    similarity_boost: 0.86,
                    style: gender === "MALE" ? 0.18 : 0.28,
                    use_speaker_boost: true,
                    speed: 0.96,
                },
            }),
        });

        if (response.ok) {
            const audioBuffer = await response.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
            return new Response(JSON.stringify({ audioContent: base64, provider: "elevenlabs" }), {
                headers: { "Content-Type": "application/json" }
            });
        }

        const details = await response.text();
        return new Response(JSON.stringify({ error: "ElevenLabs provider error", details }), {
            status: 502,
            headers: { "Content-Type": "application/json" }
        });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown TTS error";
        return new Response(JSON.stringify({ error: message }), { status: 500 });
    }
}
