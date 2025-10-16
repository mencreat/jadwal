const axios = require("axios");
const admin = require("firebase-admin");

// ENV
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const LUX_API_URL = "https://api.luxsioab.com/pub/api/file/page";
const LUX_API_KEY = process.env.LUX_API_KEY;
const LUX_DIR_ID = process.env.LUX_DIR_ID;

// Firestore init
const firebaseCredentials = JSON.parse(Buffer.from(process.env.FIREBASE_CREDENTIALS_B64, 'base64').toString('utf-8'));

admin.initializeApp({
  credential: admin.credential.cert(firebaseCredentials),
});

const db = admin.firestore();
const sentCollection = db.collection("sentLuxVideos");

// Helpers
async function isSent(id) {
  const doc = await sentCollection.doc(id).get();
  return doc.exists;
}

async function markAsSent(id) {
  await sentCollection.doc(id).set({ sentAt: new Date().toISOString() });
}

async function fetchAllLuxFiles() {
  const pageSize = 10;
  let page = 1;
  let allFiles = [];
  let hasMore = true;

  while (hasMore) {
    const payload = {
      key: LUX_API_KEY,
      page_num: page,
      page_size: pageSize,
      dir_id: LUX_DIR_ID,
    };

    const res = await axios.post(LUX_API_URL, payload);
    const files = res.data.data.files || [];

    allFiles = allFiles.concat(files);

    const totalPages = res.data.data.total_pages;
    page++;

    if (page > totalPages) hasMore = false;
  }

  return allFiles;
}

async function main() {
  const files = await fetchAllLuxFiles();

  for (const file of files) {
    const { code, name, title, share_link, collage_screenshots, thumbnail } = file;

    if (await isSent(code)) continue;

//     const discordPayload = {
//       content: `## 📢 New Release Content Crot!
// 🎬 **${title}**
// 🔗 https://videyb.com/e/${code}
// ![cover](${thumbnail})

// || <@&1387116137497624669> ||`,
//     };

    const discordPayload = {
      embeds: [
        {
          title: `🎬 ${title}`,
          url: `https://videyb.com/e/${code}`,
          description: `📢 New release content ygy! ||<@&1387116137497624669>||`,
          image: { url: thumbnail },
          color: 0xffa500, // orange, bisa kamu ganti
          footer: {
            text: "Posted via Ngewe",
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    console.log("Mengirim:", title);
    await axios.post(WEBHOOK_URL, discordPayload).catch(err => {
      console.error("Gagal kirim ke Discord:", err.response?.data || err.message);
    });

    const telegramPayload = {
      chat_id: TELEGRAM_CHAT_ID,
      photo: thumbnail,
      caption: `📢 *New Release Video ygy!*\n\n🎬 *${title}*\n[🔗 Tonton Sekarang](https://videyb.com/e/${code})`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "🎬 Watch Now", url: `https://videyb.com/e/${code}` }]],
      },
    };

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, telegramPayload)
      .catch(err => {
        console.error("Gagal kirim ke Telegram:", err.response?.data || err.message);
      });

    await markAsSent(code);
    break; // hanya kirim 1 item per run
  }
}

main();
