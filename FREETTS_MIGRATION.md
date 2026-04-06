# Free TTS/STT Migration Guide

## What Changed

We've replaced the paid ElevenLabs API with completely free alternatives:

- **Text-to-Speech (TTS)**: Now uses Web Speech API (built-in to browsers, free)
- **Speech-to-Text (STT)**: Now uses Web Speech API (built-in to browsers, free)
- **Conversational AI**: Uses free LLM APIs (Groq or HuggingFace)

## Benefits

✅ **No API costs** - Web Speech API is free and built into all modern browsers
✅ **Faster** - No external API calls for TTS/STT
✅ **Privacy-friendly** - Speech processing happens locally
✅ **Open-source ready** - Can self-host LLM if needed

## Setup

### 1. Get a Free LLM API Key

**Option A: Groq (Recommended)**
- Visit: https://console.groq.com
- Sign up for free account
- Create API key
- Add to `.env`:
  ```
  VITE_LLM_PROVIDER=groq
  VITE_LLM_API_KEY=your_key_here
  ```

**Option B: HuggingFace**
- Visit: https://huggingface.co/settings/tokens
- Create API token
- Add to `.env`:
  ```
  VITE_LLM_PROVIDER=huggingface
  VITE_LLM_API_KEY=your_key_here
  ```

### 2. No More ElevenLabs Setup Needed

Delete or ignore these:
- `VITE_ELEVENLABS_AGENT_ID` environment variable
- The `supabase/functions/elevenlabs-signed-url/` directory (no longer needed)

### 3. Browser Requirements

The Web Speech API requires:
- Chrome/Chromium 25+
- Edge 79+
- Safari 14.1+
- Firefox 25+ (with flag enabled)

## Testing

Start the app:
```bash
npm run dev
```

Click "Call Yaara" and speak! The app will:
1. Listen to your voice using Web Speech API
2. Send text to Groq/HuggingFace for AI response
3. Speak the response back using Web Speech API

## Troubleshooting

**"Speech Recognition API not supported"**
- Update your browser to the latest version

**"LLM API not configured"**
- Add `VITE_LLM_API_KEY` to your `.env` file
- Restart the dev server

**"No API response"**
- Check your LLM API key is valid
- Ensure your quota isn't exhausted on the free tier

## Cost Comparison

| Feature | ElevenLabs | New Setup |
|---------|-----------|-----------|
| TTS | Paid (~$0.03/1k chars) | **Free** |
| STT | Not included | **Free** |
| Conversation AI | Not included | **Free tier available** |
| **Monthly Cost** | **$20-100+** | **$0 (or $5-10 for Groq)** |

## Future Options

If you need more advanced features:
- Self-host local LLM using Ollama
- Upgrade to paid LLM API for better quality
- Integrate custom speech synthesis models

For questions or issues, check the app configuration in `.env.example`
