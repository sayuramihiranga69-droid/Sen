const { cmd } = require('../command');
const axios = require('axios');

// ================= GLOBAL CACHE =================
global.cineSearchCache = {};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1️⃣ CINESEARCH (WITH NUMBER REPLY SYSTEM)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
    pattern: "cinesearch",
    alias: ["moviesearch", "csearch"],
    desc: "Search movies/TV shows on CineSubz",
    category: "downloader",
    react: "🔍",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example:\n.cinesearch new");

        reply("🔍 Searching CineSubz...");

        const apiUrl = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-search?q=${encodeURIComponent(q)}&apikey=deb4e2d4982c6bc2`;
        const { data } = await axios.get(apiUrl);

        if (!data.status || !Array.isArray(data.data) || data.data.length === 0) {
            return reply("❌ No results found.");
        }

        // Save results for number reply
        global.cineSearchCache[from] = data.data;

        let msg = `🎬 *CineSubz Search Results*\n\n`;
        msg += `🔎 Query: *${q}*\n`;
        msg += `📊 Found: ${data.data.length}\n\n`;

        data.data.slice(0, 10).forEach((v, i) => {
            msg += `*${i + 1}. ${v.title}*\n`;
            msg += `📁 ${v.type || 'N/A'} | 📺 ${v.quality || 'N/A'} | ⭐ ${v.rating || 'N/A'}\n\n`;
        });

        msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `📌 *Reply with a number (1–10)*`;

        await conn.sendMessage(from, { text: msg }, { quoted: mek });

    } catch (e) {
        console.error("cinesearch error:", e);
        reply("❌ Search failed.");
    }
});


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2️⃣ NUMBER REPLY HANDLER → AUTO CINEDETAILS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
    on: "text",
    dontAddCommandList: true,
    filename: __filename
}, async (conn, mek, m, { from, body, reply }) => {
    try {
        if (!global.cineSearchCache[from]) return;

        const num = parseInt(body);
        if (isNaN(num)) return;

        const list = global.cineSearchCache[from];
        if (num < 1 || num > list.length) {
            return reply("❌ Invalid number.");
        }

        const selected = list[num - 1];
        delete global.cineSearchCache[from];

        await conn.sendMessage(from, {
            text: `🎬 Fetching details for:\n*${selected.title}*`
        }, { quoted: mek });

        await conn.sendMessage(from, {
            text: `.cinedetails ${selected.link}`
        });

    } catch (e) {
        console.error("number reply error:", e);
    }
});


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3️⃣ CINEDETAILS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
    pattern: "cinedetails",
    alias: ["cdetails", "cds"],
    desc: "Get movie details + download qualities",
    category: "downloader",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example:\n.cinedetails <movie link>");

        const apiUrl = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-info?url=${encodeURIComponent(q)}&apikey=deb4e2d4982c6bc2`;
        const { data } = await axios.get(apiUrl);

        if (!data.status || !data.data) {
            return reply("❌ Failed to fetch details.");
        }

        const info = data.data;

        let msg = `🎬 *${info.title}*\n\n`;
        msg += `📅 Year: ${info.year || 'N/A'}\n`;
        msg += `📺 Quality: ${info.quality || 'N/A'}\n`;
        msg += `⭐ Rating: ${info.rating || 'N/A'}\n`;
        msg += `⏱ Duration: ${info.duration || 'N/A'}\n`;
        msg += `🌍 Country: ${info.country || 'N/A'}\n`;
        msg += `🎬 Directors: ${info.directors || 'N/A'}\n\n`;

        if (info.downloads && info.downloads.length > 0) {
            msg += `📥 *Available Downloads*\n\n`;
            info.downloads.forEach((d, i) => {
                msg += `*${i + 1}. ${d.quality}* (${d.size})\n`;
                msg += `🔗 ${d.link}\n\n`;
            });
            msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
            msg += `📌 Use:\n.cinedownload <link>`;
        } else {
            msg += `❌ No download links available.`;
        }

        if (info.image) {
            await conn.sendMessage(from, {
                image: { url: info.image },
                caption: msg
            }, { quoted: mek });
        } else {
            await conn.sendMessage(from, { text: msg }, { quoted: mek });
        }

    } catch (e) {
        console.error("cinedetails error:", e);
        reply("❌ Details failed.");
    }
});


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4️⃣ CINEDOWNLOAD (PIXELDRAIN / TELEGRAM LINKS)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
    pattern: "cinedownload",
    alias: ["cinedl", "cdl"],
    desc: "Fetch Pixeldrain / Telegram links",
    category: "downloader",
    react: "📥",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example:\n.cinedownload <download link>");

        const apiUrl = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-download?url=${encodeURIComponent(q)}&apikey=deb4e2d4982c6bc2`;
        const { data } = await axios.get(apiUrl);

        if (!data.status || !data.data || !Array.isArray(data.data.download)) {
            return reply("❌ Download links not found.");
        }

        let msg = `📥 *Download Links*\n\n`;
        msg += `🎬 ${data.data.title}\n`;
        msg += `📦 Size: ${data.data.size || 'N/A'}\n\n`;

        data.data.download.forEach((d, i) => {
            msg += `*${i + 1}. ${d.name.toUpperCase()}*\n`;
            msg += `${d.url}\n\n`;
        });

        msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `📌 Open link in browser or Telegram`;

        await conn.sendMessage(from, { text: msg }, { quoted: mek });

    } catch (e) {
        console.error("cinedownload error:", e);
        reply("❌ Failed to fetch download links.");
    }
});
