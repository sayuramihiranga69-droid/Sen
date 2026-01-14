const { cmd } = require('../command');
const axios = require('axios');

// Temporary cache per user to store search results
const cineCache = {};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1️⃣ SEARCH COMMAND
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
  pattern: "cinesearch",
  alias: ["moviesearch", "csearch"],
  desc: "Search for movies/TV shows on CineSubz (reply with number to get details)",
  category: "downloader",
  react: "🔍",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗ Please provide a search query\nExample: .cinesearch Avatar");

    reply("🔍 Searching CineSubz...");

    const url = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-search?q=${encodeURIComponent(q)}&apikey=deb4e2d4982c6bc2`;
    const { data } = await axios.get(url);

    if (!data.status || !data.data || data.data.length === 0)
      return reply("❌ No results found.");

    const results = data.data.slice(0, 10); // top 10
    cineCache[from] = results; // save for number reply

    let message = `🎬 *CineSubz Search Results*\n\n🔎 Query: *${q}*\n📊 Found: ${data.data.length} results\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    results.forEach((item, index) => {
      message += `*${index + 1}. ${item.title}*\n`;
      if (item.type) message += `   📁 Type: ${item.type}\n`;
      if (item.quality) message += `   📺 Quality: ${item.quality}\n`;
      if (item.rating) message += `   ⭐ Rating: ${item.rating}\n`;
      message += "\n";
    });

    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n📌 Reply with the *number* of the movie to get details & download links`;

    await conn.sendMessage(from, { text: message }, { quoted: mek });

    // console log
    console.log(`🔎 Search Results for "${q}"`);
    results.forEach((item, i) => {
      console.log(`${i + 1}. ${item.title} | Type: ${item.type} | Quality: ${item.quality} | Rating: ${item.rating}`);
    });
  } catch (e) {
    console.error("Search error:", e);
    reply(`❌ Error: ${e.message}`);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2️⃣ NUMBER REPLY HANDLER (movie details + download links)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
  on: "text"
}, async (conn, mek, m, { from, body, reply }) => {
  try {
    if (!cineCache[from]) return; // nothing in cache

    const num = parseInt(body.trim());
    if (isNaN(num)) return; // not a number

    const list = cineCache[from];
    const selected = list[num - 1];
    if (!selected) return reply("❌ Invalid number. Reply with a valid number from the list.");

    delete cineCache[from]; // clear cache after selection

    reply("⏳ Fetching movie details...");

    const infoUrl = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-info?url=${encodeURIComponent(selected.link)}&apikey=deb4e2d4982c6bc2`;
    const { data } = await axios.get(infoUrl);

    if (!data.status || !data.data) return reply("❌ Failed to fetch movie details.");

    const info = data.data;

    // send message with movie details
    let message = `🎬 *${info.title}*\n\n`;
    if (info.year) message += `📅 Year: ${info.year}\n`;
    if (info.quality) message += `📺 Quality: ${info.quality}\n`;
    if (info.rating) message += `⭐ Rating: ${info.rating}\n`;
    if (info.duration) message += `⏱ Duration: ${info.duration}\n`;
    if (info.country) message += `🌍 Country: ${info.country}\n`;
    if (info.directors) message += `🎬 Directors: ${info.directors}\n`;

    message += `\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (info.downloads && info.downloads.length > 0) {
      message += `📥 *Available Download Links:*\n\n`;
      info.downloads.forEach((dl, idx) => {
        message += `*${idx + 1}. ${dl.quality}* (${dl.size})\n🔗 ${dl.link}\n\n`;
      });
    } else {
      message += `❌ No download links available. Check console for full info.`;
    }

    // send to chat
    if (info.image) {
      await conn.sendMessage(from, { image: { url: info.image }, caption: message }, { quoted: mek });
    } else {
      reply(message);
    }

    // console log full info for debugging
    console.log("🎬 Movie Details:", info.title);
    console.log("Raw movie info object:", info);
    if (info.downloads && info.downloads.length > 0) {
      console.log("📥 Available Download Links:");
      info.downloads.forEach((dl, idx) => {
        console.log(`${idx + 1}. ${dl.quality} (${dl.size}) → ${dl.link}`);
      });
    } else {
      console.log("❌ No download links available.");
    }

  } catch (e) {
    console.error("Details error:", e);
    reply(`❌ Error: ${e.message}`);
  }
});
