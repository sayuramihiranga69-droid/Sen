const { cmd } = require('../command');
const axios = require('axios');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1️⃣ SEARCH COMMAND
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
        if (!q) return reply("❗ Please provide a search query\nExample: .cinesearch Avatar");

        reply("🔍 Searching CineSubz...");

        const url = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-search?q=${encodeURIComponent(q)}&apikey=deb4e2d4982c6bc2`;
        const { data } = await axios.get(url);

        if (!data.status || !data.data || data.data.length === 0) {
            return reply("❌ No results found.");
        }

        let message = `🎬 *CineSubz Search Results*\n\n🔎 Query: *${q}*\n📊 Found: ${data.data.length} results\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        data.data.slice(0, 10).forEach((item, index) => {
            message += `*${index + 1}. ${item.title}*\n`;
            if (item.type) message += `   📁 Type: ${item.type}\n`;
            if (item.quality) message += `   📺 Quality: ${item.quality}\n`;
            if (item.rating) message += `   ⭐ Rating: ${item.rating}\n`;
            if (item.link) message += `   🔗 ${item.link}\n\n`;
        });

        message += `━━━━━━━━━━━━━━━━━━━━━━\n\n📌 Next: Use .cinedetails <movie/tv link>`;

        await conn.sendMessage(from, { text: message }, { quoted: mek });
    } catch (e) {
        console.error("Search error:", e);
        reply(`❌ Error: ${e.message}`);
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2️⃣ DETAILS COMMAND
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
        if (!q) return reply("❗ Please provide a CineSubz movie/tv URL\nExample: .cinedetails https://cinesubz.lk/movies/avatar-2022/");

        let cleanUrl = q.trim();

        const apiUrl = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-info?url=${encodeURIComponent(cleanUrl)}&apikey=deb4e2d4982c6bc2`;
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

        message += `\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        if (info.downloads && info.downloads.length > 0) {
            message += `📥 *Available Download Links:*\n\n`;
            info.downloads.forEach((dl, idx) => {
                message += `*${idx + 1}. ${dl.quality}* (${dl.size})\n`;
                message += `🔗 ${dl.link}\n\n`;
            });
            message += `━━━━━━━━━━━━━━━━━━━━━━\n\n📌 Use .cinedownload <link> to get Pixeldrain/Telegram links`;
        } else {
            message += `❌ No download links available.`;
        }

        if (info.image) {
            await conn.sendMessage(from, { image: { url: info.image }, caption: message }, { quoted: mek });
        } else {
            await conn.sendMessage(from, { text: message }, { quoted: mek });
        }

    } catch (e) {
        console.error("Details error:", e);
        reply(`❌ Error: ${e.message}`);
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3️⃣ DOWNLOAD COMMAND (API fetch Pixeldrain/Telegram links)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

        let cleanUrl = q.trim();

        const apiUrl = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-download?url=${encodeURIComponent(cleanUrl)}&apikey=deb4e2d4982c6bc2`;
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
