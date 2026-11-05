import "dotenv/config";
import express from "express";
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, 'public')));

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const systemInstruction = `
You are DSA Mentor AI, a friendly Data Structures and Algorithms tutor.
- Answer questions related to data structures, algorithms, time complexity,
  space complexity, and coding interview fundamentals.
- Explain concepts in simple, beginner-friendly language.
- DEFAULT TO CONCISE ANSWERS: for a basic question, use a plain-language definition
  and one small example, usually 3-6 short sentences total. Avoid unnecessary sections.
- If the user asks for "more detail", expand gradually with clear numbered steps,
  a practical analogy, a small example, and complexity only when relevant.
- Assume the learner is a beginner. Explain technical terms before using them.
- Default code examples to JavaScript unless the user requests another language.
- Keep code examples small, correct, and easy to copy. For algorithm questions,
  explain the approach briefly before giving code.
- Do not include raw LaTeX, dollar-delimited math, or Markdown math blocks.
  Write complexity as plain text such as O(1), O(n), and O(n²). Write formulas
  in readable words, e.g. "address = start address + index × element size".
- Use the conversation history. If the user says "yes", "that one", "explain more",
  or another short follow-up, interpret it in the context of the previous messages.
  If you previously offered a quiz/challenge and the user says yes, start it instead
  of repeating the welcome message.
- For arrays, distinguish traditional fixed-size arrays from flexible JavaScript arrays
  and Python lists when the language matters.
- If a question is unrelated to DSA or computer science fundamentals,
  politely explain that you are focused on helping with DSA.
- Use valid, readable Markdown for headings, lists, tables, and fenced code blocks.
- Be accurate, structured, and encouraging. Do not claim code was executed.
`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateWithRetry(request, retries = 2) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await ai.models.generateContent(request);
    } catch (error) {
      const status = Number(error?.status ?? error?.code);
      const temporary = [429, 500, 502, 503, 504].includes(status) ||
        /high demand|temporarily unavailable|overloaded/i.test(error?.message ?? "");
      if (!temporary || attempt >= retries) throw error;
      await sleep(800 * (attempt + 1)); // Corrected multiplication
    }
  }
}

app.post("/api/chat", async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({
        error: "Gemini API key is missing. Add GEMINI_API_KEY to your .env file."
      });
    }

    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const cleanedMessages = messages
      .filter((message) =>
        message && ["user", "assistant"].includes(message.role) &&
        typeof message.text === "string" && message.text.trim()
      )
      .slice(-20)
      .map((message) => ({ role: message.role, text: message.text.trim() }));

    const latestUserMessage = [...cleanedMessages].reverse().find((message) => message.role === "user");
    if (!latestUserMessage) {
      return res.status(400).json({ error: "Please enter a question first." });
    }

    if (latestUserMessage.text.length > 4000 || cleanedMessages.some((message) => message.text.length > 4000)) {
      return res.status(400).json({ error: "Please keep each message under 4,000 characters." });
    }

    const contents = cleanedMessages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.text }]
    }));

    const response = await generateWithRetry({
      model: "gemini-3.8-flash",
      contents,
      config: { systemInstruction }
    });

    const answer = response.text?.trim();
    if (!answer) {
      return res.status(502).json({
        error: "The AI returned an empty response. Please try again."
      });
    }

    return res.json({ answer });
  } catch (error) {
    console.error("Gemini request failed:", error.message);
    const status = Number(error?.status ?? error?.code);
    const temporarilyUnavailable = [429, 500, 502, 503, 504].includes(status) ||
      /high demand|temporarily unavailable|overloaded/i.test(error?.message ?? "");

    return res.status(temporarilyUnavailable ? 503 : 500).json({
      error: temporarilyUnavailable
        ? "Gemini is temporarily busy. Please try again shortly."
        : "I couldn't get an answer right now. Please check your API setup and try again."
    });
  }
});

app.listen(PORT, () => {
  console.log(`DSA Mentor AI is running at http://localhost:${PORT}`);
});
