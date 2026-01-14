const { cmd } = require('../command');
const axios = require('axios');

const footer = "✫☘ 𝐒𝐫𝐢𝐇𝐮𝐛 𝐌𝐨𝐯𝐢𝐞𝐬 ☢️☘";

// ───────── Wait for reply ─────────
function waitForReply(conn, from, replyToId, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const handler = (update) => {
      const msg = update.messages?.[0];
      if (!msg?.message) return;
      const text = msg.message.conversation || msg.message?.extendedTextMessage?.text;
      if (msg.key.remoteJid === from) {
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
  desc: "Search and download movies/series from Srihub",
  category: "downloader",
  react: "🔍",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗ Example: .moviesub Stranger");

    // 1️⃣ Search
    const searchRes = await axios.get(`https://api.srihub.store/movie/moviesub?q=${encodeURIComponent(q)}`);
    const results = searchRes.data?.result;
    if (!results || results.length === 0) return reply("❌ No results found");

    // 2️⃣ Send list
    let listText = `🎬 *Srihub Results*\n\n`;
    results.slice(0, 10).forEach((v, i) => {
      listText += `*${i+1}.* ${v.title}\n`;
    });
    const listMsg = await conn.sendMessage(from, { text: listText + `\nReply number\n${footer}` }, { quoted: mek });

    // 3️⃣ Wait for selection
    const { msg: movieMsg, text: movieText } = await waitForReply(conn, from, listMsg.key.id);
    const index = parseInt(movieText) - 1;
    if (isNaN(index) || !results[index]) return reply("❌ Invalid number");

    const movie = results[index];

    // 4️⃣ Fetch movie/series info
    const infoRes = await axios.get(`https://api.srihub.store/movie/moviesubdl?url=${encodeURIComponent(movie.url)}`);
    const info = infoRes.data?.result;
    if (!info) return reply("❌ Failed to get info");

    let infoText = `🎬 *${movie.title}*`;
    if(movie.year) infoText += `\n📅 Year: ${movie.year}`;
    infoText += `\n\n*Episodes:*`;
    if(info.seasons && info.seasons.length > 0) {
      info.seasons[0].episodes.forEach((e,i)=>{
        infoText += `\n*${i+1}.* ${e.title}`;
      });
    }

    const infoMsg = await conn.sendMessage(from, { text: infoText + `\n\nReply episode number\n${footer}` }, { quoted: movieMsg });

    // 5️⃣ Wait for episode selection
    const { msg: epMsg, text: epText } = await waitForReply(conn, from, infoMsg.key.id);
    const epIndex = parseInt(epText) - 1;
    if(isNaN(epIndex) || !info.seasons[0].episodes[epIndex]) return reply("❌ Invalid episode number");

    const episode = info.seasons[0].episodes[epIndex];
    let epMsgText = `🎬 *${episode.title}*\n\n🎥 Watch here: ${episode.iframe || "No iframe link available"}`;
    await conn.sendMessage(from, { text: epMsgText }, { quoted: epMsg });

  } catch (e) {
    console.error("Srihub ERROR:", e);
    reply("⚠️ Error:\n" + e.message);
  }
});
