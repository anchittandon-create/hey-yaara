/**
 * api/tts.ts
 * 
 * ElevenLabs-backed TTS Proxy.
 * Keeps voice generation server-side so the API key never reaches the client.
 *
 * v3.0 FIXES:
 * - Proper timeout (8s) to prevent hanging requests on mobile
 * - Graceful large-text handling (truncate > 500 chars)
 * - Better error messages for client-side retry logic
 * - Consistent Content-Type headers on all responses
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

const TTS_TIMEOUT_MS = 8000; // 8 seconds — prevents hanging on slow connections

const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });

export default async function (req: Request) {
    if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

    if (!elevenLabsKey) {
        return jsonResponse({ error: "ElevenLabs API key is not configured." }, 503);
    }

    try {
        const { text = "", gender = "FEMALE", voiceId } = (await req.json()) as TtsRequest;
        let cleanText = text.trim();

        if (!cleanText) {
            return jsonResponse({ error: "Text is required." }, 400);
        }

        // Truncate very long text to prevent ElevenLabs timeouts
        // ElevenLabs Flash is optimized for short utterances
        if (cleanText.length > 500) {
            cleanText = cleanText.slice(0, 500);
        }

        const selectedVoiceId = voiceId?.trim() || ELEVENLABS_VOICE_IDS[gender] || ELEVENLABS_VOICE_IDS.FEMALE;
        const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`;

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

        try {
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
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const audioBuffer = await response.arrayBuffer();

                if (audioBuffer.byteLength < 100) {
                    return jsonResponse({ error: "ElevenLabs returned empty audio" }, 502);
                }

                // Convert to base64 — using chunked approach for large buffers
                const bytes = new Uint8Array(audioBuffer);
                let binary = "";
                const chunkSize = 8192;
                for (let i = 0; i < bytes.length; i += chunkSize) {
                    const chunk = bytes.subarray(i, i + chunkSize);
                    binary += String.fromCharCode(...chunk);
                }
                const base64 = btoa(binary);

                return jsonResponse({ audioContent: base64, provider: "elevenlabs" });
            }

            const errStatus = response.status;
            const details = await response.text().catch(() => "Unknown error");

            // Differentiate rate-limit vs other errors for client retry logic
            if (errStatus === 429) {
                return jsonResponse({ error: "TTS rate limit reached. Please wait.", details }, 429);
            }

            return jsonResponse({ error: "ElevenLabs provider error", details }, 502);

        } catch (fetchErr: unknown) {
            clearTimeout(timeoutId);
            
            if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
                return jsonResponse({ error: "TTS request timed out" }, 504);
            }
            throw fetchErr;
        }

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown TTS error";
        return jsonResponse({ error: message }, 500);
    }
}
