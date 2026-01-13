const { cmd } = require('../command');
const axios = require('axios');

const API_KEY = "deb4e2d4982c6bc2";
const API_BASE = "https://api-dark-shan-yt.koyeb.app/movie";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔍 SEARCH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
  pattern: "cinesearch",
  alias: ["csearch"],
  desc: "Search CineSubz movies",
  category: "downloader",
  react: "🔍",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗ Usage: .cinesearch <movie name>");

    const url = `${API_BASE}/cinesubz-search?q=${encodeURIComponent(q)}&apikey=${API_KEY}`;
    const { data } = await axios.get(url);

    if (!data.status || !data.result || data.result.length === 0) {
      return reply("❌ No results found");
    }

    let msg = `🎬 *CineSubz Search Results*\n\n`;
    data.result.slice(0, 10).forEach((v, i) => {
      msg += `*${i + 1}. ${v.title}*\n`;
      msg += `🔗 ${v.url}\n\n`;
    });

    msg += `📌 Use:\n.cinedetails <url>`;

    await conn.sendMessage(from, { text: msg }, { quoted: mek });

  } catch (e) {
    console.log(e);
    reply("❌ Search error");
  }
});


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎬 DETAILS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
  pattern: "cinedetails",
  alias: ["cdetails"],
  desc: "Get movie details",
  category: "downloader",
  react: "🎬",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗ Usage: .cinedetails <cinesubz url>");

    const url = `${API_BASE}/cinesubz-info?url=${encodeURIComponent(q)}&apikey=${API_KEY}`;
    const { data } = await axios.get(url);

    if (!data.status || !data.result) {
      return reply("❌ Details not found");
    }

    const r = data.result;

    let msg = `🎬 *${r.title}*\n\n`;
    if (r.year) msg += `📅 Year: ${r.year}\n`;
    if (r.genre) msg += `🎭 Genre: ${r.genre}\n`;
    if (r.rating) msg += `⭐ Rating: ${r.rating}\n`;

    msg += `\n━━━━━━━━━━━━━━\n\n`;

    if (r.downloads && r.downloads.length > 0) {
      msg += `📥 *Download Links*\n\n`;
      r.downloads.forEach(v => {
        msg += `*${v.quality}*\n`;
        msg += `🔗 ${v.url}\n\n`;
      });
      msg += `📌 Use:\n.cinedownload <countdown_url>`;
    } else {
      msg += "❌ No downloads available";
    }

    if (r.image) {
      await conn.sendMessage(from, {
        image: { url: r.image },
        caption: msg
      }, { quoted: mek });
    } else {
      await conn.sendMessage(from, { text: msg }, { quoted: mek });
    }

  } catch (e) {
    console.log(e);
    reply("❌ Details error");
  }
});


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📥 DOWNLOAD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
  pattern: "cinedownload",
  alias: ["cdl"],
  desc: "Download movie",
  category: "downloader",
  react: "📥",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗ Usage: .cinedownload <countdown url>");

    const url = `${API_BASE}/cinesubz-download?url=${encodeURIComponent(q)}&apikey=${API_KEY}`;
    const { data } = await axios.get(url);

    if (!data.status || !data.result?.download_url) {
      return reply("❌ Download link error");
    }

    const dl = data.result.download_url;

    await conn.sendMessage(from, {
      document: { url: dl },
      mimetype: "video/mp4",
      fileName: `CineSubz_${Date.now()}.mp4`,
      caption: "✅ Downloaded via CineSubz"
    }, { quoted: mek });

  } catch (e) {
    console.log(e);
    reply("❌ Download failed");
  }
});
