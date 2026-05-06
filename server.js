const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ===== CONFIG =====
const VERIFY_TOKEN = "qa_bot_verify";

// WhatsApp credentials
const WHATSAPP_TOKEN = "EAANflZA9TKroBRSPrEMaAAv27O5MZCJxZCqzzfUphgoCg1a35Bpv5n1dqOHHapnJe43ISk9jLiMq5ukVQR1LEzcUwRlXkzjwX26YYb0ZCl1KvjGgbaNLZBb46d42wER69fMTvscEMAEiWxWAHZA6GqmIuvQVUYHHK9xFwFEKYWHgfP9tjivTTBTu4UHo4kj18dAB20MqpA67NbbiQr83LwI6kIkhMbWJuWa5UfZApjY6P44ZB7cqLL5JKPZAZAvZAZBjvoSHCkc0AR3n28Ei6ZAzKROkZD";
const PHONE_NUMBER_ID = "1106257992569586";

// ===== SHEETBEST API (YOUR URL ADDED) =====
const SHEET_API_URL = "https://api.sheetbest.com/sheets/2b0c7cf9-0554-4788-94c8-2645a98b54c8";

// ===== MEMORY =====
const userState = {};

// ===== HEALTH CHECK =====
app.get("/", (req, res) => {
  res.send("WhatsApp QA Bot is running 🚀");
});

// ===== WEBHOOK VERIFY =====
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ===== BOT LOGIC =====
app.post("/webhook", async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text = message.text?.body?.trim();

    if (!text) return res.sendStatus(200);

    let reply = "";

    // STEP 1: NAME
    if (!userState[from]) {
      userState[from] = { step: 1 };
      reply = "👋 Hi! Welcome to QA Intern application.\n\nWhat is your FULL NAME?";
    }

    // STEP 2: EDUCATION
    else if (userState[from].step === 1) {
      userState[from].name = text;
      userState[from].step = 2;

      reply = "🎓 Are you a Student or Graduate?";
    }

    // STEP 3: QA KNOWLEDGE
    else if (userState[from].step === 2) {
      userState[from].education = text;
      userState[from].step = 3;

      reply = "🧪 Do you have basic QA knowledge? (Yes/No)";
    }

    // STEP 4: FINAL + SAVE
    else if (userState[from].step === 3) {
      userState[from].qa = text;
      userState[from].step = 4;

      reply =
        "🔥 Thanks for applying!\n\n" +
        "Our team will review your profile and contact you soon.\n\n" +
        "📌 Good luck!";

      console.log("✅ Candidate Completed:", userState[from]);

      // ===== SAVE TO GOOGLE SHEETS =====
      try {
        await axios.post(SHEET_API_URL, {
          Name: userState[from].name,
          Education: userState[from].education,
          QA: userState[from].qa,
          Phone: from,
          Time: new Date().toLocaleString()
        });

        console.log("📊 Saved to Google Sheets");
      } catch (sheetError) {
        console.error("❌ Sheet Save Error:", sheetError.message);
      }
    }

    // SEND WHATSAPP MESSAGE
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        text: { body: reply }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.sendStatus(200);

  } catch (err) {
    console.error("❌ ERROR:", err.response?.data || err.message);
    res.sendStatus(500);
  }
});

// ===== START SERVER =====
app.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});