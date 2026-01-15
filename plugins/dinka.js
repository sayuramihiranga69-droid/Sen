const { cmd } = require("../command");
const axios = require("axios");

const DK_FOOTER = "✫☘ 𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄 ☢️☘";
const DK_BASE = "https://dinka-mu.vercel.app";
const DK_HANDLER = "https://dinka-mu.vercel.app/api/handler";
const SRIHUB_BYPASS = "https://api.srihub.store/download/gdrive";
const SRIHUB_KEY = "dew_YyT0KDc2boHDasFlmZCqDcPoeDHReD20aYmEsm1G";

// 🏷️ Original File Name එක සහ Redirected Link එක හොයාගන්නා Function එක
async function getFileInfo(url) {
    try {
        const response = await axios.head(url, { 
            maxRedirects: 15, 
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        const finalUrl = response.request.res.responseUrl || url;
        let fileName = "Gojo-MD-Movie.mp4";

        // Headers වලින් නියම නම බැලීම
        if (response.headers['content-disposition']) {
            const disposition = response.headers['content-disposition'];
            const match = disposition.match(/filename=(?:["']([^"']+)["']|([^;]+))/);
            if (match) fileName = match[1] || match[2];
        } else {
            fileName = new URL(finalUrl).pathname.split('/').pop();
        }
        
        return { 
            name: decodeURIComponent(fileName).replace(/\+/g, ' '), 
            url: finalUrl 
        };
    } catch (e) {
        return { name: "Movie.mp4", url: url };
    }
}

// ⏳ Reply එක එනකම් බලා ඉන්නා Function එක
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
    desc: "Fully Automated Movie Downloader",
    category: "downloader",
    react: "🎬",
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ කරුණාකර නමක් ලබාදෙන්න.");

        // 🔍 Search කිරීම
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

                        // 🎥 Movie Details & Links ගැනීම
                        const detRes = await axios.get(`${DK_HANDLER}?action=movie&url=${encodeURIComponent(item.link)}`).catch(e => null);
                        if (!detRes || !detRes.data?.data?.download_links) return;

                        const movieData = detRes.data.data;
                        let qText = `🎬 *${movieData.title}*\n\n*Select Quality:*`;
                        movieData.download_links.forEach((dl, i) => { qText += `\n*${i + 1}.* ${dl.quality}`; });
                        
                        const sentQual = await conn.sendMessage(from, { image: { url: item.image }, caption: qText + `\n\nඅංකය Reply කරන්න.` }, { quoted: sel.msg });

                        const qSel = await waitForReply(conn, from, sender, sentQual.key.id);
                        if (!qSel) return;

                        const chosen = movieData.download_links[parseInt(qSel.text) - 1];
                        await conn.sendMessage(from, { react: { text: "📥", key: qSel.msg.key } });

                        // 🔄 ලින්ක් එක පරීක්ෂා කර Original Name එක ලබා ගැනීම
                        const fileInfo = await getFileInfo(chosen.direct_link);
                        const isGdrive = fileInfo.url.includes("drive.google.com") || fileInfo.url.includes("docs.google.com");

                        if (isGdrive) {
                            // 🚀 Google Drive නම් SriHub හරහා Auto-Upload
                            const bypass = await axios.get(`${SRIHUB_BYPASS}?url=${encodeURIComponent(fileInfo.url)}&apikey=${SRIHUB_KEY}`).catch(e => null);
                            if (bypass?.data?.success) {
                                await conn.sendMessage(from, {
                                    document: { url: bypass.data.result.downloadUrl },
                                    fileName: bypass.data.result.fileName,
                                    mimetype: "video/mp4",
                                    caption: `✅ *Drive Uploaded*\n🎬 *${movieData.title}*\n\n${DK_FOOTER}`
                                }, { quoted: qSel.msg });
                            }
                        } else {
                            // 🚀 වෙනත් ලින්ක් නම් ඔයාගේ Screenshot එකේ තිබුණ විදිහටම Auto-Download
                            await conn.sendMessage(from, {
                                document: { url: fileInfo.url },
                                fileName: fileInfo.name,
                                mimetype: "video/mp4",
                                caption: `✅ *Direct Uploaded*\n🎬 *${movieData.title}*\n\n${DK_FOOTER}`
                            }, { quoted: qSel.msg });
                        }

                    } catch (err) { 
                        console.log(err);
                    }
                })();
            }
        };
        startFlow();
    } catch (e) { console.log(e); }
});
