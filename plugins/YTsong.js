const { cmd } = require("../command");
const axios = require("axios");
const fg = require("api-dylux");

const SRIHUB_APIKEY = "dew_B59NylJtdTt6KmCaDpLt5VXWo1aohDRyRblCDlc7";
const FOOTER = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄☢️☘";
const POSTER_FALLBACK = "https://i.imgur.com/8Qf4H0P.jpg";

/* ───── React helper ───── */
async function react(conn, jid, key, emoji) {
  try {
    await conn.sendMessage(jid, { react: { text: emoji, key } });
  } catch {}
}

/* ───── Wait for reply helper ───── */
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

/* ───── Command ───── */
cmd({
  pattern: "moviesub",
  desc: "Search Sinhala Sub Movies & Auto Download",
  category: "downloader",
  react: "🎬",
  filename: __filename,
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗ Example: `.moviesub Spider Man`");

    await react(conn, from, m.key, "🔍");

    /* 1️⃣ Search */
    const search = await axios.get(
      `https://api.srihub.store/movie/moviesub?q=${encodeURIComponent(q)}&apikey=${SRIHUB_APIKEY}`
    );

    const results = search.data?.result;
    if (!results?.length) return reply("❌ No results found");

    let listText = "🎬 *Search Results*\n\n";
    results.slice(0, 10).forEach((v, i) => {
      listText += `*${i + 1}.* ${v.title}\n`;
    });
    listText += `\nReply number\n\n${FOOTER}`;

    const listMsg = await conn.sendMessage(
      from,
      { text: listText },
      { quoted: m }
    );
    await react(conn, from, listMsg.key, "📃");

    /* 2️⃣ Select */
    const { msg: selMsg, text } = await waitForReply(
      conn,
      from,
      listMsg.key.id
    );
    const index = parseInt(text) - 1;
    if (isNaN(index) || !results[index])
      return reply("❌ Invalid number");

    const movie = results[index];
    await react(conn, from, selMsg.key, "🎬");

    /* 3️⃣ Download info */
    const dlRes = await axios.get(
      `https://api.srihub.store/movie/moviesubdl?url=${encodeURIComponent(
        movie.url
      )}&apikey=${SRIHUB_APIKEY}`
    );

    const dl = dlRes.data?.result?.downloads;
    if (!dl?.gdrive) return reply("❌ GDrive not available");

    /* 4️⃣ Poster + info */
    const poster =
      movie.thumbnail && movie.thumbnail.startsWith("http")
        ? movie.thumbnail
        : POSTER_FALLBACK;

    const infoMsg = await conn.sendMessage(
      from,
      {
        image: { url: poster },
        caption: `🎬 *${movie.title}*\n\n⬇️ Downloading from Google Drive...\n\n${FOOTER}`,
      },
      { quoted: selMsg }
    );

    /* 5️⃣ Uploading message */
    const uploading = await conn.sendMessage(
      from,
      { text: "⬆️ Uploading movie, please wait..." },
      { quoted: infoMsg }
    );
    await react(conn, from, uploading.key, "⏳");

    /* 6️⃣ GDrive download */
    const fixedLink = dl.gdrive
      .replace(
        "https://drive.usercontent.google.com/download?id=",
        "https://drive.google.com/file/d/"
      )
      .replace("&export=download", "/view");

    const file = await fg.GDriveDl(fixedLink);

    /* 7️⃣ Delete uploading msg */
    await conn.sendMessage(from, { delete: uploading.key });

    /* 8️⃣ Send document */
    const sent = await conn.sendMessage(
      from,
      {
        document: { url: file.downloadUrl },
        fileName: file.fileName,
        mimetype: file.mimetype,
        caption:
          file.fileName.replace("[Cinesubz.co]", "") +
          `\n\n${FOOTER}`,
      },
      { quoted: infoMsg }
    );

    await react(conn, from, sent.key, "✅");
  } catch (e) {
    console.error("MOVIESUB ERROR:", e);
    reply("⚠️ Error:\n" + e.message);
  }
});
