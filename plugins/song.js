const { cmd } = require("../command");
const axios = require("axios");
const yts = require("yt-search");

const FOOTER = "🎧 𝐒𝐀𝐘𝐔𝐑𝐀 𝐒𝐎𝐔𝐍𝐃 𝐒𝐘𝐒𝐓𝐄𝐌 🎧";

// ───────── Smart Waiter ─────────
function waitForReply(conn, from, sender, targetId) {
    return new Promise((resolve) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;

            const text = msg.message.conversation || msg.message?.extendedTextMessage?.text || "";
            const context = msg.message?.extendedTextMessage?.contextInfo;
            const msgSender = msg.key.participant || msg.key.remoteJid;
            
            const isTargetReply = context?.stanzaId === targetId;
            const isCorrectUser = msgSender.includes(sender.split('@')[0]) || msgSender.includes("@lid");

            if (msg.key.remoteJid === from && isCorrectUser && isTargetReply && !isNaN(text)) {
                conn.ev.off("messages.upsert", handler);
                resolve({ msg, text: text.trim() });
            }
        };
        conn.ev.on("messages.upsert", handler);
        setTimeout(() => { conn.ev.off("messages.upsert", handler); resolve(null); }, 180000); 
    });
}

cmd({
    pattern: "song",
    alias: ["audio", "ytsong"],
    desc: "YouTube Music Downloader (Reply System)",
    category: "downloader",
    react: "🎧",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply, sender, prefix }) => {
    try {
        if (!q) return reply("❗ කරුණාකර සින්දුවේ නම හෝ Link එකක් ලබා දෙන්න.");

        const searchRes = await yts(q);
        const results = searchRes.videos.slice(0, 10);
        if (!results?.length) return reply("❌ කිසිවක් හමු නොවීය.");

        let listText = `🎧 *𝐘𝐎𝐔𝐓𝐔𝐁𝐄 𝐒𝐎𝐔𝐍𝐃 𝐒𝐄𝐀𝐑𝐂𝐇*\n\n`;
        results.forEach((v, i) => { 
            listText += `*${i + 1}.* ${v.title} (${v.duration})\n`; 
        });

        const sentMsg = await conn.sendMessage(from, { 
            text: listText + `\nඅවශ්‍ය සින්දුවේ අංකය Reply කරන්න.` 
        }, { quoted: m });

        const selection = await waitForReply(conn, from, sender, sentMsg.key.id);
        if (!selection) return;

        const idx = parseInt(selection.text) - 1;
        const selectedVideo = results[idx];
        if (!selectedVideo) return reply("❌ වැරදි අංකයකි. කරුණාකර ලැයිස්තුවේ ඇති අංකයක් ලබා දෙන්න.");

        await conn.sendMessage(from, { react: { text: "⏳", key: selection.msg.key } });

        // API Request එකට timeout එකක් සහ error handling එකතු කර ඇත
        const apiUrl = `https://api-dark-shan-yt.koyeb.app/download/ytmp3?url=${encodeURIComponent(selectedVideo.url)}&apikey=edbcfabbca5a9750`;
        
        try {
            const res = await axios.get(apiUrl, { timeout: 60000 }); // තත්පර 60ක කාලයක් ලබා දීම

            if (!res.data || !res.data.status || !res.data.data.download) {
                return reply("❌ API එකෙන් සින්දුව ලබා ගැනීමට නොහැකි විය. කරුණාකර නැවත උත්සාහ කරන්න.");
            }

            const downloadUrl = res.data.data.download;

            await conn.sendMessage(from, {
                audio: { url: downloadUrl },
                mimetype: "audio/mpeg",
                fileName: `${selectedVideo.title}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        title: selectedVideo.title,
                        body: FOOTER,
                        thumbnailUrl: selectedVideo.thumbnail,
                        sourceUrl: selectedVideo.url,
                        mediaType: 1,
                        showAdAttribution: true
                    }
                }
            }, { quoted: selection.msg });

            await conn.sendMessage(from, { react: { text: "✅", key: selection.msg.key } });

        } catch (apiError) {
            console.error("API Error:", apiError.message);
            reply("❌ API සබඳතාවයේ දෝෂයකි. (Timeout හෝ Server Down)");
        }

    } catch (e) {
        console.error("Global Error:", e);
        reply("❌ පද්ධතියේ දෝෂයක් සිදු විය.");
    }
});
