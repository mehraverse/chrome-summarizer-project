require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

// Add conversation history map
const conversationHistories = new Map();

// Mock data for dev mode
const mockResponses = {
  summary: (text) =>
    "This is a mock summary for development. First paragraph with key points. Second paragraph with supporting details.",
  chat: (question) =>
    `Mock response to: Using dev mode to test UI interactions without API calls.`,
};

// Unified function for OpenAI API calls
async function callOpenAI(messages) {
  if (process.env.DEV_MODE === "true") {
    console.log("DEV MODE: Returning mock response");
    return messages[messages.length - 1].role === "user"
      ? mockResponses.chat(messages[messages.length - 1].content)
      : mockResponses.summary(messages[1].content);
  }

  console.log("Calling OpenAI...");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages,
      temperature: 0.7,
      max_tokens: 250, // further reduced tokens for cost efficiency
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI Error:", {
      status: response.status,
      error: errorText,
    });
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log("Response fetched successfully.");
  return data.choices[0].message.content;
}

// Summarization endpoint
app.post("/summarize", async (req, res) => {
  const { text } = req.body;

  if (!text || text.length < 100) {
    return res.status(400).json({ error: "Text too short for summarization" });
  }

  try {
    const messages = [
      {
        role: "system",
        content: `You are a highly efficient summarizer. Create concise, informative summaries that capture the main points. 
        Important: Wrap key phrases, important concepts, and critical points in <mark> tags. For example: "The study found that <mark>remote work increased productivity significantly</mark>."
        Use marks sparingly - only highlight the most important 3-4 pieces of information per paragraph.`,
      },
      {
        role: "user",
        content: `Please summarize this text in 1-2 short paragraphs:\n\n${text}`,
      },
    ];

    const summary = await callOpenAI(messages);
    console.log("Summary with highlights fetched successfully.");
    res.json({ summary });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ error: "Summarization failed", details: error.message });
  }
});

// Chat endpoint
app.post("/chat", async (req, res) => {
  const { question, context } = req.body;
  const conversationId =
    req.headers["x-conversation-id"] || Date.now().toString();

  try {
    let history = conversationHistories.get(conversationId) || [];
    if (history.length > 2) history = history.slice(-2);

    // Only include context in first message of conversation
    const messages = [
      {
        role: "system",
        content:
          "You are a knowledgeable assistant. Answer questions directly and accurately based on both the article context and general knowledge when needed. Keep responses concise and informative.",
      },
      ...(history.length === 0
        ? [
            {
              role: "user",
              content: `Context: ${context}\nRemember this context for our conversation.`,
            },
            {
              role: "assistant",
              content:
                "I'll keep the context in mind. What would you like to know?",
            },
          ]
        : []),
      ...history.flatMap((h) => [
        { role: "user", content: h.question },
        { role: "assistant", content: h.answer },
      ]),
      { role: "user", content: question },
    ];

    const answer = await callOpenAI(messages);
    console.log("Chat answer fetched successfully.");

    // Update history for this conversation
    history.push({ question, answer });
    conversationHistories.set(conversationId, history);

    // Automatically cleanup history after 30 minutes
    setTimeout(
      () => conversationHistories.delete(conversationId),
      30 * 60 * 1000
    );

    res.json({ response: answer, conversationId });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Chat failed", details: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
