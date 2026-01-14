const { cmd } = require("../command");
const axios = require("axios");
const fg = require("api-dylux");
const sharp = require("sharp");

const API_KEY = "dew_YyT0KDc2boHDasFlmZCqDcPoeDHReD20aYmEsm1G";
const FOOTER = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄☢️☘";
const FALLBACK_POSTER = "https://i.imgur.com/8Qf4H0P.jpg";

// ───── React helper ─────
async function react(conn, jid, key, emoji) {
  try { await conn.sendMessage(jid, { react: { text: emoji, key } }); } catch {}
}

// ───── Wait for reply ─────
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
    setTimeout(() => { conn.ev.off("messages.upsert", handler); reject(new Error("Reply timeout")); }, timeout);
  });
}

// ───── Create thumbnail ─────
async function makeThumbnail(url) {
  try {
    const img = await axios.get(url, { responseType: "arraybuffer" });
    return await sharp(img.data).resize(320, 320, { fit: "inside" }).jpeg({ quality: 60 }).toBuffer();
  } catch { return null; }
}

// ───── Moviesub command ─────
cmd({
  pattern: "moviesub",
  desc: "Search Sinhala Movies / TV Series with subtitles & auto download",
  category: "downloader",
  react: "🎬",
  filename: __filename,
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗ Example: `.moviesub Solo Leveling`");
    await react(conn, from, m.key, "🔍");

    // 1️⃣ Search
    const searchRes = await axios.get(`https://api.srihub.store/movie/moviesub?q=${encodeURIComponent(q)}&apikey=${API_KEY}`);
    const results = searchRes.data?.result;
    if (!results?.length) return reply("❌ No results found");

    // 2️⃣ Show top 10
    let listText = "🎬 *Search Results*\n\n";
    results.slice(0, 10).forEach((v, i) => listText += `*${i + 1}.* ${v.title}\n`);
    listText += `\nReply with number\n\n${FOOTER}`;
    const listMsg = await conn.sendMessage(from, { text: listText }, { quoted: m });
    await react(conn, from, listMsg.key, "📃");

    // 3️⃣ Select movie/series
    const { msg: selMsg, text: selText } = await waitForReply(conn, from, listMsg.key.id);
    const index = parseInt(selText) - 1;
    if (isNaN(index) || !results[index]) return reply("❌ Invalid number");
    const movie = results[index];
    await react(conn, from, selMsg.key, "🎬");

    // 4️⃣ Get download links
    const dlRes = await axios.get(`https://api.srihub.store/movie/moviesubdl?url=${encodeURIComponent(movie.url)}&apikey=${API_KEY}`);
    const dl = dlRes.data?.result?.downloads;

    // 5️⃣ Poster + thumbnail
    const poster = movie.thumbnail?.startsWith("http") ? movie.thumbnail : FALLBACK_POSTER;
    const thumb = await makeThumbnail(poster);

    // 6️⃣ Handle TV Series
    if (dlRes.data.result.type === "TV_SERIES") {
      const episodes = dlRes.data.result.seasons[0].episodes;
      let epiList = `🎬 *${movie.title} - ${dlRes.data.result.seasons[0].season}*\n\n`;
      episodes.forEach((e, i) => { epiList += `*${i + 1}.* ${e.title}\n`; });
      epiList += `\nReply with episode number\n\n${FOOTER}`;

      const epiMsg = await conn.sendMessage(from, { text: epiList }, { quoted: selMsg });
      const { text: epiText } = await waitForReply(conn, from, epiMsg.key.id);
      const epiIndex = parseInt(epiText) - 1;
      if (isNaN(epiIndex) || !episodes[epiIndex]) return reply("❌ Invalid episode number");
      const episode = episodes[epiIndex];

      // Send uploading message
      const uploadingMsg = await conn.sendMessage(from, { text: "⬆️ Uploading episode, please wait..." }, { quoted: selMsg });
      await react(conn, from, uploadingMsg.key, "⏳");

      // Fix GDrive link & download
      const gdriveLink = episode.downloads.gdrive.replace('https://drive.usercontent.google.com/download?id=', 'https://drive.google.com/file/d/').replace('&export=download', '/view');
      const file = await fg.GDriveDl(gdriveLink);

      // Delete uploading message
      await conn.sendMessage(from, { delete: uploadingMsg.key });

      // Send document
      const sent = await conn.sendMessage(from, {
        document: { url: file.downloadUrl },
        fileName: file.fileName,
        mimetype: file.mimetype,
        jpegThumbnail: thumb || undefined,
        caption: file.fileName.replace("[Cinesubz.co]", "") + `\n\n${FOOTER}`,
      }, { quoted: selMsg });
      await react(conn, from, sent.key, "✅");

    } else {
      // 7️⃣ Movie type (SUBTITLE)
      if (!dl.gdrive) return reply("❌ GDrive not available for this movie");
      await conn.sendMessage(from, { image: { url: "https://files.catbox.moe/d0v6fe.png" }, caption: `🎬 *${movie.title}*\n\n⬇️ Downloading from Google Drive...\n\n${FOOTER}` }, { quoted: selMsg });
      const uploading = await conn.sendMessage(from, { text: "⬆️ Uploading movie, please wait..." }, { quoted: selMsg });
      await react(conn, from, uploading.key, "⏳");

      const gdriveLink = dl.gdrive.replace('https://drive.usercontent.google.com/download?id=', 'https://drive.google.com/file/d/').replace('&export=download', '/view');
      const file = await fg.GDriveDl(gdriveLink);

      await conn.sendMessage(from, { delete: uploading.key });
      const sent = await conn.sendMessage(from, {
        document: { url: file.downloadUrl },
        fileName: file.fileName,
        mimetype: file.mimetype,
        jpegThumbnail: thumb || undefined,
        caption: file.fileName.replace("[Cinesubz.co]", "") + `\n\n${FOOTER}`,
      }, { quoted: selMsg });
      await react(conn, from, sent.key, "✅");
    }

  } catch (e) {
    console.error("MOVIESUB ERROR:", e);
    reply("⚠️ Error:\n" + e.message);
  }
});
