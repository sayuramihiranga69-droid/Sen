const { cmd } = require("../command");
const axios = require("axios");

const XN_FOOTER = "✫☘ 𝐗-𝐒𝐄𝐀𝐑𝐂𝐇 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐑 ☢️☘";
const SRIHUB_KEY = "dew_YyT0KDc2boHDasFlmZCqDcPoeDHReD20aYmEsm1G";
const SEARCH_API = "https://api.srihub.store/nsfw/xnxxsearch";
const DOWNLOAD_API = "https://api.srihub.store/nsfw/xnxxdl";

/**
 * Multi-Reply Support Waiter
 * සෙවුම් ලැයිස්තුවට කිහිප වරක් reply කළ හැකි වන පරිදි සකසා ඇත.
 */
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
            // මෙහිදී handler එක off කරන්නේ නැත (එවිට එකම list එකට දිගටම reply කළ හැක)
            callback({ msg, text: text.trim() });
        }
    };
    conn.ev.on("messages.upsert", handler);
    // විනාඩි 10 කට පසු ස්වයංක්‍රීයව නතර වේ.
    setTimeout(() => { conn.ev.off("messages.upsert", handler); }, 600000); 
}

cmd({
    pattern: "xnxx",
    alias: ["xsearch", "xn"],
    desc: "Search and download xnxx videos with thumbnail",
    category: "nsfw",
    react: "🔞",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ කරුණාකර සෙවිය යුතු නමක් (Query) ඇතුළත් කරන්න.");

        // 1. සෙවුම් ප්‍රතිඵල ලබා ගැනීම
        const searchRes = await axios.get(`${SEARCH_API}?q=${encodeURIComponent(q)}&apikey=${SRIHUB_KEY}`);
        const results = searchRes.data?.results?.result;

        if (!results || results.length === 0) return reply("❌ කිසිවක් හමු නොවීය.");

        let listText = "🔞 *𝐗𝐍𝐗𝐗 𝐒𝐄𝐀𝐑𝐂𝐇 𝐑𝐄𝐒𝐔𝐋𝐓𝐒*\n\n";
        results.slice(0, 15).forEach((v, i) => {
            listText += `*${i + 1}.* ${v.title}\n   _⏱️ ${v.duration} | 👁️ ${v.views}_\n\n`;
        });

        const sentSearch = await conn.sendMessage(from, { 
            text: listText + `අංකය Reply කරන්න. (ඔබට අවශ්‍ය ඕනෑම අංක ගණනක් මෙයට Reply කළ හැක)` 
        }, { quoted: m });

        // සෙවුම් ලැයිස්තුවේ reply handle කිරීම
        startWaiting(conn, from, sender, sentSearch.key.id, async (selection) => {
            const idx = parseInt(selection.text) - 1;
            const selectedVideo = results[idx];
            if (!selectedVideo) return;

            await conn.sendMessage(from, { react: { text: "⏳", key: selection.msg.key } });

            try {
                // 2. වීඩියෝ ලින්ක් ලබා ගැනීම
                const dlRes = await axios.get(`${DOWNLOAD_API}?url=${encodeURIComponent(selectedVideo.link)}&apikey=${SRIHUB_KEY}`);
                const data = dlRes.data?.results;
                if (!data) return;

                let qualityText = `🎥 *${data.title}*\n\n` +
                                 `*1.* High Quality (MP4)\n` +
                                 `*2.* Low Quality (3GP)\n\n` +
                                 `Quality අංකය Reply කරන්න.`;

                const sentQual = await conn.sendMessage(from, { 
                    image: { url: data.image }, 
                    caption: qualityText 
                }, { quoted: selection.msg });

                // Quality තේරීම සඳහා බලා සිටීම
                startWaiting(conn, from, sender, sentQual.key.id, async (qSel) => {
                    const videoUrl = qSel.text === "1" ? data.files.high : data.files.low;
                    
                    await conn.sendMessage(from, { react: { text: "📥", key: qSel.msg.key } });

                    // පින්තූරය buffer එකක් ලෙස ලබා ගැනීම (Thumbnail සඳහා)
                    const imageBuff = await axios.get(data.image, { responseType: 'arraybuffer' });
                    const thumbnail = Buffer.from(imageBuff.data, 'utf-8');

                    // 3. වීඩියෝව Document එකක් ලෙස යැවීම
                    await conn.sendMessage(from, {
                        document: { url: videoUrl },
                        fileName: `${data.title}.mp4`,
                        mimetype: "video/mp4",
                        jpegThumbnail: thumbnail, // මෙතැනින් Thumbnail එක වැටේ
                        caption: `✅ *Download Complete*\n🎬 *${data.title}*\n\n${XN_FOOTER}`
                    }, { quoted: qSel.msg });
                });

            } catch (err) {
                console.error(err);
            }
        });

    } catch (e) {
        console.log(e);
        reply("❌ දෝෂයක් සිදු විය. පසුව උත්සාහ කරන්න.");
    }
});
