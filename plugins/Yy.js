const { cmd } = require('../command');
const axios = require('axios');

const cinesubz_footer = "> Powerd by CineSubz-XMD";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1️⃣ SEARCH COMMAND WITH REPLY SYSTEM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
    pattern: "cinesubsk",
    alias: ["moviesearch", "csearch"],
    desc: "Search for movies/TV shows on CineSubz",
    category: "downloader",
    react: "🔍",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Please provide a search query\nExample: .cinesearch Avatar");

        await reply("🔍 Searching CineSubz...");

        const url = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-search?q=${encodeURIComponent(q)}&apikey=deb4e2d4982c6bc2`;
        const { data } = await axios.get(url);

        if (!data.status || !data.data || data.data.length === 0) {
            return reply("❌ No results found.");
        }

        let message = `🎬 *CineSubz Search Results*\n\n🔎 Query: *${q}*\n📊 Found: ${data.data.length} results\n\n`;

        data.data.slice(0, 10).forEach((item, index) => {
            message += `*${index + 1}. ${item.title}*\n`;
            if (item.type) message += `   📁 Type: ${item.type}\n`;
            if (item.quality) message += `   📺 Quality: ${item.quality}\n`;
            if (item.rating) message += `   ⭐ Rating: ${item.rating}\n`;
            if (item.link) message += `   🔗 ${item.link}\n\n`;
        });

        const listMsg = await conn.sendMessage(
            from,
            { text: message + "\n🔢 *Reply with the number to choose a movie*\n\n" + cinesubz_footer },
            { quoted: mek }
        );

        const listMsgId = listMsg.key.id;

        // Wait for reply
        conn.ev.on("messages.upsert", async (update) => {
            const msg = update?.messages?.[0];
            if (!msg?.message) return;

            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
            const isReplyToList = msg?.message?.extendedTextMessage?.contextInfo?.stanzaId === listMsgId;
            if (!isReplyToList) return;

            const index = parseInt(text.trim()) - 1;
            if (isNaN(index) || index < 0 || index >= data.data.length) {
                return reply("❌ Invalid number. Please reply with a valid number from the list.");
            }

            const chosen = data.data[index];

            // Fetch movie details
            const detailsUrl = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-info?url=${encodeURIComponent(chosen.link)}&apikey=deb4e2d4982c6bc2`;
            const detailsRes = await axios.get(detailsUrl);
            const info = detailsRes.data?.data;
            if (!info) return reply("❌ Failed to fetch movie details.");

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
                msgText += `\n🔢 Reply with the number to get the download link.\n` + cinesubz_footer;
            } else {
                msgText += `❌ No download links available.`;
            }

            const detailsMsg = await conn.sendMessage(
                from,
                info.image ? { image: { url: info.image }, caption: msgText } : { text: msgText },
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
                await conn.sendMessage(from, { text: `📥 Download link:\n${dlChosen.link}` }, { quoted: dlMsg });
            });
        });
    } catch (e) {
        console.error("CineSubz error:", e);
        reply(`❌ Error: ${e.message}`);
    }
});
