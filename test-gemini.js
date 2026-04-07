const apiKey = "AIzaSyA_6wJREDKfPND2_kJRyV0FDx9FSGqvgWk";
const payloadMessages = [{role: "system", content: "You are a friendly bot"}, {role: "user", content: "hello"}];

async function run() {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: payloadMessages.map(m => m.role + ": " + m.content).join("\n\n") }] }
      ],
      generationConfig: {
        maxOutputTokens: 256,
        temperature: 0.9,
      }
    }),
  });

  const result = await response.text();
  console.log(response.status);
  console.log(result);
}
run();
