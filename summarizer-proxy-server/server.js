require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

// Proxy endpoint for summarization
app.post("/summarize", async (req, res) => {
  const { text } = req.body;

  const API_KEY = process.env.HUGGINGFACE_API_KEY; // Replace this with your Hugging Face API key
  const model = "facebook/bart-large-cnn";

  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: text,
          parameters: {
            max_length: 142, // Matches model's config.json [1]
            min_length: 60,
            truncation: true, // Force truncation at 1024 tokens [5]
            length_penalty: 2.0, // Discourage overly short summaries [2]
          },
        }),
      }
    );

    const data = await response.json();
    if (data && data[0] && data[0].summary_text) {
      res.json({ summary: data[0].summary_text });
    } else {
      console.log(data);
      res.status(500).json({ error: "Error summarizing text" });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
