const { cmd } = require("../command");
const axios = require("axios");
const yts = require("yt-search");

const FOOTER = "🎧 𝐒𝐀𝐘𝐔𝐑𝐀 𝐒𝐎𝐔𝐍𝐃 𝐒𝐘𝐒𝐓𝐄𝐌 🎧";

// ───────── Smart Waiter (Reply බලාපොරොත්තුවෙන් සිටීම) ─────────
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
        setTimeout(() => { conn.ev.off("messages.upsert", handler); }, 180000); // විනාඩි 3 ක කාලයක්
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
        if (!q) return reply("❗ කරුණාකර සින්දුවේ නම හෝ YouTube Link එකක් ලබා දෙන්න.");

        // 1. YouTube Search - වීඩියෝ කිහිපයක් සෙවීම
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

        // 2. පරිශීලකයාගේ Reply එක ලබා ගැනීම
        const selection = await waitForReply(conn, from, sender, sentMsg.key.id);
        if (!selection) return;

        const idx = parseInt(selection.text) - 1;
        const selectedVideo = results[idx];
        if (!selectedVideo) return reply("❌ වැරදි අංකයකි.");

        // Reaction එකක් දැමීම
        await conn.sendMessage(from, { react: { text: "⏳", key: selection.msg.key } });

        // 3. API එක හරහා Download Link ලබා ගැනීම
        const apiUrl = `https://api-dark-shan-yt.koyeb.app/download/ytmp3?url=${encodeURIComponent(selectedVideo.url)}&apikey=edbcfabbca5a9750`;
        const res = await axios.get(apiUrl);

        if (!res.data.status) return reply("❌ Download Link ලබා ගැනීමට නොහැකි විය.");

        const downloadUrl = res.data.data.download;
        const title = selectedVideo.title;

        // 4. සින්දුව Audio එකක් ලෙස යැවීම
        await conn.sendMessage(from, {
            audio: { url: downloadUrl },
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`
        }, { quoted: selection.msg });

        // Reaction එක වෙනස් කිරීම
        await conn.sendMessage(from, { react: { text: "✅", key: selection.msg.key } });

    } catch (e) {
        console.error(e);
        reply("❌ දෝෂයක් සිදු විය.");
    }
});
