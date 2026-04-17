const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

const { VERIFY_TOKEN, INSTAGRAM_ACCESS_TOKEN, CLAUDE_API_KEY, STORE_NAME, STORE_INFO, STORE_EXTRA, PORT = 3000 } = process.env;

async function generateReply(commentText) {
  const response = await axios.post("https://api.anthropic.com/v1/messages", {
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    system: `أنت مساعد ذكي يرد على تعليقات إنستاغرام لمتجر "${STORE_NAME}". طبيعة العمل: ${STORE_INFO}. أسلوبك ودود ومختصر باللهجة العراقية مع إيموجي. معلومات: ${STORE_EXTRA}`,
    messages: [{ role: "user", content: `تعليق زبون: "${commentText}"\nاكتب رد قصير.` }],
  }, { headers: { "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" } });
  return response.data.content[0].text;
}

async function postReply(commentId, replyText) {
  await axios.post(`https://graph.instagram.com/v21.0/${commentId}/replies`, { message: replyText }, { params: { access_token: INSTAGRAM_ACCESS_TOKEN } });
}

app.get("/webhook", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN) {
    return res.status(200).send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  if (req.body.object !== "instagram") return;
  for (const entry of req.body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "comments") continue;
      const { id, text } = change.value;
      if (!text || text.trim().length < 2) continue;
      try {
        const reply = await generateReply(text);
        await postReply(id, reply);
        console.log("✅ رد:", reply);
      } catch (err) {
        console.error("❌ خطأ:", err.message);
      }
    }
  }
});

app.get("/", (req, res) => res.json({ status: "✅ يعمل", store: STORE_NAME }));
app.listen(PORT, () => console.log(`🚀 السيرفر على البورت ${PORT}`));
