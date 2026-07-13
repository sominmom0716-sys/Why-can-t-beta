export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const { system, messages, max_tokens } = req.body;
    const history = messages.map(m =>
      (m.role === "user" ? "User: " : "Assistant: ") +
      (typeof m.content === "string" ? m.content : JSON.stringify(m.content))
    ).join("\n");

    const prompt = system ? system + "\n\n" + history : history;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: max_tokens || 1000, temperature: 0.7 },
        }),
      }
    );

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    res.status(200).json({
      content: [{ type: "text", text }]
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
