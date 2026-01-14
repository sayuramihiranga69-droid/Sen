const { cmd } = require('../command');
const axios = require('axios');
const sharp = require('sharp');

const cinesubz_footer = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄☢️☘";

// ───────── React helper ─────────
async function react(conn, jid, key, emoji) {
    try {
        await conn.sendMessage(jid, { react: { text: emoji, key } });
    } catch {}
}

// ───────── Create thumbnail ─────────
async function makeThumbnail(url) {
    try {
        const img = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
        return await sharp(img.data)
            .resize(300)
            .jpeg({ quality: 65 })
            .toBuffer();
    } catch (e) {
        console.log("Thumbnail error:", e.message);
        return null;
    }
}

// ───────── Wait for reply helper ─────────
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

// ───────── Send document with thumbnail & full info ─────────
async function sendMovie(conn, from, info, file, quoted, chosenQuality) {
    let thumbnail = null;
    if (info.image) thumbnail = await makeThumbnail(info.image);

    // Build full caption
    let caption = `🎬 *${info.title}*\n\n`;
    if (info.year) caption += `📅 Year: ${info.year}\n`;
    caption += `📺 Quality: ${chosenQuality}\n`;
    if (info.rating) caption += `⭐ Rating: ${info.rating}\n`;
    if (info.duration) caption += `⏱ Duration: ${info.duration}\n`;
    if (info.country) caption += `🌍 Country: ${info.country}\n`;
    if (info.directors) caption += `🎬 Directors: ${info.directors}\n\n`;

    // List all available downloads
    if (info.downloads && info.downloads.length > 0) {
        info.downloads.forEach((d, i) => {
            caption += `*${i + 1}.* ${d.quality} (${d.size})\n`;
        });
    }
    caption += `\n${cinesubz_footer}`;

    const docMsg = await conn.sendMessage(from, {
        document: { url: file.url },
        fileName: `${info.title} (${chosenQuality}).mp4`.replace(/[\/\\:*?"<>|]/g, ""),
        mimetype: "video/mp4",
        jpegThumbnail: thumbnail || undefined,
        caption
    }, { quoted });

    await react(conn, from, docMsg.key, "✅");
}

// ───────── Command ─────────
cmd({
    pattern: "cinesubsk",
    desc: "CineSubz download with full info + thumbnail + stable reply",
    category: "downloader",
    react: "🔍",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example: .cinesubsk Avatar");
        await react(conn, from, m.key, "🔍");

        // 1️⃣ Search
        const searchRes = await axios.get(
            `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-search?q=${encodeURIComponent(q)}&apikey=deb4e2d4982c6bc2`
        );

        const results = searchRes.data?.data;
        if (!results?.length) return reply("❌ No results found");

        let listText = `🎬 *CineSubz Results*\n\n`;
        results.slice(0, 10).forEach((v, i) => {
            listText += `*${i + 1}.* ${v.title}\n`;
        });

        const listMsg = await conn.sendMessage(from, {
            text: listText + `\nReply number\n\n${cinesubz_footer}`
        }, { quoted: mek });

        // 2️⃣ Select movie
        let movieReply;
        try {
            movieReply = await waitForReply(conn, from, listMsg.key.id);
        } catch {
            return reply("⚠️ Timeout. Please try again.");
        }

        const index = parseInt(movieReply.text) - 1;
        if (isNaN(index) || !results[index]) return reply("❌ Invalid number");

        await react(conn, from, movieReply.msg.key, "🎬");

        const movie = results[index];

        // 3️⃣ Movie info
        const infoRes = await axios.get(
            `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-info?url=${encodeURIComponent(movie.link)}&apikey=deb4e2d4982c6bc2`
        );

        const info = infoRes.data?.data;
        if (!info) return reply("❌ Failed to get movie info");

        let infoText = `🎬 *${info.title}*\n\n`;
        info.downloads.forEach((d, i) => {
            infoText += `*${i + 1}.* ${d.quality} (${d.size})\n`;
        });

        const infoMsg = await conn.sendMessage(from, {
            image: { url: info.image },
            caption: infoText + `\n\nReply download number\n${cinesubz_footer}`
        }, { quoted: movieReply.msg });

        // 4️⃣ Select download
        let dlReply;
        try {
            dlReply = await waitForReply(conn, from, infoMsg.key.id);
        } catch {
            return reply("⚠️ Timeout. Please try again.");
        }

        const dIndex = parseInt(dlReply.text) - 1;
        if (isNaN(dIndex) || !info.downloads[dIndex]) return reply("❌ Invalid download number");

        await react(conn, from, dlReply.msg.key, "⬇️");

        const chosen = info.downloads[dIndex];

        const dlRes = await axios.get(
            `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-download?url=${encodeURIComponent(chosen.link)}&apikey=deb4e2d4982c6bc2`
        );

        const pix = dlRes.data?.data?.download?.find(v => v.name.toUpperCase().includes("PIX"));
        if (!pix) return reply("❌ Pixeldrain link not found");

        await sendMovie(conn, from, info, { url: pix.url }, dlReply.msg, chosen.quality);

    } catch (e) {
        console.error("CINESUBZ ERROR FULL:", e);
        reply("⚠️ Error:\n" + e.message);
    }
});
