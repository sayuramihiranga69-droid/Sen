const { cmd } = require("../command");
const axios = require("axios");

const DK_FOOTER = "✫☘ 𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄 ☢️☘";
const DK_BASE = "https://dinka-mu.vercel.app";
const DK_HANDLER = "https://dinka-mu.vercel.app/api/handler";
const SRIHUB_BYPASS = "https://api.srihub.store/download/gdrive";
const SRIHUB_KEY = "dew_YyT0KDc2boHDasFlmZCqDcPoeDHReD20aYmEsm1G";

function waitForReply(conn, from, sender, targetId) {
    return new Promise((resolve) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;
            const context = msg.message?.extendedTextMessage?.contextInfo;
            const msgSender = msg.key.participant || msg.key.remoteJid;
            const isTargetReply = context?.stanzaId === targetId;
            const isCorrectUser = msgSender.includes(sender.split('@')[0]) || msgSender.includes("@lid");

            if (msg.key.remoteJid === from && isCorrectUser && isTargetReply) {
                const text = (msg.message.conversation || msg.message?.extendedTextMessage?.text || "").trim();
                if (!isNaN(text)) {
                    conn.ev.off("messages.upsert", handler);
                    resolve({ msg, text });
                }
            }
        };
        conn.ev.on("messages.upsert", handler);
        setTimeout(() => { conn.ev.off("messages.upsert", handler); resolve(null); }, 300000); 
    });
}

cmd({
    pattern: "dinka",
    alias: ["dk", "movie"],
    desc: "Dinka Stable Downloader",
    category: "downloader",
    react: "🎬",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ කරුණාකර නමක් ලබාදෙන්න.");
        console.log(`\n[🔍 SEARCH] User: ${sender} | Query: ${q}`);

        const searchRes = await axios.get(`${DK_BASE}/?action=search&query=${encodeURIComponent(q)}`).catch(e => null);
        if (!searchRes || !searchRes.data?.data?.length) return reply("❌ කිසිවක් හමු නොවීය.");

        const results = searchRes.data.data;
        let listText = "🔥 *𝐒𝐀𝐘𝐔𝐑𝐀 𝐒𝐄𝐀𝐑𝐂𝐇*\n\n";
        results.slice(0, 10).forEach((v, i) => { listText += `*${i + 1}.* ${v.title}\n`; });
        const sentSearch = await conn.sendMessage(from, { text: listText + `\nඅංකය Reply කරන්න.` }, { quoted: m });

        const startFlow = async () => {
            while (true) {
                const sel = await waitForReply(conn, from, sender, sentSearch.key.id);
                if (!sel) break;

                // Process each request in a separate scope to prevent crashes
                processRequest(sel);
            }
        };

        const processRequest = async (sel) => {
            try {
                const item = results[parseInt(sel.text) - 1];
                if (!item) return;

                console.log(`[🎯 SELECTED] Movie: ${item.title}`);
                await conn.sendMessage(from, { react: { text: "⏳", key: sel.msg.key } });

                const detRes = await axios.get(`${DK_HANDLER}?action=movie&url=${encodeURIComponent(item.link)}`).catch(e => null);
                if (!detRes || !detRes.data?.data?.download_links) return;

                const movieData = detRes.data.data;
                let qText = `🎬 *${movieData.title}*\n\n*Select Quality:*`;
                movieData.download_links.forEach((dl, i) => { qText += `\n*${i + 1}.* ${dl.quality}`; });
                
                const sentQual = await conn.sendMessage(from, { 
                    image: { url: item.image },
                    caption: qText + `\n\nඅංකය Reply කරන්න.` 
                }, { quoted: sel.msg });

                const qSel = await waitForReply(conn, from, sender, sentQual.key.id);
                if (!qSel) return;

                const chosen = movieData.download_links[parseInt(qSel.text) - 1];
                const rawLink = chosen.direct_link;

                console.log(`[📥 START] Quality: ${chosen.quality} | Link: ${rawLink}`);
                await conn.sendMessage(from, { react: { text: "📥", key: qSel.msg.key } });

                const isGdrive = rawLink.includes("drive.google.com") || rawLink.includes("docs.google.com");

                if (isGdrive) {
                    console.log(`[🚀 MODE] G-Drive Link. Sending to SriHub...`);
                    const bypass = await axios.get(`${SRIHUB_BYPASS}?url=${encodeURIComponent(rawLink)}&apikey=${SRIHUB_KEY}`).catch(e => null);
                    if (bypass?.data?.success) {
                        const file = bypass.data.result;
                        await conn.sendMessage(from, {
                            document: { url: file.downloadUrl },
                            fileName: file.fileName,
                            mimetype: file.mimetype,
                            caption: `✅ *Download Complete*\n🎬 *${movieData.title}*\n💎 *Quality:* ${chosen.quality}\n\n${DK_FOOTER}`
                        }, { quoted: qSel.msg });
                    } else {
                        // Fallback to direct download link text if bypass fails
                        reply(`⚠️ SriHub Fail. Direct Link: ${rawLink}`);
                    }
                } else {
                    console.log(`[🚀 MODE] Direct Link Detected. Uploading...`);
                    await conn.sendMessage(from, {
                        document: { url: rawLink },
                        fileName: `${movieData.title.split('|')[0].trim()}.mp4`,
                        mimetype: "video/mp4",
                        caption: `✅ *Direct Download*\n🎬 *${movieData.title}*\n💎 *Quality:* ${chosen.quality}\n\n${DK_FOOTER}`
                    }, { quoted: qSel.msg });
                    console.log(`[✅ SUCCESS] Upload triggered.`);
                }
            } catch (err) {
                console.log(`[⚠️ ERROR] Request Process Failed: ${err.message}`);
            }
        };

        startFlow();
    } catch (e) {
        console.log(`[⚠️ CRITICAL ERROR] ${e.message}`);
    }
});
