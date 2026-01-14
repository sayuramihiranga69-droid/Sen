const { cmd } = require('../command');
const axios = require('axios');
const sharp = require('sharp');

const MOVIE_FOOTER = "✫☘ 𝐒𝐫𝐢𝐇𝐮𝐛 𝐌𝐨𝐯𝐢𝐞 𝐁𝐨𝐭 ☢️☘";

// ───────── React helper ─────────
async function react(conn, jid, key, emoji) {
    try { 
        await conn.sendMessage(jid, { react: { text: emoji, key } }); 
    } catch {}
}

// ───────── Make Thumbnail ─────────
async function makeThumbnail(url) {
    try {
        const img = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
        return await sharp(img.data).resize(300).jpeg({ quality: 65 }).toBuffer();
    } catch (e) {
        console.log("Thumbnail error:", e.message);
        return null;
    }
}

// ───────── Wait for user reply ─────────
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
    const thumb = info.thumbnail ? await makeThumbnail(info.thumbnail) : null;
    const captionText = `🎬 *${info.title}*\nType: ${info.type}\n${MOVIE_FOOTER}`;
    const docMsg = await conn.sendMessage(from, {
        document: { url: file.url },
        fileName: `${info.title} (${info.type}).mp4`.replace(/[\/\\:*?"<>|]/g,""),
        mimetype: "video/mp4",
        jpegThumbnail: thumb || undefined,
        caption: captionText
    }, { quoted });
    await react(conn, from, docMsg.key, "✅");
}

// ───────── Command ─────────
cmd({
    pattern: "moviesub",
    desc: "Search & download movies/series with Sinhala subtitles",
    category: "downloader",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example: .moviesub Stranger Things");
        await react(conn, from, m.key, "🔍");

        // 1️⃣ Search API
        const searchRes = await axios.get(
            `https://api.srihub.store/movie/moviesub?q=${encodeURIComponent(q)}&apikey=dew_B59NylJtdTt6KmCaDpLt5VXWo1aohDRyRblCDlc7`
        );
        const results = searchRes.data?.result;
        if (!results?.length) return reply("❌ No results found");

        let listText = `🎬 *Search Results*\n\n`;
        results.slice(0, 10).forEach((v,i) => { listText += `*${i+1}.* ${v.title}\n`; });

        const listMsg = await conn.sendMessage(from, {
            text: listText + `\nReply with the number to select\n\n${MOVIE_FOOTER}`
        }, { quoted: mek });

        // 2️⃣ Select movie
        const { msg: movieMsg, text: movieText } = await waitForReply(conn, from, listMsg.key.id);
        const index = parseInt(movieText) - 1;
        if (isNaN(index) || !results[index]) return reply("❌ Invalid number");
        await react(conn, from, movieMsg.key, "🎬");

        const movie = results[index];

        // 3️⃣ Get download links
        const dlRes = await axios.get(
            `https://api.srihub.store/movie/moviesubdl?url=${encodeURIComponent(movie.url)}&apikey=dew_B59NylJtdTt6KmCaDpLt5VXWo1aohDRyRblCDlc7`
        );
        const dlLinks = dlRes.data?.result?.downloads || [];
        if (!dlLinks.length) return reply("❌ No download links found");

        let dlText = `🎬 *${movie.title}* Download Links\n\n`;
        dlLinks.forEach((d,i) => { dlText += `*${i+1}.* ${d.quality || "Unknown"} (${d.size || "-"})\n`; });

        const infoMsg = await conn.sendMessage(from, {
            text: dlText + `\nReply with the number to download\n${MOVIE_FOOTER}`
        }, { quoted: movieMsg });

        // 4️⃣ Select download
        const { msg: dlMsg, text: dlSelect } = await waitForReply(conn, from, infoMsg.key.id);
        const dIndex = parseInt(dlSelect) - 1;
        if (isNaN(dIndex) || !dlLinks[dIndex]) return reply("❌ Invalid download number");
        await react(conn, from, dlMsg.key, "⬇️");

        const chosen = dlLinks[dIndex];
        await sendDocWithCaption(conn, from, movie, { url: chosen.link, quality: chosen.quality || "Unknown" }, dlMsg);

    } catch (e) {
        console.error("MOVIESUB ERROR:", e);
        reply("⚠️ Error:\n" + e.message);
    }
});
