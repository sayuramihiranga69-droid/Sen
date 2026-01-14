const { cmd } = require('../command');
const axios = require('axios');

const cinesubz_footer = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄☢️☘";

// Helper function to send Pixeldrain file as WhatsApp document with thumbnail
async function sendPixeldrainFile(conn, from, url, quotedMsg, fileName, thumbnailUrl) {
    try {
        let thumbBuffer = null;
        if (thumbnailUrl) {
            const response = await axios.get(thumbnailUrl, { responseType: 'arraybuffer' });
            thumbBuffer = Buffer.from(response.data, 'binary');
        }

        await conn.sendMessage(
            from,
            {
                document: { url },
                fileName: fileName,
                mimetype: "video/mp4",
                caption: cinesubz_footer,
                jpegThumbnail: thumbBuffer
            },
            { quoted: quotedMsg }
        );
    } catch (e) {
        console.error("Failed to send file:", e);
        await conn.sendMessage(from, { text: "❌ Failed to send file: " + e.message }, { quoted: quotedMsg });
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CineSubz Search + Info + Pixeldrain send with thumbnail & reactions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
    pattern: "cinesubsk",
    desc: "Search CineSubz, get info, and send Pixeldrain file with thumbnail & footer",
    category: "downloader",
    react: "🔍",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Please provide a search query\nExample: .cinesubsk Avatar");

        await conn.sendMessage(from, { react: { text: "🔍", key: m.key } });

        // 1️⃣ Search API
        const searchUrl = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-search?q=${encodeURIComponent(q)}&apikey=deb4e2d4982c6bc2`;
        const { data } = await axios.get(searchUrl);
        if (!data.status || !data.data || data.data.length === 0) return reply("❌ No results found.");

        // 2️⃣ Prepare search list message
        let listMsgText = `🎬 *CineSubz Search Results*\n\n🔎 Query: *${q}*\n📊 Found: ${data.data.length} results\n\n`;
        data.data.slice(0, 10).forEach((item, idx) => {
            listMsgText += `*${idx + 1}. ${item.title}*\n`;
            if (item.type) listMsgText += `   📁 Type: ${item.type}\n`;
            if (item.quality) listMsgText += `   📺 Quality: ${item.quality}\n`;
            if (item.rating) listMsgText += `   ⭐ Rating: ${item.rating}\n`;
        });
        listMsgText += `\n🔢 Reply with the number to get movie info.\n${cinesubz_footer}`;

        const listMsg = await conn.sendMessage(from, { text: listMsgText }, { quoted: mek });
        const listMsgId = listMsg.key.id;

        // 3️⃣ Wait for reply to select movie
        conn.ev.on("messages.upsert", async (update) => {
            const msg = update?.messages?.[0];
            if (!msg?.message) return;

            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
            const isReplyToList = msg?.message?.extendedTextMessage?.contextInfo?.stanzaId === listMsgId;
            if (!isReplyToList) return;

            const index = parseInt(text.trim()) - 1;
            if (isNaN(index) || index < 0 || index >= data.data.length) {
                await conn.sendMessage(from, { react: { text: "❌", key: msg.key } });
                return reply("❌ Invalid number. Reply with a valid number from the list.", msg);
            }

            await conn.sendMessage(from, { react: { text: "🎬", key: msg.key } });

            const chosen = data.data[index];

            // 4️⃣ Fetch movie details
            const detailsUrl = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-info?url=${encodeURIComponent(chosen.link)}&apikey=deb4e2d4982c6bc2`;
            const detailsRes = await axios.get(detailsUrl);
            const info = detailsRes.data?.data;
            if (!info) {
                await conn.sendMessage(from, { react: { text: "❌", key: msg.key } });
                return reply("❌ Failed to fetch movie details.", msg);
            }

            // Build info message
            let infoMsgText = `🎬 *${info.title}*\n\n`;
            if (info.year) infoMsgText += `📅 Year: ${info.year}\n`;
            if (info.quality) infoMsgText += `📺 Quality: ${info.quality}\n`;
            if (info.rating) infoMsgText += `⭐ Rating: ${info.rating}\n`;
            if (info.duration) infoMsgText += `⏱ Duration: ${info.duration}\n`;
            if (info.country) infoMsgText += `🌍 Country: ${info.country}\n`;
            if (info.directors) infoMsgText += `🎬 Directors: ${info.directors}\n\n`;

            if (info.downloads && info.downloads.length > 0) {
                infoMsgText += `📥 *Available Download Links:*\n`;
                info.downloads.forEach((dl, idx) => {
                    infoMsgText += `*${idx + 1}. ${dl.quality}* (${dl.size})\n`;
                });
                infoMsgText += `\n🔢 Reply with the number to get Pixeldrain link only.\n${cinesubz_footer}`;
            } else {
                infoMsgText += `❌ No download links available.`;
            }

            const detailsMsg = await conn.sendMessage(
                from,
                info.image ? { image: { url: info.image }, caption: infoMsgText } : { text: infoMsgText },
                { quoted: msg }
            );

            const detailsMsgId = detailsMsg.key.id;

            // 5️⃣ Wait for download reply
            conn.ev.on("messages.upsert", async (dlUpdate) => {
                const dlMsg = dlUpdate?.messages?.[0];
                if (!dlMsg?.message) return;

                const dlText = dlMsg.message?.conversation || dlMsg.message?.extendedTextMessage?.text;
                const isReplyToDetails = dlMsg?.message?.extendedTextMessage?.contextInfo?.stanzaId === detailsMsgId;
                if (!isReplyToDetails) return;

                const dlIndex = parseInt(dlText.trim()) - 1;
                if (isNaN(dlIndex) || dlIndex < 0 || dlIndex >= info.downloads.length) {
                    await conn.sendMessage(from, { react: { text: "❌", key: dlMsg.key } });
                    return reply("❌ Invalid number. Reply with a valid download number.", dlMsg);
                }

                const dlChosen = info.downloads[dlIndex];

                // 6️⃣ Fetch Pixeldrain only
                const dlRes = await axios.get(
                    `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-download?url=${encodeURIComponent(dlChosen.link)}&apikey=deb4e2d4982c6bc2`
                );

                const dlData = dlRes.data?.data;
                if (!dlData || !dlData.download || dlData.download.length === 0) {
                    await conn.sendMessage(from, { react: { text: "❌", key: dlMsg.key } });
                    return reply("❌ Failed to fetch Pixeldrain links.", dlMsg);
                }

                // 7️⃣ Send only PIX files with thumbnail
                for (let file of dlData.download) {
                    if (file.name.toUpperCase().includes("PIX")) {
                        const fileName = `${info.title} (${info.year}) ${file.quality} [CineSubz].mp4`
                            .replace(/[\/\\:*?"<>|]/g, ""); // safe file name
                        await sendPixeldrainFile(conn, from, file.url, dlMsg, fileName, info.image);
                        await conn.sendMessage(from, { react: { text: "✅", key: dlMsg.key } });
                    }
                }
            });
        });

    } catch (e) {
        console.error("CineSubz error:", e);
        reply(`❌ Error: ${e.message}`);
    }
});
