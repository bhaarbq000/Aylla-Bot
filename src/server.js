const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const STORE_NAME = process.env.STORE_NAME;
const STORE_INFO = process.env.STORE_INFO;
const STORE_EXTRA = process.env.STORE_EXTRA;

app.get("/", (req, res) => res.send("OK"));

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  console.log("Webhook verify:", mode, token, challenge);
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }
  console.log("❌ Verify failed");
  res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  const body = req.body;
  if (body.object !== "instagram") return;
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "comments") continue;
      const { id, text } = change.value;
      if (!text || text.trim().length < 2) continue;
      try {
        const r = await axios.post("https://api.anthropic.com/v1/messages", {
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          system: `أنت مساعد ذكي يرد على تعليقات إنستاغرام لمتجر "${STORE_NAME}". ${STORE_INFO}. ${STORE_EXTRA}. ردك قصير ومختصر باللهجة الخليجية مع إيموجي.`,
          messages: [{ role: "user", content: `تعليق: "${text}"\nرد قصير:` }],
        }, { headers: { "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" } });
        const reply = r.data.content[0].text;
        await axios.post(`https://graph.instagram.com/v21.0/${id}/replies`,
          { message: reply },
          { params: { access_token: INSTAGRAM_ACCESS_TOKEN } }
        );
        console.log("✅ رد:", reply);
      } catch (err) {
        console.error("❌", err.response?.data || err.message);
      }
    }
  }
});

app.listen(PORT, () => console.log(`🚀 يعمل على ${PORT}`));
