const { cmd } = require("../command");
const axios = require("axios");

const XN_FOOTER = "✫☘ 𝐗-𝐒𝐄𝐀𝐑𝐂𝐇 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐑 ☢️☘";
const SRIHUB_KEY = "dew_5H5Dbuh4v7NbkNRmI0Ns2u2ZK240aNnJ9lnYQXR9";
const SEARCH_API = "https://api.srihub.store/nsfw/xnxxsearch";
const DOWNLOAD_API = "https://api.srihub.store/nsfw/xnxxdl";

// ───────── Multi-Reply Support Waiter ─────────
function startWaiting(conn, from, sender, targetId, callback) {
    const handler = async (update) => {
        const msg = update.messages?.[0];
        if (!msg?.message) return;

        const text = msg.message.conversation || msg.message?.extendedTextMessage?.text || "";
        const context = msg.message?.extendedTextMessage?.contextInfo;
        const msgSender = msg.key.participant || msg.key.remoteJid;
        
        const isTargetReply = context?.stanzaId === targetId;
        const isCorrectUser = msgSender.includes(sender.split('@')[0]) || msgSender.includes("@lid");

        if (msg.key.remoteJid === from && isCorrectUser && isTargetReply && !isNaN(text)) {
            callback({ msg, text: text.trim() });
        }
    };
    conn.ev.on("messages.upsert", handler);
    setTimeout(() => { conn.ev.off("messages.upsert", handler); }, 600000); 
}

cmd({
    pattern: "xnxx",
    alias: ["xsearch", "xn"],
    desc: "Search and download xnxx videos with Console Support",
    category: "nsfw",
    react: "🔞",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        console.log(`[X-SEARCH] Query: ${q}`); // Console Support
        if (!q) return reply("❗ කරුණාකර සෙවිය යුතු නමක් ඇතුළත් කරන්න.");

        const searchRes = await axios.get(`${SEARCH_API}?q=${encodeURIComponent(q)}&apikey=${SRIHUB_KEY}`);
        const results = searchRes.data?.results?.result;

        if (!results || results.length === 0) {
            console.log("[X-SEARCH] No results found.");
            return reply("❌ කිසිවක් හමු නොවීය.");
        }

        let listText = "🔞 *𝐗𝐍𝐗𝐗 𝐒𝐄𝐀𝐑𝐂𝐇 𝐑𝐄𝐒𝐔𝐋𝐓𝐒*\n\n";
        results.slice(0, 15).forEach((v, i) => {
            listText += `*${i + 1}.* ${v.title}\n   _⏱️ ${v.duration}_\n\n`;
        });

        const sentSearch = await conn.sendMessage(from, { 
            text: listText + `අංකය Reply කරන්න.` 
        }, { quoted: m });

        startWaiting(conn, from, sender, sentSearch.key.id, async (selection) => {
            const idx = parseInt(selection.text) - 1;
            const selectedVideo = results[idx];
            if (!selectedVideo) return;

            console.log(`[X-DOWNLOAD] Selected: ${selectedVideo.title}`);
            await conn.sendMessage(from, { react: { text: "⏳", key: selection.msg.key } });

            try {
                const dlRes = await axios.get(`${DOWNLOAD_API}?url=${encodeURIComponent(selectedVideo.link)}&apikey=${SRIHUB_KEY}`);
                const data = dlRes.data?.results;
                if (!data) return console.log("[X-DOWNLOAD] Download data null.");

                let qualityText = `🎥 *${data.title}*\n\n*1.* High Quality (MP4)\n*2.* Low Quality (3GP)\n\nQuality අංකය එවන්න.`;
                const sentQual = await conn.sendMessage(from, { 
                    image: { url: data.image }, 
                    caption: qualityText 
                }, { quoted: selection.msg });

                startWaiting(conn, from, sender, sentQual.key.id, async (qSel) => {
                    const videoUrl = qSel.text === "1" ? data.files.high : data.files.low;
                    console.log(`[X-SEND] Sending Video URL: ${videoUrl}`);
                    
                    await conn.sendMessage(from, { react: { text: "📥", key: qSel.msg.key } });

                    // --- Clear Thumbnail Logic ---
                    console.log("[X-SEND] Fetching thumbnail...");
                    const response = await axios.get(data.image, { responseType: 'arraybuffer' });
                    const thumbnail = Buffer.from(response.data, 'binary');

                    await conn.sendMessage(from, {
                        document: { url: videoUrl },
                        fileName: `${data.title}.mp4`,
                        mimetype: "video/mp4",
                        contextInfo: {
                            externalAdReply: {
                                title: data.title,
                                body: XN_FOOTER,
                                mediaType: 1,
                                sourceUrl: selectedVideo.link,
                                thumbnail: thumbnail, 
                                renderLargerThumbnail: true, // HD Preview එකක් සඳහා
                                showAdAttribution: true
                            }
                        },
                        jpegThumbnail: thumbnail, 
                        caption: `✅ *Download Complete*\n🎬 *${data.title}*\n\n${XN_FOOTER}`
                    }, { quoted: qSel.msg });
                    
                    console.log("[X-SEND] Document sent successfully.");
                });

            } catch (err) {
                console.log(`[ERROR] Download: ${err.message}`);
            }
        });

    } catch (e) {
        console.log(`[ERROR] Command: ${e.message}`);
    }
});
