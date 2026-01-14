const { cmd } = require('../command');
const axios = require('axios');

const cinesubz_footer = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄☢️☘";

// ─── React helper ─────────────────
async function react(conn, jid, key, emoji) {
    try {
        await conn.sendMessage(jid, {
            react: { text: emoji, key }
        });
    } catch {}
}

// ─── Get image buffer ─────────────
async function getBuffer(url) {
    const res = await axios.get(url, { responseType: "arraybuffer" });
    return Buffer.from(res.data);
}

// ─── Send document with poster thumbnail ─────────
async function sendMovie(conn, from, info, file, quoted) {
    let thumb = null;

    if (info.image) {
        try {
            thumb = await getBuffer(info.image);
        } catch {
            thumb = null;
        }
    }

    const docMsg = await conn.sendMessage(from, {
        document: { url: file.url },
        fileName: `${info.title} (${file.quality}).mp4`
            .replace(/[\/\\:*?"<>|]/g, ""),
        mimetype: "video/mp4",
        jpegThumbnail: thumb, // ⭐ MAIN THING
        caption: cinesubz_footer
    }, { quoted });

    await react(conn, from, docMsg.key, "✅");
}

// ─── Command ──────────────────────
cmd({
    pattern: "cinesubsk",
    desc: "CineSubz download with poster thumbnail",
    category: "downloader",
    react: "🔍",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    if (!q) return reply("❗ Example: .cinesubsk Avatar");
    await react(conn, from, m.key, "🔍");

    // 1️⃣ Search
    const search = await axios.get(
        `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-search?q=${encodeURIComponent(q)}&apikey=deb4e2d4982c6bc2`
    );

    const results = search.data?.data;
    if (!results?.length) return reply("❌ No results");

    let text = `🎬 *CineSubz Results*\n\n`;
    results.slice(0, 10).forEach((v, i) => {
        text += `*${i + 1}.* ${v.title}\n`;
    });

    const listMsg = await conn.sendMessage(from, {
        text: text + `\nReply number\n\n${cinesubz_footer}`
    }, { quoted: mek });

    // 2️⃣ Movie select
    conn.ev.once("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        const num = parseInt(msg.message?.conversation);
        if (!num || !results[num - 1]) return;

        await react(conn, from, msg.key, "🎬");

        const movie = results[num - 1];

        // 3️⃣ Info
        const infoRes = await axios.get(
            `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-info?url=${encodeURIComponent(movie.link)}&apikey=deb4e2d4982c6bc2`
        );

        const info = infoRes.data?.data;
        if (!info) return reply("❌ Info error");

        let infoText = `🎬 *${info.title}*\n\n`;
        info.downloads.forEach((d, i) => {
            infoText += `*${i + 1}.* ${d.quality} (${d.size})\n`;
        });

        const infoMsg = await conn.sendMessage(from, {
            image: { url: info.image },
            caption: infoText + `\n\nReply download number\n${cinesubz_footer}`
        }, { quoted: msg });

        // 4️⃣ Download select
        conn.ev.once("messages.upsert", async ({ messages }) => {
            const dmsg = messages[0];
            const dnum = parseInt(dmsg.message?.conversation);
            if (!dnum || !info.downloads[dnum - 1]) return;

            await react(conn, from, dmsg.key, "⬇️");

            const chosen = info.downloads[dnum - 1];

            const dlRes = await axios.get(
                `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-download?url=${encodeURIComponent(chosen.link)}&apikey=deb4e2d4982c6bc2`
            );

            const pix = dlRes.data?.data?.download
                ?.find(v => v.name.toUpperCase().includes("PIX"));

            if (!pix) return reply("❌ Pixeldrain not found");

            await sendMovie(conn, from, info, {
                url: pix.url,
                quality: chosen.quality
            }, dmsg);
        });
    });
});
