const { cmd } = require("../command");
const axios = require("axios");

const AC2_FOOTER = "✫☘ 𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄 ☢️☘";
const API_BASE = "https://sl-anime1.vercel.app/api/handler";
const SRIHUB_BYPASS_API = "https://api.srihub.store/download/gdrive";
const SRIHUB_KEY = "dew_YyT0KDc2boHDasFlmZCqDcPoeDHReD20aYmEsm1G";

// ───────── Step Validator ─────────
// මේකෙන් කරන්නේ ඔයා reply කරපු මැසේජ් එක මොන ලිස්ට් එකටද අයිති කියලා check කරන එකයි.
function waitForReply(conn, from, sender, msgId) {
    return new Promise((resolve) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;

            const text = msg.message.conversation || msg.message?.extendedTextMessage?.text || "";
            const context = msg.message?.extendedTextMessage?.contextInfo;
            
            // 🔒 වැදගත්ම දේ: ඔයා reply කරපු මැසේජ් එකේ ID එක (quotedMessage) චෙක් කරනවා.
            // එතකොට සර්ච් ලිස්ට් එකට reply කරොත් සර්ච් එකයි, කොලිටි ලිස්ට් එකට reply කරොත් කොලිටි එකයි විතරක් වැඩ කරයි.
            const isReplyToCorrectMsg = context?.stanzaId === msgId;
            const isCorrectUser = (msg.key.participant || msg.key.remoteJid).includes(sender.split('@')[0]) || msg.key.remoteJid.includes("@lid");

            if (msg.key.remoteJid === from && isCorrectUser && isReplyToCorrectMsg && !isNaN(text)) {
                console.log(`[LOG] Valid Input: ${text} for Message ID: ${msgId}`);
                conn.ev.off("messages.upsert", handler);
                resolve({ msg, text: text.trim() });
            }
        };
        conn.ev.on("messages.upsert", handler);
        setTimeout(() => { conn.ev.off("messages.upsert", handler); }, 60000);
    });
}

cmd({
    pattern: "anime",
    alias: ["ac2", "movie"],
    desc: "Context-Aware Downloader",
    category: "downloader",
    react: "⛩️",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ කරුණාකර නමක් සඳහන් කරන්න.");
        
        const searchRes = await axios.get(`${API_BASE}?action=search&query=${encodeURIComponent(q)}`);
        const results = searchRes.data?.data;
        if (!results?.length) return reply("❌ කිසිවක් හමු නොවීය.");

        let listText = "⛩️ *𝐀𝐍𝐈𝐌𝐄𝐂𝐋𝐔𝐁𝟐 𝐒𝐄𝐀𝐑𝐂𝐇*\n\n";
        results.slice(0, 10).forEach((v, i) => { listText += `*${i + 1}.* ${v.title}\n`; });
        const sentSearch = await conn.sendMessage(from, { text: listText + `\nඅංකය Reply කරන්න.\n\n${AC2_FOOTER}` }, { quoted: m });

        // --- පියවර 1: ඇනිමේ එක තෝරාගැනීම ---
        const sel1 = await waitForReply(conn, from, sender, sentSearch.key.id);
        if (!sel1) return; // Timeout වුණොත් නතර වෙනවා

        const animeIdx = parseInt(sel1.text) - 1;
        const selectedAnime = results[animeIdx];

        const detailsRes = await axios.get(`${API_BASE}?action=details&url=${encodeURIComponent(selectedAnime.link)}`);
        const details = detailsRes.data?.data;
        let workUrl = selectedAnime.link;

        // --- පියවර 2: එපිසෝඩ් ලිස්ට් එක (තිබේනම්) ---
        if (details.episodes && details.episodes.length > 0) {
            let epText = `📺 *${details.title}*\n\n*Select Episode:*`;
            details.episodes.forEach((ep, i) => { epText += `\n*${i + 1}.* Episode ${ep.ep_num}`; });
            const sentEp = await conn.sendMessage(from, { image: { url: details.image }, caption: epText + `\n\nReply Episode Number.\n${AC2_FOOTER}` }, { quoted: sel1.msg });

            const sel2 = await waitForReply(conn, from, sender, sentEp.key.id);
            if (sel2) {
                const epIdx = parseInt(sel2.text) - 1;
                workUrl = details.episodes[epIdx].link;
            }
        }

        // --- පියවර 3: Quality ලිස්ට් එක ---
        const dlRes = await axios.get(`${API_BASE}?action=download&url=${encodeURIComponent(workUrl)}`);
        const dlLinks = dlRes.data?.download_links;
        
        let qText = `🎬 *Select Quality:*`;
        dlLinks.forEach((dl, i) => { qText += `\n*${i + 1}.* ${dl.quality}`; });
        const sentQual = await conn.sendMessage(from, { text: qText + `\n\nQuality අංකය Reply කරන්න.` }, { quoted: m });

        const sel3 = await waitForReply(conn, from, sender, sentQual.key.id);
        if (!sel3) return;

        const chosen = dlLinks[parseInt(sel3.text) - 1];
        await conn.sendMessage(from, { react: { text: "⏳", key: sel3.msg.key } });

        const bypassRes = await axios.get(`${SRIHUB_BYPASS_API}?url=${encodeURIComponent(chosen.direct_link)}&apikey=${SRIHUB_KEY}`);
        if (bypassRes.data?.success) {
            const file = bypassRes.data.result;
            await conn.sendMessage(from, {
                document: { url: file.downloadUrl },
                fileName: file.fileName,
                mimetype: file.mimetype,
                caption: `✅ *Download Complete*\n🎬 *${details.title}*\n💎 *Quality:* ${chosen.quality}\n\n${AC2_FOOTER}`
            }, { quoted: sel3.msg });
        }

    } catch (e) {
        console.log(e);
    }
});
