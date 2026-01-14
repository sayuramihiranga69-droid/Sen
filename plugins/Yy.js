const { cmd } = require('../command');
const axios = require('axios');

const cinesubz_footer = "> Powerd by SAYURA-XMD";

// Pixeldrain file send function
async function sendPixeldrainFile(conn, from, url, quoted, fileName) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        await conn.sendMessage(from, {
            document: buffer,
            mimetype: 'video/mp4',
            fileName
        }, { quoted });
    } catch (e) {
        console.error("Error sending Pixeldrain file:", e);
        await conn.sendMessage(from, { text: "❌ Failed to send Pixeldrain file." }, { quoted });
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CineSubz Full Flow: Search → Info → Pixeldrain Send
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
    pattern: "cinesubsk",
    desc: "Search CineSubz, get info, and send Pixeldrain file (Telegram skipped)",
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

        // Build search list
        let listMsgText = `🎬 *CineSubz Search Results*\n\n🔎 Query: *${q}*\n📊 Found: ${data.data.length} results\n\n`;
        data.data.slice(0, 10).forEach((item, idx) => {
            listMsgText += `*${idx + 1}. ${item.title}*\n`;
            if (item.type) listMsgText += `   📁 Type: ${item.type}\n`;
            if (item.quality) listMsgText += `   📺 Quality: ${item.quality}\n`;
            if (item.rating) listMsgText += `   ⭐ Rating: ${item.rating}\n`;
        });

        const listMsg = await conn.sendMessage(
            from,
            { text: listMsgText + "\n🔢 Reply with the number to get movie info\n\n" + cinesubz_footer },
            { quoted: mek }
        );

        const listMsgId = listMsg.key.id;

        // 2️⃣ Wait for reply to select movie
        conn.ev.on("messages.upsert", async (update) => {
            const msg = update?.messages?.[0];
            if (!msg?.message) return;

            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
            const isReplyToList = msg?.message?.extendedTextMessage?.contextInfo?.stanzaId === listMsgId;
            if (!isReplyToList) return;

            const index = parseInt(text.trim()) - 1;
            if (isNaN(index) || index < 0 || index >= data.data.length) {
                return reply("❌ Invalid number. Reply with a valid number from the list.", msg);
            }

            const chosen = data.data[index];

            // 3️⃣ Fetch movie details
            const detailsUrl = `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-info?url=${encodeURIComponent(chosen.link)}&apikey=deb4e2d4982c6bc2`;
            const detailsRes = await axios.get(detailsUrl);
            const info = detailsRes.data?.data;
            if (!info) return reply("❌ Failed to fetch movie details.", msg);

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
                msgText += `\n🔢 Reply with the number to get Pixeldrain link only.\n` + cinesubz_footer;
            } else {
                msgText += `❌ No download links available.`;
            }

            const detailsMsg = await conn.sendMessage(
                from,
                info.image ? { image: { url: info.image }, caption: msgText } : { text: msgText },
                { quoted: msg }
            );

            const detailsMsgId = detailsMsg.key.id;

            // 4️⃣ Wait for download reply
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

                // 5️⃣ Fetch Pixeldrain only
                const dlRes = await axios.get(
                    `https://api-dark-shan-yt.koyeb.app/movie/cinesubz-download?url=${encodeURIComponent(dlChosen.link)}&apikey=deb4e2d4982c6bc2`
                );

                const dlData = dlRes.data?.data;
                if (!dlData || !dlData.download || dlData.download.length === 0)
                    return reply("❌ Failed to fetch Pixeldrain links.", dlMsg);

                // Send only PIX links
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
        reply(`❌ Error: ${e.message}`);
    }
});
