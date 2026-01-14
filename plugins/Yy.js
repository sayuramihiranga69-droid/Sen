const { cmd } = require('../command');
const axios = require('axios');

const cinesubz_footer = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄☢️☘";

// ─────────────────────────────────────
// Send poster image + mp4 document
// ─────────────────────────────────────
async function sendMovie(conn, from, info, file, quoted) {
    const fileName = `${info.title} (${info.year}) ${file.quality} [CineSubz].mp4`
        .replace(/[\/\\:*?"<>|]/g, "");

    // 1️⃣ Poster image (this is what you want to SEE)
    if (info.image) {
        await conn.sendMessage(from, {
            image: { url: info.image },
            caption: `🎬 *${info.title}*\n📺 ${file.quality}\n\n${cinesubz_footer}`
        }, { quoted });
    }

    // 2️⃣ Document (safe for big files)
    await conn.sendMessage(from, {
        document: { url: file.url },
        fileName,
        mimetype: "video/mp4",
        caption: cinesubz_footer
    }, { quoted });

    await conn.sendMessage(from, {
        react: { text: "✅", key: quoted.key }
    });
}

// ─────────────────────────────────────
// Command
// ─────────────────────────────────────
cmd({
    pattern: "cinesubsk",
    desc: "Search CineSubz and download",
    category: "downloader",
    react: "🔍",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example: .cinesubsk Avatar");

        // 🔍 SEARCH
        const searchUrl =
            `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-search?q=${encodeURIComponent(q)}&apikey=deb4e2d4982c6bc2`;
        const searchRes = await axios.get(searchUrl);
        const results = searchRes.data?.data;

        if (!results || results.length === 0)
            return reply("❌ No results found");

        let listText = `🎬 *CineSubz Results*\n\n`;
        results.slice(0, 10).forEach((m, i) => {
            listText += `*${i + 1}. ${m.title}*\n`;
        });

        const listMsg = await conn.sendMessage(from, {
            text: listText + `\nReply number\n\n${cinesubz_footer}`
        }, { quoted: mek });

        const listId = listMsg.key.id;

        // ─────────────────────────────
        // Movie select
        // ─────────────────────────────
        conn.ev.on("messages.upsert", async ({ messages }) => {
            const msg = messages?.[0];
            if (!msg?.message) return;

            const text =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text;

            const isReply =
                msg.message.extendedTextMessage?.contextInfo?.stanzaId === listId;
            if (!isReply) return;

            const index = parseInt(text) - 1;
            if (isNaN(index) || !results[index]) return;

            const movie = results[index];

            // 🎬 INFO
            const infoUrl =
                `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-info?url=${encodeURIComponent(movie.link)}&apikey=deb4e2d4982c6bc2`;
            const infoRes = await axios.get(infoUrl);
            const info = infoRes.data?.data;

            if (!info) return reply("❌ Info error", msg);

            let infoText =
                `🎬 *${info.title}*\n` +
                `📅 ${info.year}\n` +
                `📺 ${info.quality}\n` +
                `⭐ ${info.rating}\n\n` +
                `📥 *Available Downloads:*\n`;

            info.downloads.forEach((d, i) => {
                infoText += `*${i + 1}. ${d.quality}* (${d.size})\n`;
            });

            const infoMsg = await conn.sendMessage(from, {
                image: { url: info.image },
                caption: infoText + `\nReply number\n\n${cinesubz_footer}`
            }, { quoted: msg });

            const infoId = infoMsg.key.id;

            // ─────────────────────────────
            // Download select
            // ─────────────────────────────
            conn.ev.on("messages.upsert", async ({ messages: dmsgs }) => {
                const dmsg = dmsgs?.[0];
                if (!dmsg?.message) return;

                const dtext =
                    dmsg.message.conversation ||
                    dmsg.message.extendedTextMessage?.text;

                const isReply2 =
                    dmsg.message.extendedTextMessage?.contextInfo?.stanzaId === infoId;
                if (!isReply2) return;

                const dIndex = parseInt(dtext) - 1;
                if (isNaN(dIndex) || !info.downloads[dIndex]) return;

                const chosen = info.downloads[dIndex];

                const dlRes = await axios.get(
                    `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-download?url=${encodeURIComponent(chosen.link)}&apikey=deb4e2d4982c6bc2`
                );

                const pix = dlRes.data?.data?.download?.find(v =>
                    v.name.toUpperCase().includes("PIX")
                );

                if (!pix) return reply("❌ Pixeldrain link not found", dmsg);

                // ✅ SEND POSTER + DOCUMENT
                await sendMovie(conn, from, info, pix, dmsg);
            });
        });

    } catch (err) {
        console.error(err);
        reply("❌ Error occurred");
    }
});
