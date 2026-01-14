const { cmd } = require('../command');
const axios = require('axios');
const sharp = require('sharp');

const footer = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌☢️☘";

// ───────── React helper ─────────
async function react(conn, jid, key, emoji) {
    try {
        await conn.sendMessage(jid, { react: { text: emoji, key } });
    } catch {}
}

// ───────── Create thumbnail ─────────
async function makeThumbnail(url) {
    try {
        const res = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
        return await sharp(res.data).resize(300).jpeg({ quality: 65 }).toBuffer();
    } catch {
        return null;
    }
}

// ───────── Wait for user reply ─────────
function waitForReply(conn, from, msgId, timeout = 60000) {
    return new Promise((resolve, reject) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;
            const text = msg.message.conversation || msg.message?.extendedTextMessage?.text;
            const ctx = msg.message?.extendedTextMessage?.contextInfo;
            if (msg.key.remoteJid === from && ctx?.stanzaId === msgId) {
                conn.ev.off("messages.upsert", handler);
                resolve({ msg, text });
            }
        };
        conn.ev.on("messages.upsert", handler);
        setTimeout(() => {
            conn.ev.off("messages.upsert", handler);
            reject(new Error("Reply timeout"));
        }, timeout);
    });
}

// ───────── Send video directly ─────────
async function sendVideo(conn, from, url, info, quality, quoted) {
    try {
        const finalRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-download?url=${encodeURIComponent(url)}&apikey=09acaa863782cc46`);
        const videoUrl = finalRes.data?.data?.download;
        if (!videoUrl) return await conn.sendMessage(from, { text: "❌ Failed to get final download link" }, { quoted });

        const thumb = info.image ? await makeThumbnail(info.image) : null;

        await conn.sendMessage(from, {
            video: { url: videoUrl },
            caption: `${info.title}\nQuality: ${quality}\n\n${footer}`,
            jpegThumbnail: thumb || undefined
        }, { quoted });
    } catch (e) {
        console.error("SendVideo error:", e);
        await conn.sendMessage(from, { text: "❌ Error sending video: " + e.message }, { quoted });
    }
}

// ───────── Command ─────────
cmd({
    pattern: "sinhalasubt",
    desc: "Download Sinhala Subtitles movies with Pixeldrain video",
    category: "downloader",
    react: "🔍",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example: .sinhalasubt Avatar");
        await react(conn, from, m.key, "🔍");

        // 1️⃣ Search
        const searchRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-search?q=${encodeURIComponent(q)}&apikey=09acaa863782cc46`);
        const results = searchRes.data?.data;
        if (!results?.length) return reply("❌ No results found");

        let listText = `🎬 *CineSubz Results*\n\n`;
        results.slice(0, 10).forEach((v, i) => listText += `*${i+1}.* ${v.title}\n`);
        const listMsg = await conn.sendMessage(from, { text: listText + `\nReply number\n\n${footer}` }, { quoted: mek });

        // 2️⃣ Select movie
        const { msg: movieMsg, text: movieText } = await waitForReply(conn, from, listMsg.key.id);
        const movieIndex = parseInt(movieText) - 1;
        if (isNaN(movieIndex) || !results[movieIndex]) return reply("❌ Invalid number");

        await react(conn, from, movieMsg.key, "🎬");
        const movie = results[movieIndex];

        // 3️⃣ Fetch movie info
        const infoRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-info?url=${encodeURIComponent(movie.url)}&apikey=09acaa863782cc46`);
        const info = infoRes.data?.data;
        if (!info) return reply("❌ Failed to fetch movie info");

        // 4️⃣ List downloads
        let dlText = `🎬 *${info.title}*\n\n`;
        info.downloads.pixeldrain.forEach((d, i) => dlText += `*${i+1}.* ${d.quality} (${d.size})\n`);
        const dlMsg = await conn.sendMessage(from, { image: { url: info.image }, caption: dlText + `\nReply download number\n${footer}` }, { quoted: movieMsg });

        // 5️⃣ Select quality & send video
        const { msg: selMsg, text: selText } = await waitForReply(conn, from, dlMsg.key.id);
        const dlIndex = parseInt(selText) - 1;
        if (isNaN(dlIndex) || !info.downloads.pixeldrain[dlIndex]) return reply("❌ Invalid download number");

        const chosen = info.downloads.pixeldrain[dlIndex];
        await sendVideo(conn, from, chosen.url, info, chosen.quality, selMsg);

    } catch (e) {
        console.error("SinhalaSubT error:", e);
        reply("⚠️ Error: " + e.message);
    }
});
