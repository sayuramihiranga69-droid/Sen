const { cmd } = require("../command");
const axios = require("axios");

const AC2_FOOTER = "✫☘ 𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄 ☢️☘";
const API_BASE = "https://sl-anime1.vercel.app/api/handler";
const GDRIVE_API_KEY = "AIzaSyB7OnWWJpaxzG70ko0aWXKgzjBpb4KZR98";

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
    desc: "Direct GDrive API Downloader Fixed",
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
        const sentSearch = await conn.sendMessage(from, { text: listText + `\nඅංකය Reply කරන්න.` }, { quoted: m });

        const startSearchFlow = async () => {
            while (true) {
                const animeSelection = await waitForReply(conn, from, sender, sentSearch.key.id);
                if (!animeSelection) break;

                (async () => {
                    const idx = parseInt(animeSelection.text) - 1;
                    const selected = results[idx];
                    if (!selected) return;

                    await conn.sendMessage(from, { react: { text: "⏳", key: animeSelection.msg.key } });
                    const detRes = await axios.get(`${API_BASE}?action=details&url=${encodeURIComponent(selected.link)}`);
                    const details = detRes.data?.data;

                    if (details.episodes && details.episodes.length > 0) {
                        let epText = `📺 *${details.title}*\n\n*Select Episode:*`;
                        details.episodes.forEach((ep, i) => { epText += `\n*${i + 1}.* Episode ${ep.ep_num}`; });
                        const sentEp = await conn.sendMessage(from, { image: { url: details.image }, caption: epText + `\n\nඑපිසෝඩ් අංකය එවන්න.` }, { quoted: animeSelection.msg });

                        const startEpFlow = async () => {
                            while (true) {
                                const epSel = await waitForReply(conn, from, sender, sentEp.key.id);
                                if (!epSel) break;
                                const epIdx = parseInt(epSel.text) - 1;
                                const chosenEp = details.episodes[epIdx];
                                if (chosenEp) await handleDownload(conn, from, sender, chosenEp.link, details.title, epSel.msg);
                            }
                        };
                        startEpFlow();
                    } else {
                        await handleDownload(conn, from, sender, selected.link, details.title, animeSelection.msg);
                    }
                })();
            }
        };

        async function handleDownload(conn, from, sender, url, title, quotedMsg) {
            try {
                const dlRes = await axios.get(`${API_BASE}?action=download&url=${encodeURIComponent(url)}`);
                const dlLinks = dlRes.data?.download_links;
                if (!dlLinks) return;

                let qText = `🎬 *Select Quality:*\n*${title}*`;
                dlLinks.forEach((dl, i) => { qText += `\n*${i + 1}.* ${dl.quality}`; });
                const sentQual = await conn.sendMessage(from, { text: qText + `\n\nQuality අංකය එවන්න.` }, { quoted: quotedMsg });

                const qSel = await waitForReply(conn, from, sender, sentQual.key.id);
                if (!qSel) return;
                const chosen = dlLinks[parseInt(qSel.text) - 1];

                const driveMatch = chosen.direct_link.match(/(?:drive\.google\.com\/file\/d\/|id=)([\w-]+)/);
                if (!driveMatch) return reply("❌ GDrive ලින්ක් එකක් හමු නොවීය.");
                
                const fileId = driveMatch[1];
                await conn.sendMessage(from, { react: { text: "📥", key: qSel.msg.key } });

                console.log(`[GDRIVE API] Fetching File ID: ${fileId}`);
                const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GDRIVE_API_KEY}`;

                // --- මෙන්න මෙතන වෙනස් කළා (Stream වෙනුවට ArrayBuffer) ---
                const response = await axios({
                    method: 'get',
                    url: downloadUrl,
                    responseType: 'arraybuffer' 
                });

                await conn.sendMessage(from, {
                    document: Buffer.from(response.data), // Buffer එකක් ලෙස යැවීම
                    mimetype: "video/mp4",
                    fileName: `${title}_${chosen.quality}.mp4`,
                    caption: `✅ *Download Complete*\n🎬 *${title}*\n💎 *Quality:* ${chosen.quality}\n\n${AC2_FOOTER}`
                }, { quoted: qSel.msg });

            } catch (e) { 
                console.log(`[DOWNLOAD ERROR]`, e.message);
                reply("❌ බාගත කිරීමේ දෝෂයකි. (Google API Error: " + e.message + ")");
            }
        }

        startSearchFlow();

    } catch (e) {
        console.log(e);
        reply("❌ දෝෂයක් සිදු විය.");
    }
});
