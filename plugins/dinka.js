const { cmd } = require("../command");
const axios = require("axios");

const DK_FOOTER = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄☢️☘";
const DK_BASE = "https://dinka-mu.vercel.app"; // Base URL එක
const DK_HANDLER = "https://dinka-mu.vercel.app/api/handler"; // Details ගන්න තැන
const SRIHUB_BYPASS = "https://api.srihub.store/download/gdrive";
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
            
            if (msg.key.remoteJid === from && 
                (msgSender.includes(sender.split('@')[0]) || msgSender.includes("@lid")) && 
                context?.stanzaId === targetId && !isNaN(text)) {
                conn.ev.off("messages.upsert", handler);
                resolve({ msg, text: text.trim() });
            }
        };
        conn.ev.on("messages.upsert", handler);
        setTimeout(() => { conn.ev.off("messages.upsert", handler); }, 300000); 
    });
}

cmd({
    pattern: "dinka",
    alias: ["dk", "movie", "raani"],
    desc: "Dinka Movies & Anime Downloader",
    category: "downloader",
    react: "🎬",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ කරුණාකර නමක් ලබාදෙන්න. (උදා: .dk Raani)");

        // 1. Search - URL: dinka-mu.vercel.app/?action=search
        const searchRes = await axios.get(`${DK_BASE}/?action=search&query=${encodeURIComponent(q)}`);
        const results = searchRes.data?.data;
        if (!results?.length) return reply("❌ කිසිවක් හමු නොවීය.");

        let listText = "🔥 *𝐃𝐈𝐍𝐊𝐀 𝐒𝐄𝐀𝐑𝐂𝐇 𝐑𝐄𝐒𝐔𝐋𝐓𝐒*\n\n";
        results.slice(0, 10).forEach((v, i) => { listText += `*${i + 1}.* ${v.title}\n`; });
        const sentSearch = await conn.sendMessage(from, { text: listText + `\nඅංකය Reply කරන්න.` }, { quoted: m });

        // Multi-Flow Loop
        const startFlow = async () => {
            while (true) {
                const sel = await waitForReply(conn, from, sender, sentSearch.key.id);
                if (!sel) break;

                (async () => {
                    try {
                        const item = results[parseInt(sel.text) - 1];
                        if (!item) return;

                        await conn.sendMessage(from, { react: { text: "⏳", key: sel.msg.key } });

                        // 2. Get Details & Links - URL: dinka-mu.vercel.app/api/handler?action=movie
                        const detRes = await axios.get(`${DK_HANDLER}?action=movie&url=${encodeURIComponent(item.link)}`);
                        const movieData = detRes.data?.data;
                        
                        if (!movieData || !movieData.download_links) return reply("❌ දත්ත ලබාගැනීම අසාර්ථකයි.");

                        // 🎬 Quality Selection පෙන්වීම
                        let qText = `🎬 *${movieData.title}*\n\n*Select Quality:*`;
                        movieData.download_links.forEach((dl, i) => { 
                            qText += `\n*${i + 1}.* ${dl.quality}`; 
                        });
                        
                        const sentQual = await conn.sendMessage(from, { 
                            image: { url: item.image },
                            caption: qText + `\n\nඅංකය Reply කරන්න.` 
                        }, { quoted: sel.msg });

                        const qSel = await waitForReply(conn, from, sender, sentQual.key.id);
                        if (!qSel) return;

                        const chosen = movieData.download_links[parseInt(qSel.text) - 1];
                        await conn.sendMessage(from, { react: { text: "📥", key: qSel.msg.key } });

                        // 3. Bypass & Send File
                        const bypass = await axios.get(`${SRIHUB_BYPASS}?url=${encodeURIComponent(chosen.direct_link)}&apikey=${SRIHUB_KEY}`);
                        
                        if (bypass.data?.success) {
                            const file = bypass.data.result;
                            await conn.sendMessage(from, {
                                document: { url: file.downloadUrl },
                                fileName: file.fileName,
                                mimetype: file.mimetype,
                                caption: `✅ *Download Complete*\n🎬 *${movieData.title}*\n💎 *Quality:* ${chosen.quality}\n\n${DK_FOOTER}`
                            }, { quoted: qSel.msg });
                        } else {
                            // Bypass නොවෙන ලින්ක් එකක් නම් කෙලින්ම එවන්න උත්සාහ කරයි
                            await conn.sendMessage(from, {
                                document: { url: chosen.direct_link },
                                fileName: `${movieData.title}.mp4`,
                                mimetype: "video/mp4",
                                caption: `✅ *Download Link Ready*\n🎬 *${movieData.title}*\n\n${DK_FOOTER}`
                            }, { quoted: qSel.msg });
                        }
                    } catch (err) { console.log(err); }
                })();
            }
        };

        startFlow();
    } catch (e) {
        console.log(e);
        reply("⚠️ දෝෂයක් සිදු විය.");
    }
});
