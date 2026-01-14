const { cmd } = require('../command');
const axios = require('axios');

const sinhalasub_footer = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄☢️☘";
const API_KEY = "09acaa863782cc46";

// ───────── React helper ─────────
async function react(conn, jid, key, emoji) {
    try {
        await conn.sendMessage(jid, { react: { text: emoji, key } });
    } catch {}
}

// ───────── Send Pixeldrain doc ─────────
async function sendPixeldrainDoc(conn, from, fileUrl, fileName, quoted) {
    try {
        await conn.sendMessage(from, {
            document: { url: fileUrl },
            fileName: fileName.replace(/[\/\\:*?"<>|]/g, ""),
            mimetype: "video/mp4",
            caption: sinhalasub_footer
        }, { quoted });
    } catch (e) {
        console.error("Failed to send doc:", e);
        await conn.sendMessage(from, { text: "❌ Failed to send file: " + e.message }, { quoted });
    }
}

// ───────── Command ─────────
cmd({
    pattern: "sinhalasubt",
    desc: "SinhalaSub download as doc (Pixeldrain)",
    category: "downloader",
    react: "🔍",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example: .sinhalasubt New");

        await react(conn, from, m.key, "🔍");

        // 1️⃣ Search movies
        const searchRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-search?q=${encodeURIComponent(q)}&apikey=${API_KEY}`);
        const results = searchRes.data?.data;
        if (!results?.length) return reply("❌ No results found");

        let listText = `🎬 *SinhalaSub Results*\n\n`;
        results.slice(0, 10).forEach((v, i) => {
            listText += `*${i + 1}.* ${v.title} [${v.quality}]\n`;
        });

        const listMsg = await conn.sendMessage(from, { text: listText + "\nReply number\n\n" + sinhalasub_footer }, { quoted: mek });

        // 2️⃣ Wait for reply to select movie
        const selected = await new Promise((resolve, reject) => {
            const handler = (update) => {
                const msg = update.messages?.[0];
                if (!msg?.message) return;
                const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                if (msg.key.remoteJid === from && msg.message.extendedTextMessage?.contextInfo?.stanzaId === listMsg.key.id) {
                    conn.ev.off("messages.upsert", handler);
                    const idx = parseInt(text) - 1;
                    if (isNaN(idx) || !results[idx]) return reject("❌ Invalid number");
                    resolve(results[idx]);
                }
            };
            conn.ev.on("messages.upsert", handler);
            setTimeout(() => conn.ev.off("messages.upsert", handler) || reject("⚠️ Reply timeout"), 60000);
        });

        await react(conn, from, m.key, "🎬");

        // 3️⃣ Fetch movie info
        const infoRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-info?url=${encodeURIComponent(selected.url)}&apikey=${API_KEY}`);
        const info = infoRes.data?.data;
        if (!info) return reply("❌ Failed to get movie info");

        let infoText = `🎬 *${info.title}*\n\n📅 Year: ${info.year}\n📺 Quality: ${info.quality}\n⭐ Rating: ${info.rating}\n⏱ Duration: ${info.duration}\n🌍 Country: ${info.country}\n🎬 Directors: ${info.director.join(", ")}\n\n*Available Downloads:*\n`;
        info.downloads.pixeldrain.forEach((d, i) => {
            infoText += `*${i + 1}.* ${d.quality} (${d.size})\n`;
        });

        const infoMsg = await conn.sendMessage(from, { text: infoText + "\nReply download number\n" + sinhalasub_footer }, { quoted: mek });

        // 4️⃣ Wait for download reply
        const dlSelected = await new Promise((resolve, reject) => {
            const handler = (update) => {
                const msg = update.messages?.[0];
                if (!msg?.message) return;
                const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                if (msg.key.remoteJid === from && msg.message.extendedTextMessage?.contextInfo?.stanzaId === infoMsg.key.id) {
                    conn.ev.off("messages.upsert", handler);
                    const idx = parseInt(text) - 1;
                    if (isNaN(idx) || !info.downloads.pixeldrain[idx]) return reject("❌ Invalid number");
                    resolve(info.downloads.pixeldrain[idx]);
                }
            };
            conn.ev.on("messages.upsert", handler);
            setTimeout(() => conn.ev.off("messages.upsert", handler) || reject("⚠️ Reply timeout"), 60000);
        });

        await react(conn, from, m.key, "⬇️");

        // 5️⃣ Send as document
        await sendPixeldrainDoc(conn, from, dlSelected.url, `${info.title} [${dlSelected.quality}]`, mek);

    } catch (e) {
        console.error("SinhalaSub ERROR:", e);
        reply("⚠️ Error:\n" + e);
    }
});
