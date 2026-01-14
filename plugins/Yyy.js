const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');

const API_KEY = "edbcfabbca5a9750";
const FOOTER = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌☢️☘";

// ───────── React helper ─────────
async function react(conn, jid, key, emoji) {
    try {
        await conn.sendMessage(jid, {
            react: { text: emoji, key }
        });
    } catch {}
}

// ───────── Thumbnail ─────────
async function makeThumbnail(url) {
    try {
        const img = await axios.get(url, { responseType: "arraybuffer" });
        return await sharp(img.data)
            .resize(300)
            .jpeg({ quality: 60 })
            .toBuffer();
    } catch (e) {
        console.log("❌ Thumbnail error:", e.message);
        return null;
    }
}

// ───────── Wait for reply ─────────
function waitForReply(conn, from, replyId, timeout = 120000) {
    return new Promise((resolve, reject) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;

            const text =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text;

            const ctx = msg.message.extendedTextMessage?.contextInfo;

            if (
                msg.key.remoteJid === from &&
                ctx?.stanzaId === replyId
            ) {
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

// ───────── Send document ─────────
async function sendDoc(conn, from, info, filePath, quality, quoted) {
    const thumb = info.image ? await makeThumbnail(info.image) : null;

    await conn.sendMessage(from, {
        document: { url: filePath },
        fileName: `${info.title} (${quality}).mp4`
            .replace(/[\\/:*?"<>|]/g, ""),
        mimetype: "video/mp4",
        jpegThumbnail: thumb || undefined,
        caption: `🎬 *${info.title}*\n*${quality}*\n\n${FOOTER}`
    }, { quoted });
}

// ───────── Command ─────────
cmd({
    pattern: "sinhalasubt",
    desc: "SinhalaSub UserDrive downloader",
    category: "downloader",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example: `.sinhalasubt New`");

        // 1️⃣ SEARCH
        console.log("🔎 Searching:", q);
        const search = await axios.get(
            `https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-search?q=${encodeURIComponent(q)}&apikey=${API_KEY}`
        );

        const results = search.data?.data;
        if (!results?.length) return reply("❌ No results");

        let text = "🎬 *Search Results*\n\n";
        results.slice(0, 10).forEach((v, i) => {
            text += `*${i + 1}.* ${v.title}\n`;
        });

        const listMsg = await conn.sendMessage(from, {
            text: text + `\nReply number\n\n${FOOTER}`
        }, { quoted: mek });

        // 2️⃣ SELECT MOVIE
        const { msg: selMsg, text: selText } =
            await waitForReply(conn, from, listMsg.key.id);

        const index = parseInt(selText) - 1;
        if (!results[index]) return reply("❌ Invalid selection");

        const movie = results[index];
        console.log("🎬 Movie:", movie.title);

        // 3️⃣ INFO
        console.log("📥 Fetching info...");
        const infoRes = await axios.get(
            `https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-info?url=${encodeURIComponent(movie.url)}&apikey=${API_KEY}`
        );

        const info = infoRes.data?.data;
        const usersdrive = info?.downloads?.usersdrive;

        if (!usersdrive?.length)
            return reply("❌ UserDrive links not found");

        let qText = "";
        usersdrive.forEach((d, i) => {
            qText += `*${i + 1}.* ${d.quality} (${d.size})\n`;
        });

        const qMsg = await conn.sendMessage(from, {
            image: { url: info.image },
            caption:
                `🎬 *${info.title}*\n\nAvailable UserDrive:\n\n` +
                qText +
                `\nReply number\n\n${FOOTER}`
        }, { quoted: selMsg });

        // 4️⃣ SELECT QUALITY
        const { msg: qSel, text: qNum } =
            await waitForReply(conn, from, qMsg.key.id);

        const qIndex = parseInt(qNum) - 1;
        if (!usersdrive[qIndex]) return reply("❌ Invalid quality");

        const chosen = usersdrive[qIndex];
        console.log("⬇️ Quality:", chosen.quality);

        // 5️⃣ PAGE LINK
        console.log("🌐 Fetching UserDrive page...");
        const page = await axios.get(
            `https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-download?url=${encodeURIComponent(chosen.url)}&apikey=${API_KEY}`
        );

        const pageLink = page.data?.data?.download;
        console.log("🔗 Page:", pageLink);

        // 6️⃣ REAL DOWNLOAD
        console.log("🚀 Fetching real URL...");
        const real = await axios.get(
            `https://api-dark-shan-yt.koyeb.app/download/userdrive?url=${encodeURIComponent(pageLink)}&apikey=${API_KEY}`
        );

        const realUrl = real.data?.data?.download;
        console.log("✅ Direct URL:", realUrl);

        // 7️⃣ DOWNLOAD & SEND
        const temp = path.join(
            os.tmpdir(),
            `${info.title}-${chosen.quality}.mp4`
        );

        const stream = await axios.get(realUrl, { responseType: "stream" });
        const writer = fs.createWriteStream(temp);
        stream.data.pipe(writer);

        await new Promise((r, e) => {
            writer.on("finish", r);
            writer.on("error", e);
        });

        await sendDoc(conn, from, info, temp, chosen.quality, qSel);
        fs.unlinkSync(temp);

        console.log("🎉 DONE");

    } catch (e) {
        console.error("❌ ERROR:", e);
        reply("⚠️ Error:\n" + e.message);
    }
});
