const { cmd } = require('../command');
const axios = require('axios');

const cinesubz_footer = "✫☘𝐒𝐀𝐘𝐔𝐑𝐀 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄☢️☘";

// Helper function to send Pixeldrain file as WhatsApp document
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
    } catch (e) {
        console.error("Failed to send file:", e);
        await conn.sendMessage(from, { text: "❌ Failed to send file: " + e.message }, { quoted: quotedMsg });
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEARCH + REPLY SYSTEM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
    pattern: "cinesubsk",
    desc: "Search movies/TV shows on CineSubz and send files",
    category: "downloader",
    react: "🔍",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Please provide a search query\nExample: .cinesubsk Avatar");

        await reply("🔍 Searching CineSubz...");

        const searchUrl = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-search?q=${encodeURIComponent(q)}&apikey=deb4e2d4982c6bc2`;
        const { data } = await axios.get(searchUrl);

        if (!data.status || !data.data || data.data.length === 0) return reply("❌ No results found.");

        // Prepare search list
        let listMsgText = `🎬 *CineSubz Search Results*\n\n🔎 Query: *${q}*\n📊 Found: ${data.data.length} results\n\n`;
        data.data.slice(0, 10).forEach((item, idx) => {
            listMsgText += `*${idx + 1}. ${item.title}*\n`;
            if (item.type) listMsgText += `   📁 Type: ${item.type}\n`;
            if (item.quality) listMsgText += `   📺 Quality: ${item.quality}\n`;
            if (item.rating) listMsgText += `   ⭐ Rating: ${item.rating}\n`;
            if (item.link) listMsgText += `   🔗 ${item.link}\n\n`;
        });
        listMsgText += `🔢 Reply with the number to choose a movie.\n${cinesubz_footer}`;

        const listMsg = await conn.sendMessage(from, { text: listMsgText }, { quoted: mek });
        const listMsgId = listMsg.key.id;

        // Wait for movie selection reply
        conn.ev.on("messages.upsert", async (update) => {
            const msg = update?.messages?.[0];
            if (!msg?.message) return;

            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
            const isReplyToList = msg?.message?.extendedTextMessage?.contextInfo?.stanzaId === listMsgId;
            if (!isReplyToList) return;

            const index = parseInt(text.trim()) - 1;
            if (isNaN(index) || index < 0 || index >= data.data.length) {
                return reply("❌ Invalid number. Reply with a valid number.", msg);
            }

            const chosen = data.data[index];

            // Fetch movie details
            const detailsUrl = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-info?url=${encodeURIComponent(chosen.link)}&apikey=deb4e2d4982c6bc2`;
            const detailsRes = await axios.get(detailsUrl);
            const info = detailsRes.data?.data;
            if (!info) return reply("❌ Failed to fetch movie details.", msg);

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
                infoMsgText += `\n🔢 Reply with the number to get the file.\n${cinesubz_footer}`;
            } else {
                infoMsgText += "❌ No download links available.";
            }

            const detailsMsg = await conn.sendMessage(
                from,
                info.image ? { image: { url: info.image }, caption: infoMsgText } : { text: infoMsgText },
                { quoted: msg }
            );
            const detailsMsgId = detailsMsg.key.id;

            // Wait for download reply
            conn.ev.on("messages.upsert", async (dlUpdate) => {
                const dlMsg = dlUpdate?.messages?.[0];
                if (!dlMsg?.message) return;

                const dlText = dlMsg.message?.conversation || dlMsg.message?.extendedTextMessage?.text;
                const isReplyToDetails = dlMsg?.message?.extendedTextMessage?.contextInfo?.stanzaId === detailsMsgId;
                if (!isReplyToDetails) return;

                const dlIndex = parseInt(dlText.trim()) - 1;
                if (isNaN(dlIndex) || dlIndex < 0 || dlIndex >= info.downloads.length) {
                    return reply("❌ Invalid number. Reply with a valid download number.", dlMsg);
                }

                const dlChosen = info.downloads[dlIndex];

                // Send Pixeldrain or Telegram link
                if (dlChosen.link.includes("pixeldrain.com")) {
                    const fileName = `${info.title} (${info.year}) ${dlChosen.quality} [CineSubz].mp4`
                        .replace(/[\/\\:*?"<>|]/g, ""); // safe file name
                    await sendPixeldrainFile(conn, from, dlChosen.link, dlMsg, fileName);
                } else {
                    await conn.sendMessage(
                        from,
                        { text: `📥 Download link:\n${dlChosen.link}\n\n${cinesubz_footer}` },
                        { quoted: dlMsg }
                    );
                }

                await conn.sendMessage(from, { react: { text: "✅", key: dlMsg.key } });
            });
        });
    } catch (e) {
        console.error("CineSubz error:", e);
        reply(`❌ Error: ${e.message}`);
    }
});
