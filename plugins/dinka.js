const { cmd } = require("../command");
const axios = require("axios");

const DK_FOOTER = "✫☘ 𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄 ☢️☘";
const DK_BASE = "https://dinka-mu.vercel.app";
const DK_HANDLER = "https://dinka-mu.vercel.app/api/handler";
const SRIHUB_BYPASS = "https://api.srihub.store/download/gdrive";
const SRIHUB_KEY = "dew_YyT0KDc2boHDasFlmZCqDcPoeDHReD20aYmEsm1G";

// 🔗 Unshortener: කෙටි ලින්ක් වල නියම ලින්ක් එක හොයන්න
async function unshorten(url) {
    try {
        const response = await axios.head(url, { maxRedirects: 15, timeout: 5000 });
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
    desc: "Drive File + Other Link Only Hybrid",
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
                    try {
                        const item = results[parseInt(sel.text) - 1];
                        if (!item) return;

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
                        await conn.sendMessage(from, { react: { text: "📥", key: qSel.msg.key } });

                        // 🔍 ලින්ක් එක පරීක්ෂාව
                        let rawLink = await unshorten(chosen.direct_link);
                        const isGdrive = rawLink.includes("drive.google.com") || 
                                         rawLink.includes("docs.google.com") || 
                                         rawLink.includes("drive.usercontent.google.com");

                        if (isGdrive) {
                            // 🚀 Google Drive නම් SriHub හරහා File එකම එවන්න
                            const bypass = await axios.get(`${SRIHUB_BYPASS}?url=${encodeURIComponent(rawLink)}&apikey=${SRIHUB_KEY}`).catch(e => null);
                            
                            if (bypass?.data?.success) {
                                const file = bypass.data.result;
                                return await conn.sendMessage(from, {
                                    document: { url: file.downloadUrl },
                                    fileName: file.fileName,
                                    mimetype: "video/mp4",
                                    caption: `✅ *Drive File Uploaded*\n🎬 *${movieData.title}*\n💎 *Quality:* ${chosen.quality}\n\n${DK_FOOTER}`
                                }, { quoted: qSel.msg });
                            }
                        }

                        // 🚀 වෙනත් ලින්ක් නම් ලින්ක් එක විතරක් මැසේජ් එකකින් එවන්න
                        let finalMsg = `✅ *DOWNLOAD LINK READY*\n\n`;
                        finalMsg += `🎬 *Movie:* ${movieData.title}\n`;
                        finalMsg += `🌟 *Quality:* ${chosen.quality}\n\n`;
                        finalMsg += `🔗 *Link:* ${rawLink}\n\n`;
                        finalMsg += `> මෙලෙස එවීමට හේතුව මෙය Google Drive ෆයිල් එකක් නොවීමයි.\n\n${DK_FOOTER}`;

                        await conn.sendMessage(from, { text: finalMsg }, { quoted: qSel.msg });

                    } catch (err) { 
                        console.log(err);
                    }
                })();
            }
        };
        startFlow();
    } catch (e) { console.log(e); }
});
