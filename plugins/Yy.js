const { cmd } = require('../command');
const axios = require('axios');

const cinesubz_footer = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄☢️☘";

// ─── React helper ───────────────────────────────
async function react(conn, jid, key, emoji) {
    try {
        await conn.sendMessage(jid, {
            react: { text: emoji, key }
        });
    } catch {}
}

// ─── Send poster + document ─────────────────────
async function sendMovie(conn, from, info, file, quoted) {

    // 1️⃣ Poster (image)
    if (info.image) {
        const posterMsg = await conn.sendMessage(from, {
            image: { url: info.image },
            caption: `🎬 *${info.title}*\n📺 ${file.quality}\n📦 ${file.size}\n\n${cinesubz_footer}`
        }, { quoted });

        await react(conn, from, posterMsg.key, "🖼️");
    }

    // 2️⃣ Document (video)
    const docMsg = await conn.sendMessage(from, {
        document: { url: file.url },
        fileName: `${info.title} (${file.quality}).mp4`.replace(/[\/\\:*?"<>|]/g, ""),
        mimetype: "video/mp4",
        caption: cinesubz_footer
    }, { quoted });

    await react(conn, from, docMsg.key, "✅");
}

// ─── Command ────────────────────────────────────
cmd({
    pattern: "cinesubsk",
    desc: "CineSubz search & download",
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
    if (!results || !results.length) return reply("❌ No results");

    let text = `🎬 *CineSubz Results*\n\n`;
    results.slice(0, 10).forEach((m, i) => {
        text += `*${i + 1}.* ${m.title}\n`;
    });

    const listMsg = await conn.sendMessage(from, {
        text: text + `\nReply number\n\n${cinesubz_footer}`
    }, { quoted: mek });

    // 2️⃣ Select movie
    conn.ev.once("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        const num = parseInt(msg.message?.conversation);
        if (!num || !results[num - 1]) return;

        await react(conn, from, msg.key, "🎬");

        const chosen = results[num - 1];

        // 3️⃣ Movie info
        const infoRes = await axios.get(
            `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-info?url=${encodeURIComponent(chosen.link)}&apikey=deb4e2d4982c6bc2`
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

        // 4️⃣ Select quality
        conn.ev.once("messages.upsert", async ({ messages }) => {
            const dmsg = messages[0];
            const dnum = parseInt(dmsg.message?.conversation);
            if (!dnum || !info.downloads[dnum - 1]) return;

            await react(conn, from, dmsg.key, "⬇️");

            const chosenDl = info.downloads[dnum - 1];

            // 5️⃣ Download links
            const dlRes = await axios.get(
                `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-download?url=${encodeURIComponent(chosenDl.link)}&apikey=deb4e2d4982c6bc2`
            );

            const pix = dlRes.data?.data?.download?.find(v =>
                v.name.toUpperCase().includes("PIX")
            );

            if (!pix) return reply("❌ Pixeldrain not found");

            await sendMovie(conn, from, info, {
                url: pix.url,
                quality: chosenDl.quality,
                size: chosenDl.size
            }, dmsg);
        });
    });
});
