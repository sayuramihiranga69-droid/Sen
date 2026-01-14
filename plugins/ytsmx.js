const { cmd } = require('../command');
const axios = require('axios');

// ================= GLOBAL =================
global.lastCineSearch = global.lastCineSearch || [];

// ================= CINESEARCH =================
cmd({
    pattern: "cinesearch",
    alias: ["moviesearch", "csearch"],
    react: "🔍",
    category: "downloader",
    desc: "Search movies/TV on CineSubz",
    filename: __filename
}, async (conn, m, mek, { from, q, prefix, reply }) => {
    try {
        if (!q) return reply("❗ Please provide a search query\nExample: .cinesearch Avatar");

        reply("🔍 Searching CineSubz...");

        const url = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-search?q=${encodeURIComponent(q)}&apikey=deb4e2d4982c6bc2`;
        const { data } = await axios.get(url);

        if (!data.status || !data.data || data.data.length === 0)
            return reply("❌ No results found.");

        // Save last search globally
        global.lastCineSearch = data.data.slice(0, 10);

        // Prepare list message
        const rows = global.lastCineSearch.map((item, i) => ({
            title: `${i+1}. ${item.title}`,
            rowId: prefix + 'cinenum ' + (i+1)
        }));

        const listMessage = {
            text: `🎬 CineSubz Search Results for: ${q}\n\nReply with a number to get details.`,
            footer: 'CineSubz Downloader',
            buttonText: 'Select Number',
            sections: [{ title: '_Results_', rows }]
        };

        await conn.replyList(from, listMessage, { quoted: mek });

    } catch (e) {
        console.error("CineSearch Error:", e);
        reply("❌ Error: " + e.message);
    }
});

// ================= CINESEARCH NUMBER REPLY =================
cmd({
    pattern: "cinenum",
    dontAddCommandList: true,
    filename: __filename
}, async (conn, m, mek, { from, q, reply }) => {
    try {
        if (!global.lastCineSearch || !global.lastCineSearch.length)
            return reply("*No previous search found!*");

        const num = parseInt(q);
        if (isNaN(num) || num < 1 || num > global.lastCineSearch.length)
            return reply("*Invalid number!*");

        const movie = global.lastCineSearch[num - 1];

        // Fetch movie details
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
            message += `📥 *Available Download Links:*\n`;
            info.downloads.forEach((dl, idx) => {
                message += `*${idx + 1}. ${dl.name.toUpperCase()}* → ${dl.url}\n`;
            });
        } else {
            message += `❌ No download links available.`;
        }

        if (info.image) {
            await conn.sendMessage(from, { image: { url: info.image }, caption: message }, { quoted: mek });
        } else {
            await conn.sendMessage(from, { text: message }, { quoted: mek });
        }

    } catch (e) {
        console.error("CineNumber Error:", e);
        reply("❌ Error: " + e.message);
    }
});

// ================= CINE DOWNLOAD COMMAND (OPTIONAL) =================
cmd({
    pattern: "cinedownload",
    alias: ["cinedl", "cdl"],
    desc: "Download movie from Pixeldrain/Telegram links",
    category: "downloader",
    react: "📥",
    filename: __filename
}, async (conn, m, mek, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Please provide a download link\nExample: .cinedownload <link>");

        await conn.sendMessage(from, {
            document: { url: q },
            mimetype: "video/mp4",
            fileName: `CineSubz_${Date.now()}.mp4`,
            caption: "✅ Downloaded via CineSubz API"
        }, { quoted: mek });

        reply("✅ Download command executed. File should start sending shortly.");
    } catch (e) {
        console.error("Download Error:", e);
        reply("❌ Download failed: " + e.message);
    }
});
