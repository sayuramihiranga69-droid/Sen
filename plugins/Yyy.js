const { cmd } = require('../command');
const axios = require('axios');
const sharp = require('sharp');

const footer = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄☢️☘";

// ───────── React helper ─────────
async function react(conn, jid, key, emoji) {
    try { await conn.sendMessage(jid, { react: { text: emoji, key } }); } catch {}
}

// ───────── Thumbnail maker ─────────
async function makeThumbnail(url) {
    try {
        const img = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
        return await sharp(img.data).resize(300).jpeg({ quality: 65 }).toBuffer();
    } catch (e) {
        console.log("Thumbnail error:", e.message);
        return null;
    }
}

// ───────── Wait for reply ─────────
function waitForReply(conn, from, replyToId, timeout = 120000) {
    return new Promise((resolve, reject) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;
            const ctx = msg.message?.extendedTextMessage?.contextInfo;
            const text = msg.message.conversation || msg.message?.extendedTextMessage?.text;
            if (msg.key.remoteJid === from && ctx?.stanzaId === replyToId) {
                conn.ev.off("messages.upsert", handler);
                resolve({ msg, text });
            }
        };
        conn.ev.on("messages.upsert", handler);
        setTimeout(() => { conn.ev.off("messages.upsert", handler); reject(new Error("Reply timeout")); }, timeout);
    });
}

// ───────── Send doc with thumbnail ─────────
async function sendDoc(conn, from, info, file, quoted) {
    const thumb = info.image ? await makeThumbnail(info.image) : null;
    const caption = `🎬 *${info.title}*\n*${file.quality}*\n${footer}`;
    const docMsg = await conn.sendMessage(from, {
        document: { url: file.url },
        fileName: `${info.title} (${file.quality}).mp4`.replace(/[\/\\:*?"<>|]/g,""),
        mimetype: "video/mp4",
        jpegThumbnail: thumb || undefined,
        caption
    }, { quoted });
    await react(conn, from, docMsg.key, "✅");
}

// ───────── Command ─────────
cmd({
    pattern: "sinhalasubt",
    desc: "Search and download Sinhala Subtitles movies",
    category: "downloader",
    react: "🔍",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example: .sinhalasub Good News");
        await react(conn, from, m.key, "🔍");

        // 1️⃣ Search
        const searchRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-search?q=${encodeURIComponent(q)}&apikey=deb4e2d4982c6bc2`);
        const results = searchRes.data?.data;
        if (!results?.length) return reply("❌ No results found");

        let listText = `🎬 *Sinhala Subtitles Search Results*\n\n`;
        results.slice(0, 10).forEach((v, i) => { listText += `*${i+1}.* ${v.title} (${v.quality})\n`; });

        const listMsg = await conn.sendMessage(from, {
            text: listText + `\nReply number\n\n${footer}`
        }, { quoted: mek });

        // 2️⃣ Select movie
        const { msg: movieMsg, text: movieText } = await waitForReply(conn, from, listMsg.key.id);
        const index = parseInt(movieText) - 1;
        if (isNaN(index) || !results[index]) return reply("❌ Invalid number");
        await react(conn, from, movieMsg.key, "🎬");

        const movie = results[index];

        // 3️⃣ Movie info
        const infoRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-info?url=${encodeURIComponent(movie.url)}&apikey=deb4e2d4982c6bc2`);
        const info = infoRes.data?.data;
        if (!info) return reply("❌ Failed to get movie info");

        let infoText = `🎬 *${info.title}*`;
        if(info.year) infoText += `\n📅 Year: ${info.year}`;
        if(info.quality) infoText += `\n📺 Quality: ${info.quality}`;
        if(info.rating) infoText += `\n⭐ Rating: ${info.rating}`;
        if(info.duration) infoText += `\n⏱ Duration: ${info.duration}`;
        if(info.country) infoText += `\n🌍 Country: ${info.country}`;
        if(info.director) infoText += `\n🎬 Directors: ${info.director.join(", ")}`;
        infoText += `\n\n*Available Downloads:*`;
        info.downloads.pixeldrain.forEach((d,i)=>{ infoText += `\n*${i+1}.* ${d.quality} (${d.size})`; });

        const infoMsg = await conn.sendMessage(from, {
            image: { url: info.image },
            caption: infoText + `\n\nReply download number\n${footer}`
        }, { quoted: movieMsg });

        // 4️⃣ Select download
        const { msg: dlMsg, text: dlText } = await waitForReply(conn, from, infoMsg.key.id);
        const dIndex = parseInt(dlText) - 1;
        if (isNaN(dIndex) || !info.downloads.pixeldrain[dIndex]) return reply("❌ Invalid download number");
        await react(conn, from, dlMsg.key, "⬇️");

        const chosen = info.downloads.pixeldrain[dIndex];

        // 5️⃣ Get final Pixeldrain link
        const dlRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-download?url=${encodeURIComponent(chosen.url)}&apikey=deb4e2d4982c6bc2`);
        const fileUrl = dlRes.data?.data?.download;
        if (!fileUrl) return reply("❌ Download link not found");

        // 6️⃣ Send doc with thumbnail + quality + footer
        await sendDoc(conn, from, info, { url: fileUrl, quality: chosen.quality }, dlMsg);

    } catch (e) {
        console.error("SINHALASUB ERROR:", e);
        reply("⚠️ Error:\n" + e.message);
    }
});
