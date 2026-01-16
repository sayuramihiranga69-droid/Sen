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
        setTimeout(() => { conn.ev.off("messages.upsert", handler); }, 300000); // විනාඩි 5ක්
    });
}

cmd({
    pattern: "anime",
    alias: ["ac2", "movie"],
    desc: "Ultimate Multi-Reply Downloader",
    category: "downloader",
    react: "⛩️",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ කරුණාකර නමක් සඳහන් කරන්න.");

        const searchRes = await axios.get(`${API_BASE}?action=search&query=${encodeURIComponent(q)}`);
        const results = searchRes.data?.data;
        if (!results?.length) return reply("❌ කිසිවක් හමු නොවීය.");

        let listText = "⛩️ *𝐀𝐍𝐈𝐌𝐄𝐂𝐋𝐔𝐁𝟐 𝐒𝐄𝐀𝐑𝐂𝐇*\n\n";
        results.slice(0, 10).forEach((v, i) => { listText += `*${i + 1}.* ${v.title}\n`; });
        const sentSearch = await conn.sendMessage(from, { text: listText + `\nඅංකය Reply කරන්න. (කිහිපයක් වුවද තේරිය හැක)` }, { quoted: m });

        // --- ස්වාධීන ඇනිමේ පාලනය (Search List) ---
        const startSearchFlow = async () => {
            while (true) {
                const animeSelection = await waitForReply(conn, from, sender, sentSearch.key.id);
                if (!animeSelection) break;

                // ඇනිමේ එකක් තෝරාගත් පසු එය වෙනම 'Thread' එකක් ලෙස ක්‍රියා කරයි
                (async () => {
                    const idx = parseInt(animeSelection.text) - 1;
                    const selected = results[idx];
                    if (!selected) return;

                    await conn.sendMessage(from, { react: { text: "⏳", key: animeSelection.msg.key } });
                    const detRes = await axios.get(`${API_BASE}?action=details&url=${encodeURIComponent(selected.link)}`);
                    const details = detRes.data?.data;

                    if (details.episodes && details.episodes.length > 0) {
                        // 📺 Episode List එක එවයි
                        let epText = `📺 *${details.title}*\n\n*Select Episode:*`;
                        details.episodes.forEach((ep, i) => { epText += `\n*${i + 1}.* Episode ${ep.ep_num}`; });
                        const sentEp = await conn.sendMessage(from, { image: { url: details.image }, caption: epText + `\n\nඑපිසෝඩ් අංකය එවන්න. (SAYURA MIHIRANGA🌐)` }, { quoted: animeSelection.msg });

                        // --- ස්වාධීන එපිසෝඩ් පාලනය (Episode List) ---
                        const startEpFlow = async () => {
                            while (true) {
                                const epSel = await waitForReply(conn, from, sender, sentEp.key.id);
                                if (!epSel) break;

                                (async () => {
                                    const epIdx = parseInt(epSel.text) - 1;
                                    const chosenEp = details.episodes[epIdx];
                                    if (!chosenEp) return;

                                    // Quality & Download logic
                                    await handleDownload(conn, from, sender, chosenEp.link, details.title, epSel.msg);
                                })();
                            }
                        };
                        startEpFlow();
                    } else {
                        // Movie එකක් නම් කෙලින්ම Quality වලට
                        await handleDownload(conn, from, sender, selected.link, details.title, animeSelection.msg);
                    }
                })();
            }
        };

        // --- Quality & Download Helper ---
        async function handleDownload(conn, from, sender, url, title, quotedMsg) {
            try {
                const dlRes = await axios.get(`${API_BASE}?action=download&url=${encodeURIComponent(url)}`);
                const dlLinks = dlRes.data?.download_links;

                let qText = `🎬 *Select Quality:*\n*${title}*`;
                dlLinks.forEach((dl, i) => { qText += `\n*${i + 1}.* ${dl.quality}`; });
                const sentQual = await conn.sendMessage(from, { text: qText + `\n\nQuality අංකය එවන්න.` }, { quoted: quotedMsg });

                const qSel = await waitForReply(conn, from, sender, sentQual.key.id);
                if (!qSel) return;

                const chosen = dlLinks[parseInt(qSel.text) - 1];
                await conn.sendMessage(from, { react: { text: "📥", key: qSel.msg.key } });

                const bypass = await axios.get(`${SRIHUB_BYPASS_API}?url=${encodeURIComponent(chosen.direct_link)}&apikey=${SRIHUB_KEY}`);
                if (bypass.data?.success) {
                    const file = bypass.data.result;
                    await conn.sendMessage(from, {
                        document: { url: file.downloadUrl },
                        fileName: file.fileName,
                        mimetype: file.mimetype,
                        caption: `✅ *Download Complete*\n🎬 *${title}*\n💎 *Quality:* ${chosen.quality}\n\n${AC2_FOOTER}`
                    }, { quoted: qSel.msg });
                }
            } catch (e) { console.log(e); }
        }

        startSearchFlow();

    } catch (e) {
        console.log(e);
    }
});
ch (e) {
        console.log(e);
    }
});
