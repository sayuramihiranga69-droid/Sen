const { cmd } = require("../command");
const axios = require("axios");

const SRIHUB_FOOTER = "✫☘ 𝐒𝐫𝐢𝐇𝐮𝐛 𝐌𝐨𝐯𝐢𝐞 𝐁𝐨𝐭 ☢️☘";

// ───────── Wait for reply helper ─────────
function waitForReply(conn, from, replyToId, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const handler = (update) => {
      const msg = update.messages?.[0];
      if (!msg?.message) return;
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      const text = msg.message.conversation || msg.message?.extendedTextMessage?.text;
      if (msg.key.remoteJid === from && ctx?.stanzaId === replyToId) {
        conn.ev.off("messages.upsert", handler);
        resolve({ msg, text });
      }
    };
    conn.ev.on("messages.upsert", handler);
    setTimeout(() => {
      conn.ev.off("messages.upsert", handler);
      reject(new Error("Reply timeout"));
    }, timeout);
  });
}

// ───────── Command ─────────
cmd({
  pattern: "moviesub",
  desc: "Search Sinhala Movies with Subtitles (SriHub API)",
  category: "downloader",
  react: "🎬",
  filename: __filename,
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗ Example: .moviesub Stranger Things");

    await reply("🔍 Searching movies...");

    // 1️⃣ Search
    const searchRes = await axios.get(`https://api.srihub.store/movie/moviesub?q=${encodeURIComponent(q)}&apikey=dew_B59NylJtdTt6KmCaDpLt5VXWo1aohDRyRblCDlc7`);
    const results = searchRes.data?.result;
    if (!results?.length) return reply("❌ No results found");

    let listText = "🎬 *Search Results*\n\n";
    results.slice(0, 10).forEach((v, i) => { listText += `*${i + 1}.* ${v.title}\n`; });
    listText += `\nReply with the number to select.\n\n${SRIHUB_FOOTER}`;

    const listMsg = await conn.sendMessage(from, { text: listText }, { quoted: m });

    // 2️⃣ Wait for selection
    const { msg: selMsg, text: selText } = await waitForReply(conn, from, listMsg.key.id);
    const index = parseInt(selText) - 1;
    if (isNaN(index) || !results[index]) return reply("❌ Invalid number");

    const movie = results[index];

    // 3️⃣ Get download links
    const dlRes = await axios.get(`https://api.srihub.store/movie/moviesubdl?url=${encodeURIComponent(movie.url)}&apikey=dew_B59NylJtdTt6KmCaDpLt5VXWo1aohDRyRblCDlc7`);
    const dl = dlRes.data?.result?.downloads;

    if (!dl || (!dl.gdrive && !dl.telegram)) return reply("❌ No download links found");

    // 4️⃣ Send links
    let msgText = `🎬 *${movie.title}*\n\n`;
    if (dl.gdrive) msgText += `🌐 GDrive: ${dl.gdrive}\n`;
    if (dl.telegram) msgText += `📲 Telegram: ${dl.telegram}\n`;
    msgText += `\n${SRIHUB_FOOTER}`;

    await conn.sendMessage(from, { text: msgText }, { quoted: selMsg });

  } catch (e) {
    console.error("MOVIESUB ERROR:", e);
    reply("⚠️ Error:\n" + e.message);
  }
});
