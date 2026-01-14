const { cmd } = require("../command");
const axios = require("axios");
const fg = require("api-dylux");
const sharp = require("sharp");

const API_KEY = "dew_YyT0KDc2boHDasFlmZCqDcPoeDHReD20aYmEsm1G";
const FOOTER = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄☢️☘";
const FALLBACK_POSTER = "https://i.imgur.com/8Qf4H0P.jpg";

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

// ───────── Create thumbnail ─────────
async function makeThumbnail(url) {
  try {
    const img = await axios.get(url, { responseType: "arraybuffer" });
    return await sharp(img.data)
      .resize(320, 320, { fit: "inside" })
      .jpeg({ quality: 60 })
      .toBuffer();
  } catch {
    return null;
  }
}

// ───────── Moviesub command ─────────
cmd({
  pattern: "moviesub",
  desc: "Search Sinhala Movies & TV Series, auto download GDrive files",
  category: "downloader",
  react: "🎬",
  filename: __filename,
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗ Example: `.moviesub Spider Man`");

    await reply("🔍 Searching movies...");

    // 1️⃣ Search movies
    const searchRes = await axios.get(
      `https://api.srihub.store/movie/moviesub?q=${encodeURIComponent(q)}&apikey=${API_KEY}`
    );
    const results = searchRes.data?.result;
    if (!results?.length) return reply("❌ No results found");

    // 2️⃣ List top 10
    let listText = "🎬 *Search Results*\n\n";
    results.slice(0, 10).forEach((v, i) => {
      listText += `*${i + 1}.* ${v.title}\n`;
    });
    listText += `\nReply with number\n\n${FOOTER}`;
    const listMsg = await conn.sendMessage(from, { text: listText }, { quoted: m });

    // 3️⃣ Wait for selection
    const { msg: selMsg, text: selText } = await waitForReply(conn, from, listMsg.key.id);
    const index = parseInt(selText) - 1;
    if (isNaN(index) || !results[index]) return reply("❌ Invalid number");

    const movie = results[index];

    // 4️⃣ Get download links
    const dlRes = await axios.get(
      `https://api.srihub.store/movie/moviesubdl?url=${encodeURIComponent(movie.url)}&apikey=${API_KEY}`
    );
    const dl = dlRes.data?.result?.downloads;
    if (!dl || (!dl.gdrive && !dl.telegram)) return reply("❌ No download links found");

    // 5️⃣ Send movie info card (image + caption)
    const poster = movie.thumbnail && movie.thumbnail.startsWith("http") ? movie.thumbnail : FALLBACK_POSTER;
    let infoText = `🎬 *${movie.title}*\n\n`;
    if (dl.gdrive) infoText += `🌐 GDrive Available\n`;
    if (dl.telegram) infoText += `📲 Telegram Available\n`;
    infoText += `\n${FOOTER}`;

    await conn.sendMessage(from, {
      image: { url: poster },
      caption: infoText
    }, { quoted: selMsg });

    // 6️⃣ If GDrive available, download and send
    if (dl.gdrive) {
      const uploadingMsg = await conn.sendMessage(from, { text: '⬆️ Uploading movie, please wait...' }, { quoted: selMsg });

      // Fix GDrive link
      const gdriveLink = dl.gdrive.replace(
        'https://drive.usercontent.google.com/download?id=',
        'https://drive.google.com/file/d/'
      ).replace('&export=download', '/view');

      const file = await fg.GDriveDl(gdriveLink);

      // Create thumbnail for document
      const thumb = await makeThumbnail(poster);

      // Delete uploading msg
      await conn.sendMessage(from, { delete: uploadingMsg.key });

      // Send document
      await conn.sendMessage(from, {
        document: { url: file.downloadUrl },
        fileName: file.fileName,
        mimetype: file.mimetype,
        jpegThumbnail: thumb || undefined,
        caption: file.fileName.replace('[Cinesubz.co]', '') + `\n\n${FOOTER}`
      }, { quoted: selMsg });
    }

    // 7️⃣ If only Telegram link available
    else if (dl.telegram) {
      await conn.sendMessage(from, { text: `📲 Telegram: ${dl.telegram}` }, { quoted: selMsg });
    }

  } catch (e) {
    console.error("MOVIESUB ERROR:", e);
    reply("⚠️ Error:\n" + e.message);
  }
});
