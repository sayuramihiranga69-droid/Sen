const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');

const footer = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌☢️☘";

// ───────── React helper ─────────
async function react(conn, jid, key, emoji) {
    try { await conn.sendMessage(jid, { react: { text: emoji, key } }); } catch {}
}

// ───────── Create thumbnail ─────────
async function makeThumbnail(url) {
    try {
        const img = await axios.get(url, { responseType: "arraybuffer" });
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

// ───────── Send WhatsApp document ─────────
async function sendDocFile(conn, from, info, filePath, quality, quoted) {
    const thumb = info.image ? await makeThumbnail(info.image) : null;
    const caption = `🎬 *${info.title}*\n*${quality}*\n${footer}`;
    const docMsg = await conn.sendMessage(from, {
        document: { url: filePath },
        fileName: `${info.title} (${quality}).mp4`.replace(/[\/\\:*?"<>|]/g,""),
        mimetype: "video/mp4",
        jpegThumbnail: thumb || undefined,
        caption
    }, { quoted });
    await react(conn, from, docMsg.key, "✅");
}

// ───────── Command ─────────
cmd({
    pattern: "sinhalasubt",
    desc: "Search & download Sinhala subtitles movie with Pixeldrain flow",
    category: "downloader",
    react: "🔍",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example: .sinhalasubt Good News");
        await react(conn, from, m.key, "🔍");

        // 1️⃣ Search → /sinhalasub-search
        const searchRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-search?q=${encodeURIComponent(q)}&apikey=edbcfabbca5a9750`);
        const results = searchRes.data?.data;
        if (!results?.length) return reply("❌ No results found");

        let listText = "🎬 *Search Results*\n\n";
        results.slice(0, 10).forEach((v, i) => listText += `*${i+1}.* ${v.title}\n`);
        const listMsg = await conn.sendMessage(from, { text: listText + `\nReply number\n\n${footer}` }, { quoted: mek });

        // 2️⃣ User selects movie
        const { msg: movieMsg, text: movieText } = await waitForReply(conn, from, listMsg.key.id);
        const index = parseInt(movieText) - 1;
        if (isNaN(index) || !results[index]) return reply("❌ Invalid number");
        await react(conn, from, movieMsg.key, "🎬");
        const movie = results[index];

        // 3️⃣ Info → /sinhalasub-info
        const infoRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-info?url=${encodeURIComponent(movie.url)}&apikey=edbcfabbca5a9750`);
        const info = infoRes.data?.data;
        if (!info) return reply("❌ Failed to get movie info");

        const pix = info.downloads?.pixeldrain;
        if (!pix?.length) return reply("❌ No Pixeldrain links found");

        let qualityList = "";
        pix.forEach((d, i) => qualityList += `*${i+1}.* ${d.quality} (${d.size})\n`);
        const qualityMsg = await conn.sendMessage(from, {
            image: { url: info.image },
            caption: `🎬 *${info.title}*\n\nAvailable Downloads:\n${qualityList}\nReply download number\n${footer}`
        }, { quoted: movieMsg });

        // 4️⃣ User selects quality
        const { msg: dlMsg, text: dlText } = await waitForReply(conn, from, qualityMsg.key.id);
        const dIndex = parseInt(dlText) - 1;
        if (isNaN(dIndex) || !pix[dIndex]) return reply("❌ Invalid download number");
        await react(conn, from, dlMsg.key, "⬇️");
        const chosen = pix[dIndex];

        // 5️⃣ Pixeldrain page → /sinhalasub-download
        const pageRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-download?url=${encodeURIComponent(chosen.url)}&apikey=edbcfabbca5a9750`);
        const pageLink = pageRes.data?.data?.download;
        if (!pageLink) return reply("❌ Failed to get Pixeldrain page link");

        // 6️⃣ Real download → /download/pixeldrain
        const dlRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/download/pixeldrain?url=${encodeURIComponent(pageLink)}&apikey=edbcfabbca5a9750`);
        const realUrl = dlRes.data?.data?.download;
        if (!realUrl) return reply("❌ Failed to get real download URL");

        // 7️⃣ Download locally and send to WhatsApp
        const tempPath = path.join(os.tmpdir(), `${movie.title} (${chosen.quality}).mp4`);
        const writer = fs.createWriteStream(tempPath);
        const fileRes = await axios.get(realUrl, { responseType: 'stream' });
        fileRes.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        await sendDocFile(conn, from, info, tempPath, chosen.quality, dlMsg);
        fs.unlinkSync(tempPath);

    } catch (e) {
        console.error("SINHALASUB ERROR:", e);
        reply("⚠️ Error:\n" + e.message);
    }
});
