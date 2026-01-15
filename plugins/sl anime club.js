const { cmd } = require("../command");
const axios = require("axios");

const AC2_FOOTER = "✫☘ 𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄 ☢️☘";
const API_BASE = "https://sl-anime1.vercel.app/api/handler";
const SRIHUB_BYPASS_API = "https://api.srihub.store/download/gdrive";
const SRIHUB_KEY = "dew_YyT0KDc2boHDasFlmZCqDcPoeDHReD20aYmEsm1G";

// ───────── Smart Multi-Context Waiter ─────────
function waitForReply(conn, from, sender, targetMsgId) {
    return new Promise((resolve) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;

            const text = msg.message.conversation || msg.message?.extendedTextMessage?.text || "";
            const context = msg.message?.extendedTextMessage?.contextInfo;
            const msgSender = msg.key.participant || msg.key.remoteJid;
            
            // 🔍 පරීක්ෂාව 1: රිප්ලයි කරලා තියෙන්නේ අපි බලාපොරොත්තු වන මැසේජ් එකටමද?
            const isTargetReply = context?.stanzaId === targetMsgId;
            const isCorrectUser = msgSender.includes(sender.split('@')[0]) || msgSender.includes("@lid");

            if (msg.key.remoteJid === from && isCorrectUser && isTargetReply && !isNaN(text)) {
                conn.ev.off("messages.upsert", handler);
                resolve({ msg, text: text.trim() });
            }
        };
        conn.ev.on("messages.upsert", handler);
        setTimeout(() => { conn.ev.off("messages.upsert", handler); }, 120000);
    });
}

cmd({
    pattern: "anime",
    alias: ["ac2", "movie"],
    desc: "Context-Aware Multi Downloader",
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
        
        // 💾 සර්ච් ලිස්ට් එක යවනවා (මේ මැසේජ් එකේ ID එක වැදගත්)
        const sentSearch = await conn.sendMessage(from, { text: listText + `\nඅදාළ අංකය Reply කරන්න.\n\n${AC2_FOOTER}` }, { quoted: m });

        // --- ස්වාධීන පියවර පාලනය (Function එක ඇතුළේ වෙනම ලොජික් එකක්) ---
        const handleFlow = async (msgToWatchId, currentResults) => {
            const selection = await waitForReply(conn, from, sender, msgToWatchId);
            if (!selection) return;

            const idx = parseInt(selection.text) - 1;
            const selected = currentResults[idx];
            if (!selected) return;

            // විස්තර ලබාගැනීම
            const detRes = await axios.get(`${API_BASE}?action=details&url=${encodeURIComponent(selected.link)}`);
            const details = detRes.data?.data;

            // Quality ලබාගැනීම
            const dlRes = await axios.get(`${API_BASE}?action=download&url=${encodeURIComponent(selected.link)}`);
            const dlLinks = dlRes.data?.download_links;

            let qText = `🎬 *Select Quality:*\n*${details.title}*`;
            dlLinks.forEach((dl, i) => { qText += `\n*${i + 1}.* ${dl.quality}`; });
            
            // 💾 Quality ලිස්ට් එක යවනවා (මේකට වෙනම ID එකක් ලැබෙනවා)
            const sentQual = await conn.sendMessage(from, { text: qText + `\n\nQuality අංකය එවන්න.` }, { quoted: selection.msg });

            // Quality එක තෝරනකම් බලන් ඉන්නවා (රිප්ලයි එක බලන්නේ sentQual එකට විතරයි)
            const qSelection = await waitForReply(conn, from, sender, sentQual.key.id);
            if (!qSelection) return;

            const chosen = dlLinks[parseInt(qSelection.text) - 1];
            
            // Bypass & Download
            const bypass = await axios.get(`${SRIHUB_BYPASS_API}?url=${encodeURIComponent(chosen.direct_link)}&apikey=${SRIHUB_KEY}`);
            if (bypass.data?.success) {
                const file = bypass.data.result;
                await conn.sendMessage(from, {
                    document: { url: file.downloadUrl },
                    fileName: file.fileName,
                    mimetype: file.mimetype,
                    caption: `✅ *Download Complete*\n🎬 *${details.title}*\n💎 *Quality:* ${chosen.quality}\n\n${AC2_FOOTER}`
                }, { quoted: qSelection.msg });
            }
        };

        // පළවෙනි පාරට පියවර ආරම්භ කරනවා
        handleFlow(sentSearch.key.id, results);
        
        // 💡 මෙතනදී තමයි රහස තියෙන්නේ: 
        // ඔයා ආයෙත් සර්ච් ලිස්ට් එකටම 2 කියලා රිප්ලයි කළොත්, ඒකත් අරගෙන වැඩ කරන්න තවත් පාරක් handleFlow එකක් දාන්න පුළුවන්.
        handleFlow(sentSearch.key.id, results); 

    } catch (e) {
        console.log(e);
    }
});
