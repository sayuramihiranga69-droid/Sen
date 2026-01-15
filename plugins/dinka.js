const { cmd } = require("../command");
const axios = require("axios");

const DK_FOOTER = "✫☘ 𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄 ☢️☘";
const DK_BASE = "https://dinka-mu.vercel.app";
const DK_HANDLER = "https://dinka-mu.vercel.app/api/handler";
const SRIHUB_BYPASS = "https://api.srihub.store/download/gdrive";
const SRIHUB_KEY = "dew_YyT0KDc2boHDasFlmZCqDcPoeDHReD20aYmEsm1G";

// 🏷️ සර්වර් එකෙන් Original File Name එක ලබා ගන්නා Function එක
async function getFileInfo(url) {
    try {
        console.log(`[🔍 LOG] Headers පරීක්ෂා කරමින්: ${url}`);
        const response = await axios.head(url, { 
            maxRedirects: 15, 
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        const finalUrl = response.request.res.responseUrl || url;
        let fileName = "Gojo-MD-Movie.mp4";

        if (response.headers['content-disposition']) {
            const disposition = response.headers['content-disposition'];
            const match = disposition.match(/filename=(?:["']([^"']+)["']|([^;]+))/);
            if (match) fileName = match[1] || match[2];
        } else {
            fileName = new URL(finalUrl).pathname.split('/').pop();
        }
        
        const decodedName = decodeURIComponent(fileName).replace(/\+/g, ' ');
        console.log(`[🏷️ LOG] හමුවූ නම: ${decodedName}`);
        return { name: decodedName, url: finalUrl };
    } catch (e) {
        console.log(`[⚠️ LOG] Header Error: ${e.message}`);
        return { name: "Movie.mp4", url: url };
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
    desc: "Fully Automated Hybrid Downloader with Live Console",
    category: "downloader",
    react: "🎬",
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ කරුණාකර නමක් ලබාදෙන්න.");
        console.log(`[🚀 SEARCH] සොයන්නේ: ${q}`);

        const searchRes = await axios.get(`${DK_BASE}/?action=search&query=${encodeURIComponent(q)}`).catch(e => null);
        if (!searchRes || !searchRes.data?.data?.length) {
            console.log(`[❌ LOG] මුකුත් හමුවුණේ නැහැ: ${q}`);
            return reply("❌ කිසිවක් හමු නොවීය.");
        }

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
                        console.log(`[🎯 LOG] තෝරාගත් චිත්‍රපටය: ${item.title}`);

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
                        console.log(`[💎 LOG] තෝරාගත් Quality එක: ${chosen.quality}`);
                        await conn.sendMessage(from, { react: { text: "📥", key: qSel.msg.key } });

                        const fileInfo = await getFileInfo(chosen.direct_link);
                        const isGdrive = fileInfo.url.includes("drive.google.com") || fileInfo.url.includes("docs.google.com");

                        if (isGdrive) {
                            console.log(`[🌐 LOG] G-Drive හමුවුණා. SriHub හරහා යවමින්...`);
                            const bypass = await axios.get(`${SRIHUB_BYPASS}?url=${encodeURIComponent(fileInfo.url)}&apikey=${SRIHUB_KEY}`).catch(e => null);
                            if (bypass?.data?.success) {
                                await conn.sendMessage(from, {
                                    document: { url: bypass.data.result.downloadUrl },
                                    fileName: bypass.data.result.fileName,
                                    mimetype: "video/mp4",
                                    caption: `✅ *Drive Uploaded*\n🎬 *${movieData.title}*\n\n${DK_FOOTER}`
                                }, { quoted: qSel.msg });
                                console.log(`[✅ LOG] G-Drive Upload සාර්ථකයි!`);
                            }
                        } else {
                            console.log(`[🔗 LOG] Direct Link එකක්. WhatsApp එකට Direct යවමින්...`);
                            await conn.sendMessage(from, {
                                document: { url: fileInfo.url },
                                fileName: fileInfo.name,
                                mimetype: "video/mp4",
                                caption: `✅ *Direct Uploaded*\n🎬 *${movieData.title}*\n\n${DK_FOOTER}`
                            }, { quoted: qSel.msg });
                            console.log(`[✅ LOG] Direct Upload සාර්ථකයි!`);
                        }

                    } catch (err) { 
                        console.log(`[❗ ERROR] ${err.message}`);
                    }
                })();
            }
        };
        startFlow();
    } catch (e) { console.log(e); }
});
