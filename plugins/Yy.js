const { cmd } = require('../command');
const axios = require('axios');

const cinesubz_footer = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄☢️☘";

// Helper function to send Pixeldrain file as document with footer and reaction
async function sendPixeldrainFile(conn, from, url, quotedMsg, fileName) {
    try {
        await conn.sendMessage(
            from,
            {
                document: { url },
                fileName: fileName,
                mimetype: "video/mp4",
                caption: cinesubz_footer
            },
            { quoted: quotedMsg }
        );
        // React with check mark after sending
        await conn.sendMessage(from, { react: { text: "✅", key: quotedMsg.key } });
    } catch (e) {
        console.error("Failed to send file:", e);
        await conn.sendMessage(
            from,
            { text: "❌ Failed to send file: " + e.message + `\n\n${cinesubz_footer}` },
            { quoted: quotedMsg }
        );
        await conn.sendMessage(from, { react: { text: "❌", key: quotedMsg.key } });
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CineSubz Search + Info + Pixeldrain send with reactions + footer
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
    pattern: "cinesubsk",
    desc: "Search CineSubz, get info, and send Pixeldrain file with reactions and footer",
    category: "downloader",
    react: "🔍",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Please provide a search query\nExample: .cinesubsk Avatar");

        await conn.sendMessage(from, { react: { text: "🔍", key: m.key } });

        const searchUrl = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-search?q=${encodeURIComponent(q)}&apikey=deb4e2d4982c6bc2`;
        const { data } = await axios.get(searchUrl);
        if (!data.status || !data.data || data.data.length === 0) return reply("❌ No results found.\n" + cinesubz_footer);

        let listMsgText = `🎬 *CineSubz Search Results*\n\n🔎 Query: *${q}*\n📊 Found: ${data.data.length} results\n\n`;
        data.data.slice(0, 10).forEach((item, idx) => {
            listMsgText += `*${idx + 1}. ${item.title}*\n`;
            if (item.type) listMsgText += `   📁 Type: ${item.type}\n`;
            if (item.quality) listMsgText += `   📺 Quality: ${item.quality}\n`;
            if (item.rating) listMsgText += `   ⭐ Rating: ${item.rating}\n`;
        });

        const listMsg = await conn.sendMessage(
            from,
            { text: listMsgText + `\n🔢 Reply with the number to get movie info\n\n${cinesubz_footer}` },
            { quoted: mek }
        );

        const listMsgId = listMsg.key.id;

        conn.ev.on("messages.upsert", async (update) => {
            const msg = update?.messages?.[0];
            if (!msg?.message) return;

            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
            const isReplyToList = msg?.message?.extendedTextMessage?.contextInfo?.stanzaId === listMsgId;
            if (!isReplyToList) return;

            const index = parseInt(text.trim()) - 1;
            if (isNaN(index) || index < 0 || index >= data.data.length) {
                await conn.sendMessage(from, { react: { text: "❌", key: msg.key } });
                return reply("❌ Invalid number. Reply with a valid number from the list.\n" + cinesubz_footer, msg);
            }

            await conn.sendMessage(from, { react: { text: "🎬", key: msg.key } });

            const chosen = data.data[index];

            const detailsUrl = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-info?url=${encodeURIComponent(chosen.link)}&apikey=deb4e2d4982c6bc2`;
            const detailsRes = await axios.get(detailsUrl);
            const info = detailsRes.data?.data;
            if (!info) {
                await conn.sendMessage(from, { react: { text: "❌", key: msg.key } });
                return reply("❌ Failed to fetch movie details.\n" + cinesubz_footer, msg);
            }

            let msgText = `🎬 *${info.title}*\n\n`;
            if (info.year) msgText += `📅 Year: ${info.year}\n`;
            if (info.quality) msgText += `📺 Quality: ${info.quality}\n`;
            if (info.rating) msgText += `⭐ Rating: ${info.rating}\n`;
            if (info.duration) msgText += `⏱ Duration: ${info.duration}\n`;
            if (info.country) msgText += `🌍 Country: ${info.country}\n`;
            if (info.directors) msgText += `🎬 Directors: ${info.directors}\n\n`;

            if (info.downloads && info.downloads.length > 0) {
                msgText += `📥 *Available Download Links:*\n`;
                info.downloads.forEach((dl, idx) => {
                    msgText += `*${idx + 1}. ${dl.quality}* (${dl.size})\n`;
                });
                msgText += `\n🔢 Reply with the number to get Pixeldrain link only.\n${cinesubz_footer}`;
            } else {
                msgText += `❌ No download links available.\n${cinesubz_footer}`;
            }

            const detailsMsg = await conn.sendMessage(
                from,
                info.image ? { image: { url: info.image }, caption: msgText } : { text: msgText },
                { quoted: msg }
            );

            const detailsMsgId = detailsMsg.key.id;

            conn.ev.on("messages.upsert", async (dlUpdate) => {
                const dlMsg = dlUpdate?.messages?.[0];
                if (!dlMsg?.message) return;

                const dlText = dlMsg.message?.conversation || dlMsg.message?.extendedTextMessage?.text;
                const isReplyToDetails = dlMsg?.message?.extendedTextMessage?.contextInfo?.stanzaId === detailsMsgId;
                if (!isReplyToDetails) return;

                const dlIndex = parseInt(dlText.trim()) - 1;
                if (isNaN(dlIndex) || dlIndex < 0 || dlIndex >= info.downloads.length) {
                    await conn.sendMessage(from, { react: { text: "❌", key: dlMsg.key } });
                    return reply("❌ Invalid number. Reply with a valid download number.\n" + cinesubz_footer, dlMsg);
                }

                const dlChosen = info.downloads[dlIndex];

                const dlRes = await axios.get(
                    `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-download?url=${encodeURIComponent(dlChosen.link)}&apikey=deb4e2d4982c6bc2`
                );

                const dlData = dlRes.data?.data;
                if (!dlData || !dlData.download || dlData.download.length === 0) {
                    await conn.sendMessage(from, { react: { text: "❌", key: dlMsg.key } });
                    return reply("❌ Failed to fetch Pixeldrain links.\n" + cinesubz_footer, dlMsg);
                }

                for (let file of dlData.download) {
                    if (file.name.toUpperCase().includes("PIX")) {
                        const fileName = `${info.title} (${info.year}) ${file.quality} [CineSubz].mp4`
                            .replace(/[\/\\:*?"<>|]/g, ""); // safe file name
                        await sendPixeldrainFile(conn, from, file.url, dlMsg, fileName);
                    }
                }
            });
        });

    } catch (e) {
        console.error("CineSubz error:", e);
        reply(`❌ Error: ${e.message}\n${cinesubz_footer}`);
    }
});
