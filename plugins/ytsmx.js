const { cmd } = require('../command');
const axios = require('axios');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GLOBAL STORAGE FOR LAST SEARCH
global.lastCineSearch = {};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1️⃣ SEARCH COMMAND
cmd({
    pattern: "cinesearch",
    alias: ["moviesearch", "csearch"],
    desc: "Search for movies/TV shows on CineSubz",
    category: "downloader",
    react: "🔍",
    filename: __filename
}, async (conn, mek, m, { from, q, prefix, reply }) => {
    try {
        if (!q) return reply("❗ Please provide a search query\nExample: .cinesearch Avatar");

        await conn.sendMessage(from, { text: "🔍 Searching CineSubz..." });

        const url = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-search?q=${encodeURIComponent(q)}&apikey=deb4e2d4982c6bc2`;
        const { data } = await axios.get(url);

        if (!data.status || !data.data || data.data.length === 0) {
            return reply("❌ No results found.");
        }

        // Save last search for number reply
        global.lastCineSearch[from] = data.data.slice(0, 10);

        // Prepare text list
        let text = `🎬 *CineSubz Search Results for:* ${q}\n\n`;
        global.lastCineSearch[from].forEach((item, index) => {
            text += `*${index + 1}. ${item.title}*\n📁 ${item.type || ''} | 📺 ${item.quality || ''} | ⭐ ${item.rating || 'N/A'}\n\n`;
        });
        text += `📌 Reply with a number (1-${global.lastCineSearch[from].length}) to get details.`;

        await conn.sendMessage(from, { text }, { quoted: mek });

    } catch (e) {
        console.error("Search error:", e);
        reply(`❌ Error: ${e.message}`);
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2️⃣ NUMBER REPLY HANDLER
cmd({
    pattern: "cinenum",
    desc: "Get CineSubz details by number",
    category: "downloader",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Please reply with a number from the search list.");

        const num = parseInt(q);
        if (!num || num < 1 || num > 10) return reply("❌ Invalid number. Please choose between 1-10.");

        const item = global.lastCineSearch[from][num - 1];
        if (!item) return reply("❌ Could not find the selected movie.");

        // Fetch details
        const apiUrl = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-info?url=${encodeURIComponent(item.link)}&apikey=deb4e2d4982c6bc2`;
        const { data } = await axios.get(apiUrl);

        if (!data.status || !data.data) return reply("❌ Failed to fetch movie details.");

        const info = data.data;
        let message = `🎬 *${info.title}*\n\n`;
        if (info.year) message += `📅 Year: ${info.year}\n`;
        if (info.quality) message += `📺 Quality: ${info.quality}\n`;
        if (info.rating) message += `⭐ Rating: ${info.rating}\n`;
        if (info.duration) message += `⏱ Duration: ${info.duration}\n`;
        if (info.country) message += `🌍 Country: ${info.country}\n`;
        if (info.directors) message += `🎬 Directors: ${info.directors}\n`;

        if (info.downloads && info.downloads.length > 0) {
            message += `\n📥 Available Download Links:\n`;
            info.downloads.forEach((dl, idx) => {
                message += `*${idx + 1}. ${dl.name.toUpperCase()}* → ${dl.url}\n`;
            });
        } else {
            message += `\n❌ No download links available.`;
        }

        if (info.image) {
            await conn.sendMessage(from, { image: { url: info.image }, caption: message }, { quoted: mek });
        } else {
            await conn.sendMessage(from, { text: message }, { quoted: mek });
        }

    } catch (e) {
        console.error("Number reply error:", e);
        reply(`❌ Error: ${e.message}`);
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3️⃣ DOWNLOAD LINKS COMMAND
cmd({
    pattern: "cinedownload",
    alias: ["cinedl", "cdl"],
    desc: "Fetch Pixeldrain/Telegram download links",
    category: "downloader",
    react: "📥",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Please provide a CineSubz download URL\nExample: .cinedownload <link>");

        const apiUrl = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-download?url=${encodeURIComponent(q)}&apikey=deb4e2d4982c6bc2`;
        const { data } = await axios.get(apiUrl);

        if (!data.status || !data.data || !data.data.download || data.data.download.length === 0) {
            return reply("❌ Failed to fetch download links.");
        }

        let message = `📥 *Download Links for ${data.data.title}*\n\n`;
        data.data.download.forEach((dl, idx) => {
            message += `*${idx + 1}. ${dl.name.toUpperCase()}* → ${dl.url}\n\n`;
        });

        message += `━━━━━━━━━━━━━━━━━━━━━━\n\n📌 Use your browser or Telegram to download the file.`;
        await conn.sendMessage(from, { text: message }, { quoted: mek });

    } catch (e) {
        console.error("Download API error:", e);
        reply(`❌ Failed to fetch download links: ${e.message}`);
    }
});
