const { cmd } = require("../command");
const axios = require("axios");
const config = require('../config');
const NodeCache = require("node-cache");

const movieCache = new NodeCache({ stdTTL: 100, checkperiod: 120 });
 cmd({
  pattern: "ck",
  alias: ["cine"],
  desc: "🎥 Search Sinhala subbed movies from CineSubz",
  category: "media",
  react: "🎬",
  filename: __filename
}, async (conn, mek, m, { from, q }) => {

  if (!q) return conn.sendMessage(from, { text: "Use: .cinesubz <movie name>" }, { quoted: mek });

  try {
    const cacheKey = `cinesubz_${q.toLowerCase()}`;
    let data = movieCache.get(cacheKey);

    if (!data) {
      const url = `https://darkyasiya-new-movie-api.vercel.app/api/movie/cinesubz/search?q=${encodeURIComponent(q)}`;
      const res = await axios.get(url);
      data = res.data;

      if (!data.success || !data.data.all?.length) throw new Error("No results found for your query.");

      movieCache.set(cacheKey, data);
    }

    const movieList = data.data.all.map((m, i) => ({
      number: i + 1,
      title: m.title,
      link: m.link
    }));

    let textList = "🔢 Reply below with number\n━━━━━━━━━━━━━━━\n\n";
    movieList.forEach((m) => textList += `🔸 *${m.number}. ${m.title}*\n`);
    textList += "\n💬 *Reply with movie number to view details.*";

    const sentMsg = await conn.sendMessage(from, { text: `*🔍 CineSubz Search Results*\n\n${textList}` }, { quoted: mek });
    const movieMap = new Map();

    const listener = async (update) => {
      const msg = update.messages?.[0];
      if (!msg?.message?.extendedTextMessage) return;

      const replyText = msg.message.extendedTextMessage.text.trim();
      const repliedId = msg.message.extendedTextMessage.contextInfo?.stanzaId;

      if (replyText.toLowerCase() === "done") {
        conn.ev.off("messages.upsert", listener);
        return conn.sendMessage(from, { text: "✅ Cancelled" }, { quoted: msg });
      }

      if (repliedId === sentMsg.key.id) {
        const num = parseInt(replyText);
        const selected = movieList.find(m => m.number === num);
        if (!selected) return conn.sendMessage(from, { text: "*Invalid movie number*" }, { quoted: msg });

        await conn.sendMessage(from, { react: { text: "🎯", key: msg.key } });

        const movieUrl = `https://darkyasiya-new-movie-api.vercel.app/api/movie/cinesubz/movie?url=${encodeURIComponent(selected.link)}`;
        const movieRes = await axios.get(movieUrl);
        const movie = movieRes.data.data;

        if (!movie.downloadUrl?.length) return conn.sendMessage(from, { text: "*No download links available*" }, { quoted: msg });

        // Filter only working hosts (Pixeldrain)
        movie.downloadUrl = movie.downloadUrl.filter(d => d.link.includes("pixeldrain.com"));
        if (!movie.downloadUrl.length) return conn.sendMessage(from, { text: "*No working download links*" }, { quoted: msg });

        let info = `🎬 *${movie.title}*\n\n🎥 Download Links:\n\n`;
        movie.downloadUrl.forEach((d, i) => info += `♦️ ${i + 1}. *${d.quality}* — ${d.size}\n`);
        info += "\n🔢 Reply with number to download";

        const downloadMsg = await conn.sendMessage(from, {
          image: { url: movie.mainImage },
          caption: info
        }, { quoted: msg });

        movieMap.set(downloadMsg.key.id, { selected, downloads: movie.downloadUrl });
      }

      else if (movieMap.has(repliedId)) {
        const { selected, downloads } = movieMap.get(repliedId);
        const num = parseInt(replyText);
        const chosen = downloads[num - 1];
        if (!chosen) return conn.sendMessage(from, { text: "*Invalid quality number*" }, { quoted: msg });

        await conn.sendMessage(from, { react: { text: "📥", key: msg.key } });

        // Pixeldrain API direct link
        const match = chosen.link.match(/\/([A-Za-z0-9]+)$/);
        const directLink = match ? `https://pixeldrain.com/api/file/${match[1]}` : chosen.link;

        await conn.sendMessage(from, {
          document: { url: directLink },
          mimetype: "video/mp4",
          fileName: `${selected.title} - ${chosen.quality}.mp4`,
          caption: `🎬 *${selected.title}*\n🎥 *${chosen.quality}*`
        }, { quoted: msg });
      }
    };

    conn.ev.on("messages.upsert", listener);

  } catch (err) {
    await conn.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: mek });
  }
});
