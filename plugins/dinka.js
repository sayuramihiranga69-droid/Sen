const { cmd } = require("../command");
const axios = require("axios");

const DK_FOOTER = "✫☘ 𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄 ☢️☘";
const DK_BASE = "https://dinka-mu.vercel.app";
const DK_HANDLER = "https://dinka-mu.vercel.app/api/handler";
const SRIHUB_BYPASS = "https://api.srihub.store/download/gdrive";
const SRIHUB_KEY = "dew_YyT0KDc2boHDasFlmZCqDcPoeDHReD20aYmEsm1G";

// ───────── Multi-Tasking Waiter ─────────
function waitForReply(conn, from, sender, targetId) {
    return new Promise((resolve) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;
            const context = msg.message?.extendedTextMessage?.contextInfo;
            const msgSender = msg.key.participant || msg.key.remoteJid;
            
            // Context Check: රිප්ලයි කළ මැසේජ් එකේ ID එක හරියටම මැච් කරනවා
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
        setTimeout(() => { conn.ev.off("messages.upsert", handler); }, 300000); // 5 Mins Timeout
    });
}

cmd({
    pattern: "dinka",
    alias: ["dk", "movie"],
    desc: "Smart Link Routing Downloader with Live Support",
    category: "downloader",
    react: "🎬",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ කරුණාකර නමක් ලබාදෙන්න. (උදා: .dk Raani)");

        console.log(`\n[🔍 SEARCH] User: ${sender} | Query: ${q}`);

        // 1. සර්ච් කිරීම (Dinka API Root)
        const searchRes = await axios.get(`${DK_BASE}/?action=search&query=${encodeURIComponent(q)}`);
        const results = searchRes.data?.data;
        if (!results?.length) {
            console.log(`[❌ EMPTY] No results found for: ${q}`);
            return reply("❌ කිසිවක් හමු නොවීය.");
        }

        console.log(`[✅ FOUND] ${results.length} results found for "${q}"`);

        let listText = "🔥 *𝐒𝐀𝐘𝐔𝐑𝐀 𝐒𝐄𝐀𝐑𝐂𝐇*\n\n";
        results.slice(0, 10).forEach((v, i) => { listText += `*${i + 1}.* ${v.title}\n`; });
        const sentSearch = await conn.sendMessage(from, { text: listText + `\nඅංකය Reply කරන්න.` }, { quoted: m });

        // Multi-Flow Loop (කිහිපයක් එකපාර තේරිය හැක)
        const startFlow = async () => {
            while (true) {
                const sel = await waitForReply(conn, from, sender, sentSearch.key.id);
                if (!sel) break;

                (async () => {
                    try {
                        const item = results[parseInt(sel.text) - 1];
                        if (!item) return;

                        console.log(`[🎯 SELECTED] Movie: ${item.title}`);
                        await conn.sendMessage(from, { react: { text: "⏳", key: sel.msg.key } });

                        // 2. දත්ත සහ ලින්ක් ලබාගැනීම
                        const detRes = await axios.get(`${DK_HANDLER}?action=movie&url=${encodeURIComponent(item.link)}`);
                        const movieData = detRes.data?.data;
                        if (!movieData?.download_links) {
                            console.log(`[❌ FAIL] No links for: ${item.title}`);
                            return reply("❌ දත්ත ලබාගැනීම අසාර්ථකයි.");
                        }

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

                        // 🧠 SMART ROUTING LOGIC
                        // Google Drive ලින්ක් එකක්ද කියලා බලනවා (da.gd වැනි ඒවා Direct ලෙස සලකයි)
                        const isGdrive = rawLink.includes("drive.google.com") || rawLink.includes("docs.google.com") || rawLink.includes("uc?id=");

                        if (isGdrive) {
                            console.log(`[🚀 MODE] G-Drive Link detected. Sending to SriHub...`);
                            try {
                                const bypass = await axios.get(`${SRIHUB_BYPASS}?url=${encodeURIComponent(rawLink)}&apikey=${SRIHUB_KEY}`);
                                if (bypass.data?.success) {
                                    const file = bypass.data.result;
                                    console.log(`[✅ BYPASS DONE] File: ${file.fileName} (${file.fileSize})`);
                                    await conn.sendMessage(from, {
                                        document: { url: file.downloadUrl },
                                        fileName: file.fileName,
                                        mimetype: file.mimetype,
                                        caption: `✅ *Download Complete*\n🎬 *${movieData.title}*\n💎 *Quality:* ${chosen.quality}\n⚖️ *Size:* ${file.fileSize}\n\n${DK_FOOTER}`
                                    }, { quoted: qSel.msg });
                                } else {
                                    throw new Error("Bypass Error");
                                }
                            } catch (err) {
                                console.log(`[⚠️ BYPASS FAIL] Fallback to direct upload for G-Drive link.`);
                                await conn.sendMessage(from, {
                                    document: { url: rawLink },
                                    fileName: `${movieData.title}.mp4`,
                                    mimetype: "video/mp4",
                                    caption: `✅ *Download Complete*\n🎬 *${movieData.title}*\n💎 *Quality:* ${chosen.quality}\n\n${DK_FOOTER}`
                                }, { quoted: qSel.msg });
                            }
                        } else {
                            // 🚀 Raani (da.gd) වැනි Direct ලින්ක් මෙතනින් කෙලින්ම අප්ලෝඩ් වෙයි
                            console.log(`[🚀 MODE] Direct Link detected. Uploading directly...`);
                            await conn.sendMessage(from, {
                                document: { url: rawLink },
                                fileName: `${movieData.title}.mp4`,
                                mimetype: "video/mp4",
                                caption: `✅ *Download Complete*\n🎬 *${movieData.title}*\n💎 *Quality:* ${chosen.quality}\n\n${DK_FOOTER}`
                            }, { quoted: qSel.msg });
                            console.log(`[✅ DIRECT DONE] Upload started for: ${movieData.title}`);
                        }

                    } catch (err) { 
                        console.log(`[⚠️ ERROR] ${err.message}`);
                    }
                })();
            }
        };

        startFlow();
    } catch (e) { 
        console.log(`[⚠️ CRITICAL] ${e.message}`);
    }
});
