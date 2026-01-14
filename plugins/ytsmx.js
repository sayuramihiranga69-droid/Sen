const { cmd } = require('../command');
const axios = require('axios');

/* ================= GLOBAL CACHE ================= */
global.cineCache = {};

/* ================= 1️⃣ CINESEARCH ================= */
cmd({
    pattern: "cinesearch",
    alias: ["csearch"],
    react: "🔍",
    category: "downloader",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ .cinesearch <movie name>");

        const { data } = await axios.get(
            `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-search?q=${encodeURIComponent(q)}&apikey=deb4e2d4982c6bc2`
        );

        if (!data.status || !data.data || data.data.length === 0) {
            return reply("❌ No results found");
        }

        // 🔐 Save results per chat
        global.cineCache[from] = data.data.slice(0, 10);

        let msg = `🎬 *CineSubz Search Results*\n`;
        msg += `🔎 Query: *${q}*\n\n`;

        global.cineCache[from].forEach((v, i) => {
            msg += `*${i + 1}. ${v.title}*\n`;
            msg += `📁 ${v.type || 'N/A'} | 📺 ${v.quality || 'N/A'} | ⭐ ${v.rating || 'N/A'}\n\n`;
        });

        msg += `📌 *Reply with a number (1–${global.cineCache[from].length})*`;

        await conn.sendMessage(from, { text: msg }, { quoted: mek });

    } catch (e) {
        console.error("cinesearch error:", e);
        reply("❌ Search failed");
    }
});

/* ================= 2️⃣ NUMBER REPLY HANDLER ================= */
cmd({
    on: "text",
    dontAddCommandList: true,
    filename: __filename
}, async (conn, mek, m, { body }) => {

    const chatId = mek.chat;
    const list = global.cineCache[chatId];

    // ❌ No active search
    if (!list) return;

    const num = parseInt(body.trim());
    if (isNaN(num) || num < 1 || num > list.length) return;

    // ✅ Correct selected movie
    const selected = list[num - 1];

    // 🧹 Clear cache after selection
    delete global.cineCache[chatId];

    try {
        /* ================= DETAILS ================= */
        const infoRes = await axios.get(
            `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-info?url=${encodeURIComponent(selected.link)}&apikey=deb4e2d4982c6bc2`
        );

        if (!infoRes.data.status) {
            return conn.sendMessage(chatId, { text: "❌ Failed to load details" }, { quoted: mek });
        }

        const info = infoRes.data.data;

        let msg = `🎬 *${info.title}*\n\n`;
        msg += `📅 Year: ${info.year || 'N/A'}\n`;
        msg += `📺 Quality: ${info.quality || 'N/A'}\n`;
        msg += `⭐ Rating: ${info.rating || 'N/A'}\n`;
        msg += `⏱ Duration: ${info.duration || 'N/A'}\n\n`;

        /* ================= DOWNLOAD LINKS ================= */
        const dlRes = await axios.get(
            `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-download?url=${encodeURIComponent(selected.link)}&apikey=deb4e2d4982c6bc2`
        );

        if (dlRes.data.status && dlRes.data.data && dlRes.data.data.download?.length) {
            msg += `📥 *Download Links:*\n\n`;
            dlRes.data.data.download.forEach((v, i) => {
                msg += `*${i + 1}. ${v.name.toUpperCase()}*\n🔗 ${v.url}\n\n`;
            });
        } else {
            msg += `❌ No download links found`;
        }

        if (info.image) {
            await conn.sendMessage(chatId, {
                image: { url: info.image },
                caption: msg
            }, { quoted: mek });
        } else {
            await conn.sendMessage(chatId, { text: msg }, { quoted: mek });
        }

    } catch (err) {
        console.error("number reply error:", err);
        conn.sendMessage(chatId, { text: "❌ Error loading movie" }, { quoted: mek });
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
