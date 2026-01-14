const { cmd } = require('../command');
const axios = require('axios');

// ================= GLOBAL =================
global.lastCineSearch = global.lastCineSearch || {};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1️⃣ CINESUBZ SEARCH COMMAND
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
    pattern: "cinesearch",
    alias: ["moviesearch", "csearch"],
    react: "🔍",
    category: "downloader",
    desc: "Search movies/TV shows on CineSubz",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Please provide a search query\nExample: .cinesearch Avatar");

        await reply("🔍 Searching CineSubz...");

        const url = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-search?q=${encodeURIComponent(q)}&apikey=deb4e2d4982c6bc2`;
        const { data } = await axios.get(url);

        if (!data.status || !data.data || data.data.length === 0) {
            return reply("❌ No results found.");
        }

        // Save search results for number reply
        global.lastCineSearch[from] = data.data.slice(0, 10);

        let message = `🎬 *CineSubz Search Results for:* ${q}\n\n`;
        global.lastCineSearch[from].forEach((item, index) => {
            message += `*${index + 1}. ${item.title}*\n`;
            if (item.type) message += `📁 Type: ${item.type}\n`;
            if (item.quality) message += `📺 Quality: ${item.quality}\n`;
            if (item.rating) message += `⭐ Rating: ${item.rating}\n`;
            message += `\n`;
        });
        message += `📌 Reply with a number (1-${global.lastCineSearch[from].length}) to get details.`;

        await conn.sendMessage(from, { text: message }, { quoted: mek });

    } catch (e) {
        console.error("CineSearch Error:", e);
        reply(`❌ Error: ${e.message}`);
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2️⃣ NUMBER REPLY HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
conn.ev.on('messages.upsert', async ({ messages }) => {
    try {
        const m = messages[0];
        if (!m.message || !m.key.remoteJid || !m.message.conversation) return;

        const from = m.key.remoteJid;
        const text = m.message.conversation.trim();

        if (!global.lastCineSearch[from]) return;

        const num = parseInt(text);
        if (!num || num < 1 || num > global.lastCineSearch[from].length) return;

        const item = global.lastCineSearch[from][num - 1];
        if (!item) return;

        // Fetch movie details
        const apiUrl = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-info?url=${encodeURIComponent(item.link)}&apikey=deb4e2d4982c6bc2`;
        const { data } = await axios.get(apiUrl);
        if (!data.status || !data.data) return;

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
            await conn.sendMessage(from, { image: { url: info.image }, caption: message });
        } else {
            await conn.sendMessage(from, { text: message });
        }

        // Clear the search after fetching details
        delete global.lastCineSearch[from];

    } catch (e) {
        console.error("Number reply handler error:", e);
    }
});
