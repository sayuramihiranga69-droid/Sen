const { cmd } = require('../command');
const axios = require('axios');
const sharp = require('sharp');

const cinesubz_footer = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄☢️☘";

// React helper
async function react(conn, jid, key, emoji) {
    try {
        await conn.sendMessage(jid, { react: { text: emoji, key } });
    } catch {}
}

// Create thumbnail from poster
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

// Wait for reply
function waitForReply(conn, from, replyToId, timeout = 60000) {
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

// Send document with poster thumbnail
async function sendMovie(conn, from, info, file, quoted) {
    let thumbnail = null;
    if (info.image) {
        thumbnail = await makeThumbnail(info.image);
    }

    const docMsg = await conn.sendMessage(from, {
        document: { url: file.url },
        fileName: `${info.title} (${file.quality}).mp4`.replace(/[\/\\:*?"<>|]/g, ""),
        mimetype: "video/mp4",
        jpegThumbnail: thumbnail || undefined,
        caption: cinesubz_footer
    }, { quoted });

    await react(conn, from, docMsg.key, "✅");
}

// Command
cmd({
    pattern: "cinesubsk",
    desc: "CineSubz download with document thumbnail",
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
        const { msg: movieMsg, text: movieText } = await waitForReply(conn, from, listMsg.key.id);
        const index = parseInt(movieText) - 1;
        if (isNaN(index) || !results[index]) return reply("❌ Invalid number");

        await react(conn, from, movieMsg.key, "🎬");

        const movie = results[index];

        // 3️⃣ Movie info
        const infoRes = await axios.get(
            `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-info?url=${encodeURIComponent(movie.link)}&apikey=deb4e2d4982c6bc2`
        );

        const info = infoRes.data?.data;
        if (!info) return reply("❌ Failed to get movie info");

        let infoText = `🎬 *${info.title}*\n\n`;
        if (info.year) infoText += `📅 Year: ${info.year}\n`;
        if (info.quality) infoText += `📺 Quality: ${info.quality}\n`;
        if (info.rating) infoText += `⭐ Rating: ${info.rating}\n`;
        if (info.duration) infoText += `⏱ Duration: ${info.duration}\n`;
        if (info.country) infoText += `🌍 Country: ${info.country}\n`;
        if (info.directors) infoText += `🎬 Directors: ${info.directors}\n\n`;

        if (info.downloads && info.downloads.length > 0) {
            info.downloads.forEach((d, i) => {
                infoText += `*${i + 1}.* ${d.quality} (${d.size})\n`;
            });
        }

        const infoMsg = await conn.sendMessage(from, {
            image: { url: info.image },
            caption: infoText + `\n\nReply download number\n${cinesubz_footer}`
        }, { quoted: movieMsg });

        // 4️⃣ Select download
        const { msg: dlMsg, text: dlText } = await waitForReply(conn, from, infoMsg.key.id);
        const dIndex = parseInt(dlText) - 1;
        if (isNaN(dIndex) || !info.downloads[dIndex]) return reply("❌ Invalid download number");

        await react(conn, from, dlMsg.key, "⬇️");

        const chosen = info.downloads[dIndex];

        const dlRes = await axios.get(
            `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-download?url=${encodeURIComponent(chosen.link)}&apikey=deb4e2d4982c6bc2`
        );

        const pix = dlRes.data?.data?.download?.find(v => v.name.toUpperCase().includes("PIX"));
        if (!pix) return reply("❌ Pixeldrain link not found");

        await sendMovie(conn, from, info, { url: pix.url, quality: chosen.quality }, dlMsg);

    } catch (e) {
        console.error("CINESUBZ ERROR FULL:", e);
        reply("⚠️ Error:\n" + e.message);
    }
});
