const { cmd } = require('../command');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const os = require('os');

const footer = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌☢️☘";

// ───────── React helper ─────────
async function react(conn, jid, key, emoji) {
    try { await conn.sendMessage(jid, { react: { text: emoji, key } }); } catch {}
}

// ───────── Thumbnail ─────────
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
async function sendDocFile(conn, from, info, url, quality, quoted) {
    const thumb = info.image ? await makeThumbnail(info.image) : null;
    const caption = `🎬 *${info.title}*\n*${quality}*\n${footer}`;
    const docMsg = await conn.sendMessage(from, {
        document: { url },
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
    desc: "Search & download Sinhala subtitles movie (Pixeldrain + UserDrive)",
    category: "downloader",
    react: "🔍",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example: .sinhalasubt Avengers");
        await react(conn, from, m.key, "🔍");

        // 1️⃣ Search
        const searchRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-search?q=${encodeURIComponent(q)}&apikey=09acaa863782cc46`);
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

        // 3️⃣ Info
        const infoRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-info?url=${encodeURIComponent(movie.url)}&apikey=09acaa863782cc46`);
        const info = infoRes.data?.data;
        if (!info) return reply("❌ Failed to fetch movie info");

        // 4️⃣ Show download options
        let downloadList = [];
        let listText2 = `🎬 *${info.title}*\n\nAvailable Downloads:\n`;

        info.downloads.pixeldrain.forEach((d,i)=>{
            listText2 += `📩Pixel *${i+1}.* ${d.quality} (${d.size})\n`;
            downloadList.push({ host:"pixeldrain", quality: d.quality, url: d.url });
        });
        info.downloads.usersdrive.forEach((d,i)=>{
            listText2 += `📩UserDrive *${downloadList.length + 1}.* ${d.quality} (${d.size})\n`;
            downloadList.push({ host:"usersdrive", quality: d.quality, url: d.url });
        });

        const qualityMsg = await conn.sendMessage(from, { text: listText2 + "\nReply download number\n" + footer }, { quoted: movieMsg });

        // 5️⃣ User selects quality
        const { msg: dlMsg, text: dlText } = await waitForReply(conn, from, qualityMsg.key.id);
        const dIndex = parseInt(dlText) - 1;
        if (isNaN(dIndex) || !downloadList[dIndex]) return reply("❌ Invalid number");
        await react(conn, from, dlMsg.key, "⬇️");
        const chosen = downloadList[dIndex];

        let pageLink, realUrl;

        if(chosen.host === "pixeldrain") {
            // Pixeldrain
            const pageRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-download?url=${encodeURIComponent(chosen.url)}&apikey=09acaa863782cc46`);
            pageLink = pageRes.data?.data?.download;
            if(!pageLink) return reply("❌ Failed to get Pixeldrain page link");

            const dlRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/download/pixeldrain?url=${encodeURIComponent(pageLink)}&apikey=09acaa863782cc46`);
            realUrl = dlRes.data?.data?.download;
            if(!realUrl) return reply("❌ Failed to get real Pixeldrain download URL");

        } else {
            // UserDrive
            const pageRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-download?url=${encodeURIComponent(chosen.url)}&apikey=09acaa863782cc46`);
            pageLink = pageRes.data?.data?.download;
            if(!pageLink) return reply("❌ Failed to get UserDrive page link");

            const dlRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/download/userdrive?url=${encodeURIComponent(pageLink)}&apikey=09acaa863782cc46`);
            realUrl = dlRes.data?.data?.download;
            if(!realUrl) return reply("❌ Failed to get real UserDrive download URL");
        }

        // 6️⃣ Send to WhatsApp
        await sendDocFile(conn, from, info, realUrl, chosen.quality, dlMsg);
        console.log("✅ Done!");

    } catch(e){
        console.error("SINHALASUB ERROR:", e);
        reply("⚠️ Error:\n" + e.message);
    }
});
