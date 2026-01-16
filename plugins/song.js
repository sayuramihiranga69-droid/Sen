const { cmd } = require("../command");
const axios = require("axios");
const yts = require("yt-search");

const FOOTER = "🎧 𝐒𝐀𝐘𝐔𝐑𝐀 𝐒𝐎𝐔𝐍𝐃 𝐒𝐘𝐒𝐓𝐄𝐌 🎧";

// ───────── Smart Waiter (Reply එක එනතෙක් රැඳී සිටීම) ─────────
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
        setTimeout(() => { 
            conn.ev.off("messages.upsert", handler); 
            resolve(null); 
        }, 300000); // විනාඩි 5ක් දක්වා රැඳී සිටී
    });
}

cmd({
    pattern: "song",
    alias: ["audio", "ytsong"],
    desc: "YouTube Music Downloader (Direct Reply System)",
    category: "downloader",
    react: "🎧",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ කරුණාකර සින්දුවේ නම හෝ YouTube Link එකක් ලබා දෙන්න.");

        // 1. YouTube එකේ සින්දුව සෙවීම
        const searchRes = await yts(q);
        const results = searchRes.videos.slice(0, 10);
        if (!results?.length) return reply("❌ කිසිවක් හමු නොවීය.");

        let listText = `🎧 *𝐘𝐎𝐔𝐓𝐔𝐁𝐄 𝐒𝐎𝐔𝐍𝐃 𝐒𝐄𝐀𝐑𝐂𝐇*\n\n`;
        results.forEach((v, i) => { 
            listText += `*${i + 1}.* ${v.title} (${v.duration})\n`; 
        });

        const sentMsg = await conn.sendMessage(from, { 
            text: listText + `\nඅංකය Reply කරන්න.` 
        }, { quoted: m });

        // 2. පරිශීලකයා අංකය එවන තෙක් රැඳී සිටීම
        const selection = await waitForReply(conn, from, sender, sentMsg.key.id);
        if (!selection) return;

        const idx = parseInt(selection.text) - 1;
        const selectedVideo = results[idx];
        if (!selectedVideo) return reply("❌ වැරදි අංකයකි.");

        await conn.sendMessage(from, { react: { text: "⏳", key: selection.msg.key } });

        // 3. API එක හරහා Download Link ලබා ගැනීම
        const apiUrl = `https://api-dark-shan-yt.koyeb.app/download/ytmp3?url=${encodeURIComponent(selectedVideo.url)}&apikey=edbcfabbca5a9750`;
        
        // Axios සඳහා timeout එක තත්පර 120 දක්වා වැඩි කරන ලදී
        const res = await axios.get(apiUrl, { timeout: 120000 });

        if (res.data && res.data.status) {
            const dlData = res.data.data;
            
            // 4. සින්දුව Audio File එකක් ලෙස යැවීම
            await conn.sendMessage(from, {
                audio: { url: dlData.download },
                mimetype: "audio/mpeg",
                fileName: `${dlData.title}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        title: dlData.title,
                        body: FOOTER,
                        thumbnailUrl: selectedVideo.thumbnail,
                        sourceUrl: selectedVideo.url,
                        mediaType: 1,
                        showAdAttribution: true,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: selection.msg });

            await conn.sendMessage(from, { react: { text: "✅", key: selection.msg.key } });

        } else {
            await reply("❌ API එකෙන් දත්ත ලබා ගැනීමට නොහැකි විය. කරුණාකර නැවත උත්සාහ කරන්න.");
        }

    } catch (e) {
        console.error("Error in song command:", e);
        // Timeout දෝෂයක් නම් පමණක් විශේෂ පණිවිඩයක් පෙන්වයි
        if (e.code === 'ECONNABORTED') {
            reply("❌ සර්වර් එකේ ප්‍රමාදයක් පවතී. කරුණාකර මද වේලාවකින් නැවත උත්සාහ කරන්න.");
        } else {
            reply("❌ දෝෂයක් සිදු විය. කරුණාකර ඔබ ලබා දුන් Link එක පරීක්ෂා කරන්න.");
        }
    }
});
