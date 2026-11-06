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
console.log("Loaded API Key preview:", apiKey ? apiKey.substring(0, 6) + "..." : "NOT FOUND");

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const systemInstruction = `
You are DSA Mentor AI, a friendly Data Structures and Algorithms tutor.
- Answer questions related to data structures, algorithms, time complexity, space complexity, and coding interview fundamentals.
- Explain concepts in simple, beginner-friendly language.
- DEFAULT TO CONCISE ANSWERS: for a basic question, use a plain-language definition and one small example, usually 3-6 short sentences total.
`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateWithRetry(request, retries = 4) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`Sending request to Gemini (Attempt ${attempt + 1})...`);
      const apiCall = ai.models.generateContent(request);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("API Request timed out")), 25000)
      );
      return await Promise.race([apiCall, timeoutPromise]);
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error.message);
      const status = Number(error?.status ?? error?.code);
      const temporary = [429, 500, 502, 503, 504].includes(status) ||
        /high demand|temporarily unavailable|overloaded|timed out/i.test(error?.message ?? "");
      
      if (!temporary || attempt === retries) throw error;
      await sleep(3000 * (attempt + 1));
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

    const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    if (rawMessages.length === 0) {
      return res.status(400).json({ error: "Please enter a question first." });
    }

    const contents = rawMessages.map((message) => ({
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
      return res.status(502).json({ error: "The AI returned an empty response." });
    }

    return res.json({ answer });
  } catch (error) {
    console.error("Endpoint error:", error.message);
    
    // Check if it's a Quota / Rate limit error (429)
    const isQuotaError = error.message.includes('429') || 
      error.message.includes('RESOURCE_EXHAUSTED') || 
      error.message.includes('quota');
                         
    if (isQuotaError) {
      return res.status(429).json({ 
        error: "Daily free tier limit reached (20 requests/day). Please try again tomorrow or use a fresh API key from a new Google AI Studio project." 
      });
    }

    return res.status(500).json({ error: "Failed to get response: " + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`DSA Mentor AI is running at http://localhost:${PORT}`);
});