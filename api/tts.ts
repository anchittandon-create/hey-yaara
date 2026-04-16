/**
 * api/tts.ts
 * 
 * HuggingFace-backed TTS Proxy (free alternative to ElevenLabs).
 * Keeps API key server-side so it never reaches the client.
 */

export const config = {
    runtime: 'edge',
};

type TtsRequest = {
    text?: string;
    gender?: "FEMALE" | "MALE";
    voiceId?: string;
};

const HF_API_URL = "https://api-inference.huggingface.co/models/facebook/fastspeech2_en-male_english";
const HF_VOICE_URLS = {
    FEMALE: "https://api-inference.huggingface.co/models/facebook/fastspeech2_en-female_english",
    MALE: "https://api-inference.huggingface.co/models/facebook/fastspeech2_en-male_english",
};

const TTS_TIMEOUT_MS = 15000;

const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });

export default async function (req: Request) {
    if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const hfKey = process.env.HUGGINGFACE_API_KEY || process.env.VITE_HUGGINGFACE_API_KEY;

    if (!hfKey) {
        return jsonResponse({ error: "HuggingFace API key is not configured." }, 503);
    }

    try {
        const { text = "", gender = "FEMALE", voiceId } = (await req.json()) as TtsRequest;
        let cleanText = text.trim();

        if (!cleanText) {
            return jsonResponse({ error: "Text is required." }, 400);
        }

        // Truncate very long text
        if (cleanText.length > 500) {
            cleanText = cleanText.slice(0, 500);
        }

        // Use voiceId if provided, otherwise use gender-based model
        const modelUrl = voiceId?.trim() 
            ? `https://api-inference.huggingface.co/models/${voiceId}`
            : HF_VOICE_URLS[gender] || HF_VOICE_URLS.FEMALE;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

        try {
            const response = await fetch(modelUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${hfKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    inputs: cleanText,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const audioBuffer = await response.arrayBuffer();

                if (audioBuffer.byteLength < 100) {
                    return jsonResponse({ error: "HuggingFace returned empty audio" }, 502);
                }

                // Convert to base64
                const bytes = new Uint8Array(audioBuffer);
                let binary = "";
                const chunkSize = 8192;
                for (let i = 0; i < bytes.length; i += chunkSize) {
                    const chunk = bytes.subarray(i, i + chunkSize);
                    binary += String.fromCharCode(...chunk);
                }
                const base64 = btoa(binary);

                return jsonResponse({ audioContent: base64, provider: "huggingface" });
            }

            const errStatus = response.status;
            const details = await response.text().catch(() => "Unknown error");

            if (errStatus === 429) {
                return jsonResponse({ error: "TTS rate limit reached. Please wait.", details }, 429);
            }

            return jsonResponse({ error: "HuggingFace provider error", details }, 502);

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