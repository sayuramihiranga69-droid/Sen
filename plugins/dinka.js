const { cmd } = require("../command");
const axios = require("axios");

const DK_FOOTER = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄☢️☘";
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
                const text = msg.message.conversation || msg.message?.extendedTextMessage?.text || "";
                if (!isNaN(text)) {
                    conn.ev.off("messages.upsert", handler);
                    resolve({ msg, text: text.trim() });
                }
            }
        };
        conn.ev.on("messages.upsert", handler);
        setTimeout(() => { conn.ev.off("messages.upsert", handler); }, 300000); 
    });
}

cmd({
    pattern: "dinka",
    alias: ["dk", "movie"],
    desc: "Dinka Downloader with Live Console Support",
    category: "downloader",
    react: "🎬",
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ කරුණාකර නමක් ලබාදෙන්න.");

        console.log(`\n[🔍 SEARCH] User: ${sender} | Query: ${q}`);

        const searchRes = await axios.get(`${DK_BASE}/?action=search&query=${encodeURIComponent(q)}`);
        const results = searchRes.data?.data;
        if (!results?.length) {
            console.log(`[❌ EMPTY] No results found for: ${q}`);
            return reply("❌ කිසිවක් හමු නොවීය.");
        }

        console.log(`[✅ FOUND] ${results.length} results found.`);

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

                        console.log(`[🎯 SELECTED] User picked: ${item.title}`);
                        await conn.sendMessage(from, { react: { text: "⏳", key: sel.msg.key } });

                        const detRes = await axios.get(`${DK_HANDLER}?action=movie&url=${encodeURIComponent(item.link)}`);
                        const movieData = detRes.data?.data;
                        if (!movieData?.download_links) {
                            console.log(`[❌ ERROR] Could not fetch links for: ${item.title}`);
                            return;
                        }

                        let qText = `🎬 *${movieData.title}*\n\n*Select Quality:*`;
                        movieData.download_links.forEach((dl, i) => { qText += `\n*${i + 1}.* ${dl.quality}`; });
                        
                        const sentQual = await conn.sendMessage(from, { 
                            image: { url: item.image },
                            caption: qText + `\n\nඅංකය Reply කරන්න.` 
                        }, { quoted: sel.msg });

                        const qSel = await waitForReply(conn, from, sender, sentQual.key.id);
                        if (!qSel) return;

                        const chosen = movieData.download_links[parseInt(qSel.text) - 1];
                        const rawLink = chosen.direct_link;

                        console.log(`[💎 QUALITY] User selected: ${chosen.quality}`);
                        console.log(`[🔗 LINK] Raw URL: ${rawLink}`);

                        await conn.sendMessage(from, { react: { text: "📥", key: qSel.msg.key } });

                        // --- Smart Link Router ---
                        const isGdrive = rawLink.includes("drive.google.com") || rawLink.includes("da.gd") || rawLink.includes("gdrive");

                        if (isGdrive) {
                            console.log(`[🚀 MODE] G-Drive detected. Sending to SriHub Bypass...`);
                            const bypass = await axios.get(`${SRIHUB_BYPASS}?url=${encodeURIComponent(rawLink)}&apikey=${SRIHUB_KEY}`);
                            
                            if (bypass.data?.success) {
                                const file = bypass.data.result;
                                console.log(`[✅ BYPASS] Success! Filename: ${file.fileName} | Size: ${file.fileSize}`);
                                
                                await conn.sendMessage(from, {
                                    document: { url: file.downloadUrl },
                                    fileName: file.fileName,
                                    mimetype: file.mimetype,
                                    caption: `✅ *G-Drive Bypass Done*\n🎬 *${movieData.title}*\n💎 *Quality:* ${chosen.quality}\n\n${DK_FOOTER}`
