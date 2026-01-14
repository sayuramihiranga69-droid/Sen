const { cmd } = require('../command');
const axios = require('axios');

// Store last search results for each chat
global.lastCineSearch = global.lastCineSearch || {};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1️⃣ CINESUBZ SEARCH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
    pattern: "cinesearch",
    alias: ["moviesearch", "csearch"],
    desc: "Search movies/TV shows on CineSubz",
    category: "downloader",
    react: "🔍",
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

        // Store search results
        global.lastCineSearch[from] = data.data.slice(0, 10);

        let message = `🎬 *CineSubz Search Results for:* ${q}\n\n`;
        global.lastCineSearch[from].forEach((item, i) => {
            message += `*${i + 1}. ${item.title}*\n`;
            if (item.type) message += `📁 Type: ${item.type}\n`;
            if (item.quality) message += `📺 Quality: ${item.quality}\n`;
            if (item.rating) message += `⭐ Rating: ${item.rating}\n\n`;
        });

        message += `📌 Reply with a number (1-${global.lastCineSearch[from].length}) to get details.`;

        await reply(message);

    } catch (e) {
        console.error("Search error:", e);
        reply(`❌ Error: ${e.message}`);
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2️⃣ REPLY NUMBER → FETCH DETAILS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
    pattern: "^[0-9]{1,2}$", // single/double digit numbers
    desc: "Get movie details from last search by number",
    category: "downloader",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        const num = parseInt(q.trim());
        const results = global.lastCineSearch[from];

        if (!results || results.length === 0) return reply("❌ No previous search found. Use .cinesearch first.");
        if (isNaN(num) || num < 1 || num > results.length) return reply(`❌ Invalid number. Reply with 1-${results.length}`);

        const movie = results[num - 1];
        const apiUrl = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-info?url=${encodeURIComponent(movie.link)}&apikey=deb4e2d4982c6bc2`;
        const { data } = await axios.get(apiUrl);

        if (!data.status || !data.data) return reply("❌ Failed to fetch movie details.");

        const info = data.data;
        let message = `🎬 *${info.title}*\n\n`;
        if (info.year) message += `📅 Year: ${info.year}\n`;
        if (info.quality) message += `📺 Quality: ${info.quality}\n`;
        if (info.rating) message += `⭐ Rating: ${info.rating}\n`;
        if (info.duration) message += `⏱ Duration: ${info.duration}\n`;
        if (info.country) message += `🌍 Country: ${info.country}\n`;
        if (info.directors) message += `🎬 Directors: ${info.directors}\n\n`;

        if (info.downloads && info.downloads.length > 0) {
            message += `📥 *Available Download Links:*\n\n`;
            info.downloads.forEach((dl, idx) => {
                message += `*${idx + 1}. ${dl.quality}* (${dl.size})\n`;
                message += `🔗 ${dl.link}\n\n`;
            });
        } else {
            message += `❌ No download links available.`;
        }

        if (info.image) {
            await conn.sendMessage(from, { image: { url: info.image }, caption: message }, { quoted: mek });
        } else {
            await reply(message);
        }

    } catch (e) {
        console.error("Details error:", e);
        reply(`❌ Error: ${e.message}`);
    }
});
