const { cmd } = require("../command");
const axios = require("axios");
const sharp = require("sharp");

const FOOTER = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌☢️☘";
const FALLBACK_POSTER = "https://i.imgur.com/8Qf4H0P.jpg";

/* ───── React helper ───── */
async function react(conn, jid, key, emoji) {
  try {
    await conn.sendMessage(jid, { react: { text: emoji, key } });
  } catch {}
}

/* ───── Wait for reply ───── */
function waitForReply(conn, from, replyToId, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const handler = (update) => {
      const msg = update.messages?.[0];
      if (!msg?.message) return;
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      const text =
        msg.message.conversation ||
        msg.message?.extendedTextMessage?.text;

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

/* ───── Create jpegThumbnail ───── */
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

/* ───── Command ───── */
cmd({
  pattern: "pirate",
  desc: "Search movies from Pirate.lk and get details/downloads",
  category: "downloader",
  react: "🎬",
  filename: __filename,
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗ Example: `.pirate sector 36`");

    await react(conn, from, m.key, "🔍");

    /* 1️⃣ Search movies */
    const searchRes = await axios.get(
      `https://ty-opal-eta.vercel.app/movie/pirate/search?text=${encodeURIComponent(q)}`
    );

    const movies = searchRes.data?.result?.data;
    if (!movies || !movies.length) return reply("❌ No results found");

    let listText = "🎬 *Search Results*\n\n";
    movies.slice(0, 10).forEach((v, i) => {
      listText += `*${i + 1}.* ${v.title} | ${v.year}\nIMDB: ${v.imdb}\n`;
    });
    listText += `\nReply with number\n\n${FOOTER}`;

    const listMsg = await conn.sendMessage(from, { text: listText }, { quoted: m });
    await react(conn, from, listMsg.key, "📃");

    /* 2️⃣ Select movie */
    const { msg: selMsg, text } = await waitForReply(conn, from, listMsg.key.id);
    const index = parseInt(text) - 1;
    if (isNaN(index) || !movies[index]) return reply("❌ Invalid number");

    const movie = movies[index];
    await react(conn, from, selMsg.key, "🎬");

    /* 3️⃣ Get movie details */
    const detailRes = await axios.get(
      `https://ty-opal-eta.vercel.app/movie/pirate/movie?url=${encodeURIComponent(movie.link)}`
    );
    const details = detailRes.data?.result?.data;
    if (!details) return reply("❌ Movie details not found");

    const poster = details.image || FALLBACK_POSTER;
    const thumb = await makeThumbnail(poster);

    /* 4️⃣ Send movie info card */
    let caption = `🎬 *${details.title}*\n\n`;
    if (details.tmdb) caption += `⭐ TMDB: ${details.tmdb}\n`;
    if (details.date) caption += `📅 Release: ${details.date}\n`;
    if (details.runtime) caption += `⏱ Duration: ${details.runtime}\n`;
    if (details.category) caption += `🎭 Genre: ${details.category.join(", ")}\n`;
    if (details.director) caption += `🎬 Director: ${details.director}\n`;
    caption += `\n${FOOTER}`;

    await conn.sendMessage(
      from,
      { image: { url: poster }, caption, jpegThumbnail: thumb || undefined },
      { quoted: selMsg }
    );

    /* 5️⃣ Send download links */
    let dlText = "⬇️ *Download Links*\n\n";
    details.dl_links.forEach((dl) => {
      dlText += `• ${dl.quality} (${dl.size})\n[Link](${dl.link})\n\n`;
    });

    await conn.sendMessage(
      from,
      { text: dlText, linkPreview: false },
      { quoted: selMsg }
    );

  } catch (e) {
    console.error("PIRATE ERROR:", e);
    reply("⚠️ Error:\n" + e.message);
  }
});
