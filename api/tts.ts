/**
 * api/tts.ts
 * 
 * Proxy for Google Cloud Text-to-Speech.
 * Converts text to MP3 audio using the GEMINI_API_KEY project.
 */

export const config = {
    runtime: 'edge',
};

export default async function (req: Request) {
    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY for TTS." }), { status: 500 });
    }

    try {
        const { text, gender = "FEMALE" } = await req.json();
        
        const googleUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
        
        const body = {
            input: { text },
            voice: {
                languageCode: "en-IN",
                name: gender === "MALE" ? "en-IN-Wavenet-B" : "en-IN-Wavenet-A", // Professional Indian voices
            },
            audioConfig: {
                audioEncoding: "MP3",
            },
        };

        const response = await fetch(googleUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Google TTS Error: ${err}`);
        }

        const data = await response.json();
        return new Response(JSON.stringify({ audioContent: data.audioContent }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
