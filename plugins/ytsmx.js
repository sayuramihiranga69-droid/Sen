const { cmd } = require('../command');
const axios = require('axios');

const API_KEY = "deb4e2d4982c6bc2"; // Dark Shan API key
const API_BASE = "https://api-dark-shan-yt.koyeb.app/movie";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1️⃣ SEARCH MOVIES / TV SHOWS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
  pattern: "cinesearch",
  alias: ["moviesearch", "csearch"],
  desc: "Search for movies/TV shows on CineSubz",
  category: "downloader",
  react: "🔍",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗ Please provide a search query\nUsage: .cinesearch <movie name>");

    reply("🔍 Searching CineSubz...");

    const url = `${API_BASE}/cinesubz-search?q=${encodeURIComponent(q)}&apikey=${API_KEY}`;
    const { data } = await axios.get(url);

    if (!data.status || !data.data || data.data.length === 0) {
      return reply("❌ No results found for your query.");
    }

    let message = `🎬 *CineSubz Search Results*\n\n🔎 Query: *${q}*\n📊 Found: ${data.data.length} results\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    data.data.slice(0, 10).forEach((item, index) => {
      message += `*${index + 1}. ${item.title}*\n`;
      message += `   📁 Type: ${item.type}\n`;
      message += `   📺 Quality: ${item.quality}\n`;
      message += `   ⭐ Rating: ${item.rating}\n`;
      message += `   🔗 ${item.link}\n\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n📌 Next: Use .cinedetails <movie/tv link>`;

    await conn.sendMessage(from, { text: message }, { quoted: mek });

  } catch (e) {
    console.error("Search Error:", e);
    reply(`❌ Error: ${e.message}`);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2️⃣ GET MOVIE / TV DETAILS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
  pattern: "cinedetails",
  alias: ["moviedetails", "cdetails", "cds"],
  desc: "Get movie/TV show details with download links",
  category: "downloader",
  react: "🎬",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗ Please provide a CineSubz URL\nUsage: .cinedetails <url>");

    const url = `${API_BASE}/cinesubz-info?url=${encodeURIComponent(q)}&apikey=${API_KEY}`;
    reply("⏳ Fetching details...");
    const { data } = await axios.get(url);

    if (!data.status || !data.data) return reply("❌ Failed to fetch details.");

    const info = data.data;

    let message = `🎬 *${info.title}*\n📅 Year: ${info.year || "N/A"}\n📺 Quality: ${info.quality || "N/A"}\n⭐ Rating: ${info.rating || "N/A"}\n⏱ Duration: ${info.duration || "N/A"}\n🌍 Country: ${info.country || "N/A"}\n🎬 Directors: ${info.directors || "N/A"}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (info.download && info.download.length > 0) {
      message += `📥 *Available Download Links:*\n\n`;
      info.download.forEach((dl, index) => {
        message += `*${index + 1}. ${dl.quality || dl.name}*\n`;
        message += `💾 Size: ${dl.size || "N/A"}\n`;
        message += `🔗 ${dl.link || dl.url}\n\n`;
      });
      message += `━━━━━━━━━━━━━━━━━━━━━━\n\n📌 To download: Use .cinedownload <link>`;
    } else {
      message += "❌ No download links available.";
    }

    await conn.sendMessage(from, {
      image: { url: info.image },
      caption: message
    }, { quoted: mek });

  } catch (e) {
    console.error("Details Error:", e);
    reply(`❌ Error: ${e.message}`);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3️⃣ DOWNLOAD MOVIE / EPISODE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
  pattern: "cinedownload",
  alias: ["cinedl", "cdl"],
  desc: "Download movie/episode from CineSubz",
  category: "downloader",
  react: "📥",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗ Please provide a download URL\nUsage: .cinedownload <url>");

    const url = `${API_BASE}/cinesubz-download?url=${encodeURIComponent(q)}&apikey=${API_KEY}`;
    reply("⏳ Resolving download links...");
    const { data } = await axios.get(url);

    if (!data.status || !data.data) return reply("❌ Failed to resolve download links.");

    const info = data.data;

    let message = `🎬 *${info.title}*\n💾 Size: ${info.size}\n\n📥 *Available Download Links:*\n\n`;

    info.download.forEach((dl, index) => {
      message += `*${index + 1}. ${dl.name}*\n🔗 ${dl.url}\n\n`;
    });

    await conn.sendMessage(from, { text: message }, { quoted: mek });

  } catch (e) {
    console.error("Download Error:", e);
    reply(`❌ Error: ${e.message}`);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4️⃣ HELP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
  pattern: "cinehelp",
  alias: ["moviehelp"],
  desc: "Show CineSubz downloader commands",
  category: "downloader",
  react: "ℹ️",
  filename: __filename
}, async (conn, mek, m, { from, reply }) => {
  const helpText = `📚 *CineSubz Downloader Commands*

━━━━━━━━━━━━━━━━━━━━━━

1️⃣ Search Movies/Shows:
   .cinesearch <name>

2️⃣ Get Details & Links:
   .cinedetails <url>

3️⃣ Download Movie/Episode:
   .cinedownload <link>

━━━━━━━━━━━━━━━━━━━━━━

🎯 Workflow:

For Movies:
.cinesearch → .cinedetails → .cinedownload

For TV Shows:
.cinesearch → .cinedetails → .cinedownload

━━━━━━━━━━━━━━━━━━━━━━

💡 Tips:
• Copy URLs carefully
• Some download links are external (pixeldrain, telegram)
• Use .cinedownload only with valid download links`;

  reply(helpText);
});
