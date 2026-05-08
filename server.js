const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// =======================================
// ENV VARIABLES
// =======================================
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// =======================================
// GOOGLE SHEETS API
// =======================================
const SHEET_API_URL =
  "https://api.sheetbest.com/sheets/2b0c7cf9-0554-4788-94c8-2645a98b54c8";

// =======================================
// MEMORY STORE
// =======================================
const userState = {};

// =======================================
// HEALTH CHECK
// =======================================
app.get("/", (req, res) => {
  res.send("WhatsApp QA Bot is running 🚀");
});

// =======================================
// WEBHOOK VERIFICATION
// =======================================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("Webhook verification request received");

  if (mode && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  console.log("Webhook verification failed");
  return res.sendStatus(403);
});

// =======================================
// WHATSAPP WEBHOOK
// =======================================
app.post("/webhook", async (req, res) => {
  try {
    console.log("Webhook hit!");
    console.log(JSON.stringify(req.body, null, 2));

    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const from = message.from;
    const text = message.text?.body?.trim();

    if (!text) {
      return res.sendStatus(200);
    }

    console.log("Incoming message:", text);

    let reply = "";

    // =======================================
    // RESET FLOW
    // =======================================
    if (
      text.toLowerCase() === "hi" ||
      text.toLowerCase() === "hello" ||
      text.toLowerCase() === "start"
    ) {
      userState[from] = { step: 1 };

      reply =
        "👋 Hi! Welcome to QA Intern application.\n\n" +
        "What is your FULL NAME?";
    }

    // =======================================
    // STEP 1 - NAME
    // =======================================
    else if (!userState[from]) {
      userState[from] = { step: 1 };

      reply =
        "👋 Hi! Welcome to QA Intern application.\n\n" +
        "What is your FULL NAME?";
    }

    // =======================================
    // STEP 2 - EDUCATION
    // =======================================
    else if (userState[from].step === 1) {
      userState[from].name = text;
      userState[from].step = 2;

      reply = "🎓 Are you a Student or Graduate?";
    }

    // =======================================
    // STEP 3 - QA KNOWLEDGE
    // =======================================
    else if (userState[from].step === 2) {
      userState[from].education = text;
      userState[from].step = 3;

      reply = "🧪 Do you have basic QA knowledge? (Yes/No)";
    }

    // =======================================
    // STEP 4 - SAVE DATA
    // =======================================
    else if (userState[from].step === 3) {
      userState[from].qa = text;
      userState[from].step = 4;

      reply =
        "🔥 Thanks for applying!\n\n" +
        "Our team will review your profile and contact you soon.\n\n" +
        "📌 Good luck!";

      console.log("Candidate completed:", userState[from]);

      // SAVE TO GOOGLE SHEETS
      try {
        await axios.post(SHEET_API_URL, {
          Name: userState[from].name,
          Education: userState[from].education,
          QA: userState[from].qa,
          Phone: from,
          Time: new Date().toLocaleString()
        });

        console.log("Saved to Google Sheets");
      } catch (sheetError) {
        console.error(
          "Google Sheet Save Error:",
          sheetError.response?.data || sheetError.message
        );
      }
    }

    // =======================================
    // SEND WHATSAPP MESSAGE
    // =======================================
    try {
      const response = await axios.post(
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

      console.log("WhatsApp message sent:", response.data);

    } catch (whatsappError) {
      console.error(
        "WhatsApp Send Error:",
        whatsappError.response?.data || whatsappError.message
      );
    }

    res.sendStatus(200);

  } catch (err) {
    console.error(
      "Webhook Error:",
      err.response?.data || err.message
    );

    res.sendStatus(500);
  }
});

// =======================================
// START SERVER
// =======================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});