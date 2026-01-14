const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');

const footer = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌☢️☘";
const API_KEY = "edbcfabbca5a9750";

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
async function sendDoc(conn, from, info, url, quality, quoted) {
    const tempPath = path.join(os.tmpdir(), `${info.title} (${quality}).mp4`.replace(/[\/\\:*?"<>|]/g,""));
    console.log("📥 Downloading movie to temporary file...");
    const writer = fs.createWriteStream(tempPath);

    const { data } = await axios.get(url, { responseType: "stream" });
    data.pipe(writer);
    await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
    console.log("✅ Download finished, sending to WhatsApp...");

    const thumb = info.image ? await makeThumbnail(info.image) : null;
    const caption = `🎬 *${info.title}*\n*${quality}*\n${footer}`;
    await conn.sendMessage(from, {
        document: { url: tempPath },
        fileName: `${info.title} (${quality}).mp4`.replace(/[\/\\:*?"<>|]/g,""),
        mimetype: "video/mp4",
        jpegThumbnail: thumb || undefined,
        caption
    }, { quoted });

    fs.unlinkSync(tempPath);
    console.log("📤 File sent and temporary file deleted!");
}

// ───────── Command ─────────
cmd({
    pattern: "sinhalasubt",
    desc: "Search & download Sinhala subtitles movie (UserDrive only)",
    category: "downloader",
    react: "🔍",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example: .sinhalasubt Avengers");
        await react(conn, from, m.key, "🔍");
        console.log("🔎 Searching for:", q);

        // 1️⃣ Search
        const searchRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-search?q=${encodeURIComponent(q)}&apikey=${API_KEY}`);
        const results = searchRes.data?.data;
        if (!results?.length) return reply("❌ No results found");
        console.log("📄 Search results:", results.map(r => r.title));

        let listText = "🎬 *Search Results*\n\n";
        results.slice(0, 10).forEach((v, i)=>{ listText += `*${i+1}.* ${v.title}\n`; });
        const listMsg = await conn.sendMessage(from, { text: listText + `\nReply number\n\n${footer}` }, { quoted: mek });

        // 2️⃣ User selects movie
        const { msg: movieMsg, text: movieText } = await waitForReply(conn, from, listMsg.key.id);
        const index = parseInt(movieText) - 1;
        if (isNaN(index) || !results[index]) return reply("❌ Invalid number");
        await react(conn, from, movieMsg.key, "🎬");
        const movie = results[index];
        console.log("🎬 Selected movie:", movie.title);

        // 3️⃣ Info
        console.log("📥 Fetching movie info...");
        const infoRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-info?url=${encodeURIComponent(movie.url)}&apikey=${API_KEY}`);
        const info = infoRes.data?.data;
        if (!info) return reply("❌ Failed to get movie info");

        // 4️⃣ Only UserDrive downloads
        const downloads = info.downloads?.usersdrive || [];
        if (!downloads.length) return reply("❌ No UserDrive links found");
        console.log("📌 Available UserDrive links:", downloads.map(d=>({ quality:d.quality, size:d.size })));

        let qualityList = "";
        downloads.forEach((d,i)=>{ qualityList += `*${i+1}.* ${d.quality} (${d.size})\n`; });
        const qualityMsg = await conn.sendMessage(from, {
            image: { url: info.image },
            caption: `🎬 *${info.title}*\n\nAvailable UserDrive Downloads:\n${qualityList}\nReply download number\n${footer}`
        }, { quoted: movieMsg });

        // 5️⃣ User selects quality
        const { msg: dlMsg, text: dlText } = await waitForReply(conn, from, qualityMsg.key.id);
        const dIndex = parseInt(dlText) - 1;
        if (isNaN(dIndex) || !downloads[dIndex]) return reply("❌ Invalid download number");
        await react(conn, from, dlMsg.key, "⬇️");

        const chosen = downloads[dIndex];
        console.log("⬇️ Selected UserDrive page:", chosen.url);

        // 6️⃣ Get actual UserDrive page
        const pageRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-download?url=${encodeURIComponent(chosen.url)}&apikey=${API_KEY}`);
        const pageLink = pageRes.data?.data?.download;
        if (!pageLink) return reply("❌ Failed to get UserDrive page link");
        console.log("🔗 UserDrive page link:", pageLink);

        // 7️⃣ Get real direct download
        const dlRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/download/userdrive?url=${encodeURIComponent(pageLink)}&apikey=${API_KEY}`);
        const realUrl = dlRes.data?.data?.download;
        if (!realUrl) return reply("❌ Failed to get real download URL");
        console.log("✅ Real download URL obtained");

        // 8️⃣ Send document to WhatsApp
        await sendDoc(conn, from, info, realUrl, chosen.quality, dlMsg);

        console.log("🎉 Movie sent successfully!");

    } catch (e) {
        console.error("SINHALASUB ERROR:", e);
        reply("⚠️ Error:\n" + e.message);
    }
});
