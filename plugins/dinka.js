const { cmd } = require("../command");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");

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
            if (msg.key.remoteJid === from && context?.stanzaId === targetId) {
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
    desc: "Dinka Temp Storage Downloader",
    category: "downloader",
    react: "🎬",
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ කරුණාකර නමක් ලබාදෙන්න.");
        console.log(`\n[🔍 SEARCH] Query: ${q}`);

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

                (async () => {
                    try {
                        const item = results[parseInt(sel.text) - 1];
                        if (!item) return;

                        await conn.sendMessage(from, { react: { text: "⏳", key: sel.msg.key } });

                        const detRes = await axios.get(`${DK_HANDLER}?action=movie&url=${encodeURIComponent(item.link)}`).catch(e => null);
                        if (!detRes || !detRes.data?.data?.download_links) return;

                        const movieData = detRes.data.data;
                        let qText = `🎬 *${movieData.title}*\n\n*Select Quality:*`;
                        movieData.download_links.forEach((dl, i) => { qText += `\n*${i + 1}.* ${dl.quality}`; });
                        
                        const sentQual = await conn.sendMessage(from, { image: { url: item.image }, caption: qText + `\n\nඅංකය Reply කරන්න.` }, { quoted: sel.msg });

                        const qSel = await waitForReply(conn, from, sender, sentQual.key.id);
                        if (!qSel) return;

                        const chosen = movieData.download_links[parseInt(qSel.text) - 1];
                        const rawLink = chosen.direct_link;

                        await conn.sendMessage(from, { react: { text: "📥", key: qSel.msg.key } });

                        const isGdrive = rawLink.includes("drive.google.com") || rawLink.includes("docs.google.com");

                        if (isGdrive) {
                            // G-Drive නම් කලින් වගේම SriHub යවනවා (ඒක ලේසියි)
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
                            }
                        } else {
                            // 📂 Direct Link (Raani): Temp Save ලොජික් එක
                            console.log(`[📂 TEMP] Downloading to local storage...`);
                            const tempPath = path.join(__dirname, `../${Date.now()}.mp4`);
                            
                            const response = await axios({
                                method: 'get',
                                url: rawLink,
                                responseType: 'stream'
                            });

                            // Stream එක හරහා ෆයිල් එක Hard Disk එකට ලියනවා
                            await pipeline(response.data, fs.createWriteStream(tempPath));
                            console.log(`[✅ SAVED] Temp file ready. Uploading to WhatsApp...`);

                            await conn.sendMessage(from, {
                                document: fs.readFileSync(tempPath),
                                fileName: `${movieData.title.split('|')[0].trim()}.mp4`,
                                mimetype: "video/mp4",
                                caption: `✅ *Temp Upload Complete*\n🎬 *${movieData.title}*\n💎 *Quality:* ${chosen.quality}\n\n${DK_FOOTER}`
                            }, { quoted: qSel.msg });

                            // අප්ලෝඩ් එකෙන් පස්සේ Temp ෆයිල් එක Delete කරනවා
                            fs.unlinkSync(tempPath);
                            console.log(`[🗑️ CLEAN] Temp file deleted.`);
                        }
                    } catch (err) { 
                        console.log(`[⚠️ ERROR] ${err.message}`);
                        reply("❌ ඩවුන්ලෝඩ් කිරීමේ දෝෂයක්. නැවත උත්සාහ කරන්න.");
                    }
                })();
            }
        };
        startFlow();
    } catch (e) { console.log(e); }
});
