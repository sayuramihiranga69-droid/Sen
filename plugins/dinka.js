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

async function unshorten(url) {
    try {
        const response = await axios.head(url, { maxRedirects: 15, timeout: 10000 });
        return response.request.res.responseUrl || url;
    } catch (e) { return url; }
}

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
    desc: "Hybrid Movie Downloader",
    category: "downloader",
    react: "🎬",
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ කරුණාකර නමක් ලබාදෙන්න.");

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
                    let tempPath = path.join(process.cwd(), `${Date.now()}.mp4`);
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
                        let rawLink = await unshorten(chosen.direct_link);
                        const fileName = `${movieData.title.split('|')[0].trim()}.mp4`;

                        await conn.sendMessage(from, { react: { text: "📥", key: qSel.msg.key } });

                        // 🚀 ක්‍රමය 1: G-Drive නම් SriHub Bypass
                        if (rawLink.includes("drive.google.com")) {
                            const bypass = await axios.get(`${SRIHUB_BYPASS}?url=${encodeURIComponent(rawLink)}&apikey=${SRIHUB_KEY}`).catch(e => null);
                            if (bypass?.data?.success) {
                                return await conn.sendMessage(from, {
                                    document: { url: bypass.data.result.downloadUrl },
                                    fileName: fileName,
                                    mimetype: "video/mp4",
                                    caption: `✅ *Download Complete*\n🎬 *${movieData.title}*\n\n${DK_FOOTER}`
                                }, { quoted: qSel.msg });
                            }
                        }

                        // 🚀 ක්‍රමය 2: ඔයාගේ කෝඩ් එකේ විදිහට Direct URL එකෙන් යැවීමට උත්සාහ කිරීම
                        try {
                            await conn.sendMessage(from, {
                                document: { url: rawLink },
                                fileName: fileName,
                                mimetype: "video/mp4",
                                caption: `✅ *Direct Complete*\n🎬 *${movieData.title}*\n\n${DK_FOOTER}`
                            }, { quoted: qSel.msg });
                            console.log("[✅ DIRECT] Sent via URL");
                        } catch (err) {
                            // 🚀 ක්‍රමය 3: Direct URL එක වැඩ නැත්නම් සර්වර් එකට බාගෙන යැවීම
                            console.log("[📂 TEMP] Direct failed, downloading to server...");
                            const response = await axios({ method: 'get', url: rawLink, responseType: 'stream', timeout: 0 });
                            await pipeline(response.data, fs.createWriteStream(tempPath));
                            
                            await conn.sendMessage(from, {
                                document: fs.readFileSync(tempPath),
                                fileName: fileName,
                                mimetype: "video/mp4",
                                caption: `✅ *Stable Complete*\n🎬 *${movieData.title}*\n\n${DK_FOOTER}`
                            }, { quoted: qSel.msg });

                            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                        }

                    } catch (err) { 
                        console.log(err);
                        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                    }
                })();
            }
        };
        startFlow();
    } catch (e) { console.log(e); }
});
