const { cmd } = require("../command");
const axios = require("axios");

const AC2_FOOTER = "✫☘ 𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄 ☢️☘";
const API_BASE = "https://sl-anime1.vercel.app/api/handler";
const SRIHUB_BYPASS_API = "https://api.srihub.store/download/gdrive";
const SRIHUB_KEY = "dew_5H5Dbuh4v7NbkNRmI0Ns2u2ZK240aNnJ9lnYQXR9";

// ───────── Ultra Smart Waiter ─────────
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
        setTimeout(() => { conn.ev.off("messages.upsert", handler); resolve(null); }, 300000); 
    });
}

cmd({
    pattern: "anime",
    alias: ["ac2", "movie"],
    desc: "Ultimate Multi-Reply Downloader with Logs",
    category: "downloader",
    react: "⛩️",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ කරුණාකර නමක් සඳහන් කරන්න.");

        console.log(`[SEARCH] Query: ${q}`); // ලොග් සටහන
        const searchRes = await axios.get(`${API_BASE}?action=search&query=${encodeURIComponent(q)}`);
        const results = searchRes.data?.data;

        if (!results?.length) {
            console.log(`[SEARCH] No results found for: ${q}`);
            return reply("❌ කිසිවක් හමු නොවීය.");
        }

        console.log(`[SEARCH] Found ${results.length} results.`);

        let listText = "⛩️ *𝐀𝐍𝐈𝐌𝐄𝐂𝐋𝐔𝐁𝟐 𝐒𝐄𝐀𝐑𝐂𝐇*\n\n";
        results.slice(0, 10).forEach((v, i) => { listText += `*${i + 1}.* ${v.title}\n`; });
        const sentSearch = await conn.sendMessage(from, { text: listText + `\nඅංකය Reply කරන්න.` }, { quoted: m });

        const startSearchFlow = async () => {
            while (true) {
                const animeSelection = await waitForReply(conn, from, sender, sentSearch.key.id);
                if (!animeSelection) break;

                (async () => {
                    const idx = parseInt(animeSelection.text) - 1;
                    const selected = results[idx];
                    if (!selected) return;

                    console.log(`[SELECTED] Anime: ${selected.title}`);
                    await conn.sendMessage(from, { react: { text: "⏳", key: animeSelection.msg.key } });
                    
                    const detRes = await axios.get(`${API_BASE}?action=details&url=${encodeURIComponent(selected.link)}`);
                    const details = detRes.data?.data;
                    console.log(`[DETAILS] Fetched details for: ${details.title}`);

                    if (details.episodes && details.episodes.length > 0) {
                        console.log(`[EPISODES] Found ${details.episodes.length} episodes.`);
                        let epText = `📺 *${details.title}*\n\n*Select Episode:*`;
                        details.episodes.forEach((ep, i) => { epText += `\n*${i + 1}.* Episode ${ep.ep_num}`; });
                        const sentEp = await conn.sendMessage(from, { image: { url: details.image }, caption: epText + `\n\nඑපිසෝඩ් අංකය එවන්න.` }, { quoted: animeSelection.msg });

                        const startEpFlow = async () => {
                            while (true) {
                                const epSel = await waitForReply(conn, from, sender, sentEp.key.id);
                                if (!epSel) break;

                                (async () => {
                                    const epIdx = parseInt(epSel.text) - 1;
                                    const chosenEp = details.episodes[epIdx];
                                    if (!chosenEp) return;
                                    console.log(`[SELECTED] Episode: ${chosenEp.ep_num}`);
                                    await handleDownload(conn, from, sender, chosenEp.link, details.title, epSel.msg);
                                })();
                            }
                        };
                        startEpFlow();
                    } else {
                        console.log(`[MOVIE] No episodes found, treating as a movie.`);
                        await handleDownload(conn, from, sender, selected.link, details.title, animeSelection.msg);
                    }
                })();
            }
        };

        async function handleDownload(conn, from, sender, url, title, quotedMsg) {
            try {
                console.log(`[DOWNLOAD] Fetching qualities for URL: ${url}`);
                const dlRes = await axios.get(`${API_BASE}?action=download&url=${encodeURIComponent(url)}`);
                const dlLinks = dlRes.data?.download_links;

                if (!dlLinks) {
                    console.log(`[DOWNLOAD] No download links found.`);
                    return;
                }

                let qText = `🎬 *Select Quality:*\n*${title}*`;
                dlLinks.forEach((dl, i) => { qText += `\n*${i + 1}.* ${dl.quality}`; });
                const sentQual = await conn.sendMessage(from, { text: qText + `\n\nQuality අංකය එවන්න.` }, { quoted: quotedMsg });

                const qSel = await waitForReply(conn, from, sender, sentQual.key.id);
                if (!qSel) return;

                const chosen = dlLinks[parseInt(qSel.text) - 1];
                console.log(`[QUALITY] Selected Quality: ${chosen.quality}`);
                console.log(`[BYPASS] Requesting SRIHUB for: ${chosen.direct_link}`);

                await conn.sendMessage(from, { react: { text: "📥", key: qSel.msg.key } });

                const bypass = await axios.get(`${SRIHUB_BYPASS_API}?url=${encodeURIComponent(chosen.direct_link)}&apikey=${SRIHUB_KEY}`);
                
                if (bypass.data?.success) {
                    const file = bypass.data.result;
                    console.log(`[SUCCESS] Sending file: ${file.fileName}`);
                    await conn.sendMessage(from, {
                        document: { url: file.downloadUrl },
                        fileName: file.fileName,
                        mimetype: file.mimetype,
                        caption: `✅ *Download Complete*\n🎬 *${title}*\n💎 *Quality:* ${chosen.quality}\n\n${AC2_FOOTER}`
                    }, { quoted: qSel.msg });
                } else {
                    console.log(`[ERROR] SRIHUB Bypass failed: ${JSON.stringify(bypass.data)}`);
                }
            } catch (e) { 
                console.log(`[ERROR] Download function error: ${e.message}`); 
            }
        }

        startSearchFlow();

    } catch (e) {
        console.log(`[GLOBAL ERROR] ${e.message}`);
        console.log(e.stack); // සම්පූර්ණ දෝෂ විස්තරය
    }
});
