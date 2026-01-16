const { cmd } = require("../command");
const axios = require("axios");

const FOOTER = "✫☘ 𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄 ☢️☘";
const API_BASE = "https://sl-anime1.vercel.app/api/handler";
const SRIHUB_BYPASS_API = "https://api.srihub.store/download/gdrive";
const SRIHUB_KEY = "dew_5H5Dbuh4v7NbkNRmI0Ns2u2ZK240aNnJ9lnYQXR9";

// ───────── Smart Waiter ─────────
function waitForReply(conn, from, sender, targetId) {
    return new Promise((resolve) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;
            const text = msg.message.conversation || msg.message?.extendedTextMessage?.text || "";
            const context = msg.message?.extendedTextMessage?.contextInfo;
            const msgSender = msg.key.participant || msg.key.remoteJid;
            const isTargetReply = context?.stanzaId === targetId;
            const isCorrectUser = msgSender.includes(sender.split('@')[0]);
            if (msg.key.remoteJid === from && isCorrectUser && isTargetReply && !isNaN(text)) {
                conn.ev.off("messages.upsert", handler);
                resolve({ msg, text: text.trim() });
            }
        };
        conn.ev.on("messages.upsert", handler);
        setTimeout(() => { conn.ev.off("messages.upsert", handler); }, 300000);
    });
}

cmd({
    pattern: "anime",
    alias: ["ac2", "slanime"],
    desc: "Anime & Movies Downloader",
    category: "downloader",
    react: "⛩️",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ කරුණාකර ඇනිමේ එකක නමක් සඳහන් කරන්න.");

        const searchRes = await axios.get(`${API_BASE}?action=search&query=${encodeURIComponent(q)}`);
        const results = searchRes.data?.data;
        if (!results?.length) return reply("❌ කිසිවක් හමු නොවීය.");

        let listText = "⛩️ *𝐀𝐍𝐈𝐌𝐄 𝐒𝐄𝐀𝐑𝐂𝐇*\n\n";
        results.slice(0, 10).forEach((v, i) => { listText += `*${i + 1}.* ${v.title}\n`; });
        const sentSearch = await conn.sendMessage(from, { text: listText + `\nඅංකය Reply කරන්න.` }, { quoted: m });

        const animeSelection = await waitForReply(conn, from, sender, sentSearch.key.id);
        if (!animeSelection) return;

        const idx = parseInt(animeSelection.text) - 1;
        const selected = results[idx];
        if (!selected) return;

        await conn.sendMessage(from, { react: { text: "⏳", key: animeSelection.msg.key } });
        const detRes = await axios.get(`${API_BASE}?action=details&url=${encodeURIComponent(selected.link)}`);
        const details = detRes.data?.data;

        if (details.episodes && details.episodes.length > 0) {
            let epText = `📺 *${details.title}*\n\n*Select Episode:*`;
            details.episodes.slice(0, 20).forEach((ep, i) => { epText += `\n*${i + 1}.* Episode ${ep.ep_num}`; });
            const sentEp = await conn.sendMessage(from, { image: { url: details.image }, caption: epText + `\n\nඅංකය එවන්න.` }, { quoted: animeSelection.msg });

            const epSel = await waitForReply(conn, from, sender, sentEp.key.id);
            if (!epSel) return;
            const epIdx = parseInt(epSel.text) - 1;
            const chosenEp = details.episodes[epIdx];
            if (!chosenEp) return;

            await handleDownload(conn, from, sender, chosenEp.link, details.title, epSel.msg);
        } else {
            await handleDownload(conn, from, sender, selected.link, details.title, animeSelection.msg);
        }
    } catch (e) {
        console.log(e);
        reply("❌ දෝෂයක් සිදු විය.");
    }
});

async function handleDownload(conn, from, sender, url, title, quotedMsg) {
    try {
        const dlRes = await axios.get(`${API_BASE}?action=download&url=${encodeURIComponent(url)}`);
        const dlLinks = dlRes.data?.download_links;
        if (!dlLinks) return;

        let qText = `🎬 *Select Quality:*\n*${title}*`;
        dlLinks.forEach((dl, i) => { qText += `\n*${i + 1}.* ${dl.quality}`; });
        const sentQual = await conn.sendMessage(from, { text: qText + `\n\nඅංකය එවන්න.` }, { quoted: quotedMsg });

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
                caption: `✅ *Download Complete*\n🎬 *${title}*\n\n${FOOTER}`
            }, { quoted: qSel.msg });
        }
    } catch (e) { console.log(e); }
}
