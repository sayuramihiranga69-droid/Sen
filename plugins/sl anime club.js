const { cmd } = require("../command");
const axios = require("axios");

const AC2_FOOTER = "✫☘ 𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄 ☢️☘";
const API_BASE = "https://sl-anime1.vercel.app/api/handler";
const SRIHUB_BYPASS_API = "https://api.srihub.store/download/gdrive";
const SRIHUB_KEY = "dew_YyT0KDc2boHDasFlmZCqDcPoeDHReD20aYmEsm1G";

// ───────── Multi-Tasking Waiter ─────────
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
        setTimeout(() => { conn.ev.off("messages.upsert", handler); }, 180000); 
    });
}

cmd({
    pattern: "anime",
    alias: ["ac2", "movie"],
    desc: "Series & Movie Supported Multi-Tasking",
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
        const sentSearch = await conn.sendMessage(from, { text: listText + `\nඅදාළ අංක Reply කරන්න.` }, { quoted: m });

        // 🔄 Recursive Flow for Handling Multiple Selections
        const startFlow = async () => {
            while (true) {
                const selection = await waitForReply(conn, from, sender, sentSearch.key.id);
                if (!selection) break;

                (async () => {
                    try {
                        const idx = parseInt(selection.text) - 1;
                        const selected = results[idx];
                        if (!selected) return;

                        await conn.sendMessage(from, { react: { text: "⏳", key: selection.msg.key } });

                        // 1. Fetch Details (Check for Episodes)
                        const detRes = await axios.get(`${API_BASE}?action=details&url=${encodeURIComponent(selected.link)}`);
                        const details = detRes.data?.data;
                        let finalUrl = selected.link;

                        // 📺 Series එකක් නම් Episode List එක පෙන්නනවා
                        if (details.episodes && details.episodes.length > 0) {
                            let epText = `📺 *${details.title}*\n\n*Select Episode:*`;
                            details.episodes.forEach((ep, i) => { epText += `\n*${i + 1}.* Episode ${ep.ep_num}`; });
                            
                            const sentEp = await conn.sendMessage(from, { 
                                image: { url: details.image }, 
                                caption: epText + `\n\nඑපිසෝඩ් අංකය එවන්න.` 
                            }, { quoted: selection.msg });

                            const epSelection = await waitForReply(conn, from, sender, sentEp.key.id);
                            if (!epSelection) return;
                            finalUrl = details.episodes[parseInt(epSelection.text) - 1].link;
                        }

                        // 🎬 2. Fetch Qualities
                        const dlRes = await axios.get(`${API_BASE}?action=download&url=${encodeURIComponent(finalUrl)}`);
                        const dlLinks = dlRes.data?.download_links;

                        let qText = `🎬 *Select Quality:* \n*${details.title}*`;
                        dlLinks.forEach((dl, i) => { qText += `\n*${i + 1}.* ${dl.quality}`; });
                        
                        const sentQual = await conn.sendMessage(from, { text: qText + `\n\nQuality අංකය එවන්න.` }, { quoted: selection.msg });

                        const qSel = await waitForReply(conn, from, sender, sentQual.key.id);
                        if (!qSel) return;

                        const chosen = dlLinks[parseInt(qSel.text) - 1];
                        await conn.sendMessage(from, { react: { text: "📥", key: qSel.msg.key } });

                        // 3. Bypass & Upload
                        const bypass = await axios.get(`${SRIHUB_BYPASS_API}?url=${encodeURIComponent(chosen.direct_link)}&apikey=${SRIHUB_KEY}`);
                        if (bypass.data?.success) {
                            const file = bypass.data.result;
                            await conn.sendMessage(from, {
                                document: { url: file.downloadUrl },
                                fileName: file.fileName,
                                mimetype: file.mimetype,
                                caption: `✅ *Download Complete*\n🎬 *${details.title}*\n💎 *Quality:* ${chosen.quality}\n\n${AC2_FOOTER}`
                            }, { quoted: qSel.msg });
                        }
                    } catch (err) { console.log(err); }
                })();
            }
        };

        startFlow();

    } catch (e) {
        console.log(e);
    }
});
