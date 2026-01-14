const { cmd } = require('../command');
const axios = require('axios');
const sharp = require('sharp');

const sinhalaSub_footer = "✫☘ 𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌☢️☘";

// ───────── React helper ─────────
async function react(conn, jid, key, emoji) {
    try { await conn.sendMessage(jid, { react: { text: emoji, key } }); } catch {}
}

// ───────── Create thumbnail ─────────
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
        setTimeout(() => {
            conn.ev.off("messages.upsert", handler);
            reject(new Error("Reply timeout"));
        }, timeout);
    });
}

// ───────── Send document with caption ─────────
async function sendDocWithCaption(conn, from, info, file, quoted) {
    const thumb = info.image ? await makeThumbnail(info.image) : null;
    const captionText = `🎬 *${info.title}*\n*${file.quality}*\n${sinhalaSub_footer}`;
    const docMsg = await conn.sendMessage(from, {
        document: { url: file.url },
        fileName: `${info.title} (${file.quality}).mp4`.replace(/[\/\\:*?"<>|]/g,""),
        mimetype: "video/mp4",
        jpegThumbnail: thumb || undefined,
        caption: captionText
    }, { quoted });
    await react(conn, from, docMsg.key, "✅");
}

// ───────── Command ─────────
cmd({
    pattern: "sinhalasubt",
    desc: "Sinhala Sub movie download with real Pixeldrain link",
    category: "downloader",
    react: "🔍",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example: .sinhalasubt Avatar");
        await react(conn, from, m.key, "🔍");

        // 1️⃣ Search
        const searchRes = await axios.get(
            `https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-search?q=${encodeURIComponent(q)}&apikey=09acaa863782cc46`
        );
        const results = searchRes.data?.data;
        if (!results?.length) return reply("❌ No results found");

        let listText = `🎬 *Sinhala Sub Results*\n\n`;
        results.slice(0, 10).forEach((v, i) => { listText += `*${i + 1}.* ${v.title}\n`; });

        const listMsg = await conn.sendMessage(from, {
            text: listText + `\nReply number\n\n${sinhalaSub_footer}`
        }, { quoted: mek });

        // 2️⃣ Select movie
        const { msg: movieMsg, text: movieText } = await waitForReply(conn, from, listMsg.key.id);
        const index = parseInt(movieText) - 1;
        if (isNaN(index) || !results[index]) return reply("❌ Invalid number");
        await react(conn, from, movieMsg.key, "🎬");

        const movie = results[index];

        // 3️⃣ Get info (needed for Pixeldrain base URL)
        const infoRes = await axios.get(
            `https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-info?url=${encodeURIComponent(movie.url)}&apikey=09acaa863782cc46`
        );
        const info = infoRes.data?.data;
        if (!info) return reply("❌ Failed to get movie info");

        // 4️⃣ Prepare Pixeldrain download options
        const downloads = info.downloads?.pixeldrain;
        if (!downloads?.length) return reply("❌ No Pixeldrain downloads available");

        let dlTextList = `🎬 *${info.title}* Available Downloads:\n\n`;
        downloads.forEach((d, i) => { dlTextList += `*${i + 1}.* ${d.quality} (${d.size})\n`; });

        const dlMsgList = await conn.sendMessage(from, {
            text: dlTextList + `\nReply download number\n${sinhalaSub_footer}`
        }, { quoted: movieMsg });

        // 5️⃣ Select quality
        const { msg: dlMsg, text: dlText } = await waitForReply(conn, from, dlMsgList.key.id);
        const dIndex = parseInt(dlText) - 1;
        if (isNaN(dIndex) || !downloads[dIndex]) return reply("❌ Invalid download number");
        await react(conn, from, dlMsg.key, "⬇️");

        const chosen = downloads[dIndex];

        // 6️⃣ Send Pixeldrain base URL to download endpoint to get real file link
        const dlRes = await axios.get(
            `https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-download?url=${encodeURIComponent(chosen.url)}&apikey=09acaa863782cc46`
        );
        const realLink = dlRes.data?.data?.download;
        if (!realLink) return reply("❌ Failed to get real download link");

        // 7️⃣ Send document
        await sendDocWithCaption(conn, from, info, { url: realLink, quality: chosen.quality }, dlMsg);

    } catch (e) {
        console.error("SINHALA SUB ERROR:", e);
        reply("⚠️ Error:\n" + e.message);
    }
});
