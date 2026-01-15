const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "download",
    alias: ["downurl"],
    react: "🔰",
    desc: "Download with original file name from server headers.",
    category: "downloader",
    filename: __filename
},

async(conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ කරුණාකර download link එකක් ලබා දෙන්න.");

        const link = q.trim();
        const urlPattern = /^(https?:\/\/[^\s]+)/;
        if (!urlPattern.test(link)) return reply("❗ URL එක වැරදියි.");

        await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

        // 🔍 සර්වර් එකෙන් Headers ලබා ගැනීම
        const response = await axios.head(link, { 
            maxRedirects: 10,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }).catch(e => null);

        let fileName = "sayura-MD-File.mp4"; // Default නම

        if (response && response.headers['content-disposition']) {
            // 🏷️ Content-Disposition header එකෙන් නම ගලවා ගැනීම
            const disposition = response.headers['content-disposition'];
            const match = disposition.match(/filename=(?:["']([^"']+)["']|([^;]+))/);
            if (match) {
                fileName = match[1] || match[2];
            }
        } else {
            // Header එකේ නැත්නම් URL එකෙන් නම ගන්නවා
            const urlName = new URL(link).pathname.split('/').pop();
            if (urlName) fileName = decodeURIComponent(urlName);
        }

        let info = `*© ᴄʀᴇᴀᴛᴇᴅ ʙʏ ꜱayura mihiranga*`;

        await conn.sendMessage(from, {
            document: { url: link },
            mimetype: "video/mp4",
            fileName: fileName, // මෙතනට දැන් නියම නම ලැබෙනවා
            caption: info
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: m.key } });

    } catch (e) {
        console.log(e);
        reply(`❌ Error: ${e.message}`);
    }
});
