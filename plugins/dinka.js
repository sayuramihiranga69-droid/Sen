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

// 🔗 Unshortener Function - කෙටි කරපු ලින්ක් එකේ නියම මුහුණුවර සොයයි
async function unshorten(url) {
    try {
        const response = await axios.head(url, { maxRedirects: 10 });
        return response.request.res.responseUrl || url;
    } catch (e) {
        return url; // මොකක් හරි අවුලක් වුණොත් මුල් ලින්ක් එකම දෙනවා
    }
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
    desc: "Unshortener + Stable Downloader",
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
                    let tempPath = path.join(__dirname, `../${Date.now()}.mp4`);
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
                        let rawLink = chosen.direct_link;

                        await conn.sendMessage(from, { react: { text: "📥", key: qSel.msg.key } });

                        // 🔍 ලින්ක් එක Unshorten කිරීම (cutt.ly -> drive.google.com)
                        console.log(`[🔗 RAW] ${rawLink}`);
                        rawLink = await unshorten(rawLink);
                        console.log(`[🔓 UNSHORTENED] ${rawLink}`);

                        const isGdrive = rawLink.includes("drive.google.com") || rawLink.includes("docs.google.com");

                        if (isGdrive) {
                            console.log(`[🚀 MODE] G-Drive Bypass`);
                            const bypass = await axios.get(`${SRIHUB_BYPASS}?url=${encodeURIComponent(rawLink)}&apikey=${SRIHUB_KEY}`);
                            if (bypass?.data?.success) {
                                await conn.sendMessage(from, {
                                    document: { url: bypass.data.result.downloadUrl },
                                    fileName: bypass.data.result.fileName,
                                    mimetype: bypass.data.result.mimetype,
                                    caption: `✅ *Download Complete*\n🎬 *${movieData.title}*\n\n${DK_FOOTER}`
                                }, { quoted: qSel.msg });
                            }
                        } else {
                            // 📂 Direct Link - Temp Save Upload
                            console.log(`[📂 TEMP] Streaming to disk...`);
                            const response = await axios({ method: 'get', url: rawLink, responseType: 'stream', timeout: 0 });
                            await pipeline(response.data, fs.createWriteStream(tempPath));

                            await conn.sendMessage(from, {
                                document: fs.createReadStream(tempPath),
                                fileName: `${movieData.title.split('|')[0].trim()}.mp4`,
                                mimetype: "video/mp4",
                                caption: `✅ *Upload Complete*\n🎬 *${movieData.title}*\n\n${DK_FOOTER}`
                            }, { quoted: qSel.msg });

                            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                        }
                    } catch (err) { 
                        console.log(`[⚠️ ERROR] ${err.message}`);
                        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                    }
                })();
            }
        };
        startFlow();
    } catch (e) { console.log(e); }
});
