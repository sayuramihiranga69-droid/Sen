const { cmd } = require("../command");
const axios = require("axios");

const AC2_FOOTER = "✫☘ 𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄 ☢️☘";
const API_BASE = "https://sl-anime1.vercel.app/api/handler";
const SRIHUB_BYPASS_API = "https://api.srihub.store/download/gdrive";
const SRIHUB_KEY = "dew_YyT0KDc2boHDasFlmZCqDcPoeDHReD20aYmEsm1G";

// ───────── Ultra-Fast Global Wait Helper ─────────
function waitForReply(conn, from, sender) {
    return new Promise((resolve) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;

            const text = msg.message.conversation || msg.message?.extendedTextMessage?.text || "";
            const msgSender = msg.key.participant || msg.key.remoteJid;
            const isCorrectUser = msgSender.includes(sender.split('@')[0]) || msgSender.includes("@lid");

            if (msg.key.remoteJid === from && isCorrectUser && !isNaN(text)) {
                conn.ev.off("messages.upsert", handler);
                resolve({ msg, text: text.trim() });
            }
        };
        conn.ev.on("messages.upsert", handler);
        // Timeout එකක් නැහැ, ඔයා මැසේජ් එක එවනකම් බොට් බලාගෙන ඉන්නවා (Max 2 min)
        setTimeout(() => { conn.ev.off("messages.upsert", handler); }, 120000);
    });
}

cmd({
    pattern: "anime",
    alias: ["ac2", "movie"],
    desc: "Queue Supported Fast Downloader",
    category: "downloader",
    react: "⛩️",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ නමක් සඳහන් කරන්න.");

        // 1. සෙවීම
        const searchRes = await axios.get(`${API_BASE}?action=search&query=${encodeURIComponent(q)}`);
        const results = searchRes.data?.data;
        if (!results?.length) return reply("❌ කිසිවක් හමු නොවීය.");

        let listText = "⛩️ *𝐀𝐍𝐈𝐌𝐄𝐂𝐋𝐔𝐁𝟐 𝐒𝐄𝐀𝐑𝐂𝐇*\n\n";
        results.slice(0, 10).forEach((v, i) => { listText += `*${i + 1}.* ${v.title}\n`; });
        await conn.sendMessage(from, { text: listText + `\nඅංකය Reply කරන්න.` }, { quoted: m });

        // --- STEP 1: ඇනිමේ එක තේරීම ---
        const sel1 = await waitForReply(conn, from, sender);
        const animeIdx = parseInt(sel1.text) - 1;
        if (!results[animeIdx]) return; 

        // විස්තර ගැනීම (පසුබිමින් වේගයෙන් සිදුවේ)
        const detailsRes = await axios.get(`${API_BASE}?action=details&url=${encodeURIComponent(results[animeIdx].link)}`);
        const details = detailsRes.data?.data;
        let workUrl = results[animeIdx].link;

        // --- STEP 2: එපිසෝඩ් ලිස්ට් එක (තිබේනම්) ---
        if (details.episodes && details.episodes.length > 0) {
            let epText = `📺 *${details.title}*\n\n*Select Episode:*`;
            details.episodes.forEach((ep, i) => { epText += `\n*${i + 1}.* Episode ${ep.ep_num}`; });
            await conn.sendMessage(from, { image: { url: details.image }, caption: epText + `\n\nඑපිසෝඩ් අංකය එවන්න.` });

            const sel2 = await waitForReply(conn, from, sender);
            workUrl = details.episodes[parseInt(sel2.text) - 1].link;
        }

        // --- STEP 3: Quality ලිස්ට් එක ---
        const dlRes = await axios.get(`${API_BASE}?action=download&url=${encodeURIComponent(workUrl)}`);
        const dlLinks = dlRes.data?.download_links;
        
        let qText = `🎬 *Select Quality:*`;
        dlLinks.forEach((dl, i) => { qText += `\n*${i + 1}.* ${dl.quality}`; });
        await conn.sendMessage(from, { text: qText + `\n\nQuality අංකය එවන්න.` });

        const sel3 = await waitForReply(conn, from, sender);
        const chosen = dlLinks[parseInt(sel3.text) - 1];

        // ඩවුන්ලෝඩ් එක
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
