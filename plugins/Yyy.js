const { cmd } = require('../command');
const axios = require('axios');
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

// ───────── Send WhatsApp document directly from URL ─────────
async function sendDocFile(conn, from, info, fileUrl, quality, quoted) {
    console.log("📤 Sending file to WhatsApp...");
    const thumb = info.image ? await makeThumbnail(info.image) : null;
    const caption = `🎬 *${info.title}*\n*${quality}*\n${footer}`;
    const docMsg = await conn.sendMessage(from, {
        document: { url: fileUrl },
        fileName: `${info.title} (${quality}).mp4`.replace(/[\/\\:*?"<>|]/g,""),
        mimetype: "video/mp4",
        jpegThumbnail: thumb || undefined,
        caption
    }, { quoted });
    await react(conn, from, docMsg.key, "✅");
    console.log("✅ File sent successfully!");
}

// ───────── Command ─────────
cmd({
    pattern: "sinhalasubt",
    desc: "Search & download Sinhala subtitles movie (Usersdrive only, direct stream) with console logs",
    category: "downloader",
    react: "🔍",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example: .sinhalasubt New");
        await react(conn, from, m.key, "🔍");

        console.log("🔎 Searching movie:", q);
        const searchRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-search?q=${encodeURIComponent(q)}&apikey=edbcfabbca5a9750`);
        const results = searchRes.data?.data;
        if (!results?.length) {
            console.log("❌ No results found");
            return reply("❌ No results found");
        }
        console.log("📄 Search results:", results.map(r => r.title));

        let listText = "🎬 *Search Results*\n\n";
        results.slice(0, 10).forEach((v, i) => { listText += `*${i+1}.* ${v.title}\n`; });
        const listMsg = await conn.sendMessage(from, { text: listText + `\nReply number\n\n${footer}` }, { quoted: mek });
        console.log("📩 Sent search results, waiting for user selection...");

        const { msg: movieMsg, text: movieText } = await waitForReply(conn, from, listMsg.key.id);
        const index = parseInt(movieText) - 1;
        if (isNaN(index) || !results[index]) {
            console.log("❌ Invalid selection:", movieText);
            return reply("❌ Invalid number");
        }
        await react(conn, from, movieMsg.key, "🎬");
        const movie = results[index];
        console.log("🎬 Selected movie:", movie.title, movie.url);

        console.log("📥 Fetching movie info...");
        const infoRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-info?url=${encodeURIComponent(movie.url)}&apikey=edbcfabbca5a9750`);
        const info = infoRes.data?.data;
        if (!info) {
            console.log("❌ Failed to get movie info");
            return reply("❌ Failed to get movie info");
        }

        const usersdrive = info.downloads?.usersdrive;
        if (!usersdrive?.length) {
            console.log("❌ No Usersdrive links found");
            return reply("❌ No Usersdrive links found");
        }
        console.log("📌 Available Usersdrive links:", usersdrive.map(d => ({ quality: d.quality, size: d.size })));

        let qualityList = "";
        usersdrive.forEach((d, i) => { qualityList += `*${i+1}.* ${d.quality} (${d.size})\n`; });
        const qualityMsg = await conn.sendMessage(from, {
            image: { url: info.image },
            caption: `🎬 *${info.title}*\n\nAvailable Downloads (Usersdrive):\n${qualityList}\nReply download number\n${footer}`
        }, { quoted: movieMsg });
        console.log("📩 Sent quality list, waiting for user selection...");

        const { msg: dlMsg, text: dlText } = await waitForReply(conn, from, qualityMsg.key.id);
        const dIndex = parseInt(dlText) - 1;
        if (isNaN(dIndex) || !usersdrive[dIndex]) {
            console.log("❌ Invalid download selection:", dlText);
            return reply("❌ Invalid download number");
        }
        await react(conn, from, dlMsg.key, "⬇️");
        const chosen = usersdrive[dIndex];
        console.log("⬇️ Selected quality:", chosen.quality, chosen.size);

        console.log("🌐 Fetching Usersdrive page link...");
        const pageRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/movie/sinhalasub-download?url=${encodeURIComponent(chosen.url)}&apikey=edbcfabbca5a9750`);
        const pageLink = pageRes.data?.data?.download;
        if (!pageLink) {
            console.log("❌ Failed to get Usersdrive page link");
            return reply("❌ Failed to get Usersdrive page link");
        }
        console.log("🔗 Usersdrive page link:", pageLink);

        console.log("🌐 Fetching real download URL...");
        const dlRes = await axios.get(`https://api-dark-shan-yt.koyeb.app/download/userdrive?url=${encodeURIComponent(pageLink)}&apikey=09acaa863782cc46`);
        const realUrl = dlRes.data?.data?.download;
        if (!realUrl) {
            console.log("❌ Failed to get real download URL");
            return reply("❌ Failed to get real download URL");
        }
        console.log("✅ Real download URL obtained");

        await sendDocFile(conn, from, info, realUrl, chosen.quality, dlMsg);

    } catch (e) {
        console.error("SINHALASUB ERROR:", e);
        reply("⚠️ Error:\n" + e.message);
    }
});
