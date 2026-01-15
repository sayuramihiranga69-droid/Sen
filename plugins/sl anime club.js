const { cmd } = require("../command");
const axios = require("axios");

const AC2_FOOTER = "✫☘ 𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄 ☢️☘";
const API_BASE = "https://sl-anime1.vercel.app/api/handler";
const SRIHUB_BYPASS_API = "https://api.srihub.store/download/gdrive";
const SRIHUB_KEY = "dew_YyT0KDc2boHDasFlmZCqDcPoeDHReD20aYmEsm1G";

// ───────── Ultra-Secure Wait Helper ─────────
function waitForReply(conn, from, sender, timeout = 60000) {
    return new Promise((resolve, reject) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;

            const text = msg.message.conversation || msg.message?.extendedTextMessage?.text || "";
            const msgSender = msg.key.participant || msg.key.remoteJid;
            
            // LID සහ JID දෙකම චෙක් කරලා හරියටම යූසර්ව අල්ලගන්නවා
            const isCorrectUser = msgSender.includes(sender.split('@')[0]) || msgSender.includes("@lid");

            if (msg.key.remoteJid === from && isCorrectUser && !isNaN(text) && text.length > 0) {
                console.log(`[MATCH] Received: ${text}`);
                conn.ev.off("messages.upsert", handler);
                resolve({ msg, text: text.trim() });
            }
        };
        conn.ev.on("messages.upsert", handler);
        setTimeout(() => {
            conn.ev.off("messages.upsert", handler);
            reject(new Error("Timeout!"));
        }, timeout);
    });
}

// ───────── Command ─────────
cmd({
    pattern: "anime",
    alias: ["ac2", "movie"],
    desc: "Fixed Logic Anime Downloader",
    category: "downloader",
    react: "⛩️",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ කරුණාකර නමක් සඳහන් කරන්න.");
        console.log(`[START] Search: ${q}`);

        // 1. සර්ච් කිරීම
        const searchRes = await axios.get(`${API_BASE}?action=search&query=${encodeURIComponent(q)}`);
        const results = searchRes.data?.data;
        if (!results?.length) return reply("❌ කිසිවක් හමු නොවීය.");

        let listText = "⛩️ *𝐀𝐍𝐈𝐌𝐄𝐂𝐋𝐔𝐁𝟐 𝐒𝐄𝐀𝐑𝐂𝐇*\n\n";
        results.slice(0, 10).forEach((v, i) => { listText += `*${i + 1}.* ${v.title}\n`; });
        await conn.sendMessage(from, { text: listText + `\nඅංකය Reply කරන්න.\n\n${AC2_FOOTER}` }, { quoted: m });

        // 2. ඇනිමේ එක තෝරාගැනීම
        const sel1 = await waitForReply(conn, from, sender);
        const animeIdx = parseInt(sel1.text) - 1;
        if (!results[animeIdx]) return reply("❌ වැරදි අංකයක්.");
        const selectedAnime = results[animeIdx];
        console.log(`[SELECTED ANIME] ${selectedAnime.title}`);

        // 3. විස්තර ලබාගැනීම
        const detailsRes = await axios.get(`${API_BASE}?action=details&url=${encodeURIComponent(selectedAnime.link)}`);
        const details = detailsRes.data?.data;
        let finalDlUrl = selectedAnime.link;

        // ❗ එපිසෝඩ් තියෙනවා නම් අනිවාර්යයෙන්ම පෙන්වනවා
        if (details.episodes && details.episodes.length > 0) {
            let epText = `📺 *${details.title}*\n\n*Select Episode:*`;
            details.episodes.forEach((ep, i) => { epText += `\n*${i + 1}.* Episode ${ep.ep_num}`; });
            await conn.sendMessage(from, { image: { url: details.image }, caption: epText + `\n\nඅංකය Reply කරන්න.\n${AC2_FOOTER}` });

            const sel2 = await waitForReply(conn, from, sender);
            const epIdx = parseInt(sel2.text) - 1;
            if (details.episodes[epIdx]) finalDlUrl = details.episodes[epIdx].link;
        }

        // 4. Quality එක තෝරාගැනීම
        const dlRes = await axios.get(`${API_BASE}?action=download&url=${encodeURIComponent(finalDlUrl)}`);
        const dlLinks = dlRes.data?.download_links;
        if (!dlLinks) return reply("❌ ඩවුන්ලෝඩ් ලින්ක්ස් හමු නොවීය.");

        let qText = `🎬 *Select Quality:*`;
        dlLinks.forEach((dl, i) => { qText += `\n*${i + 1}.* ${dl.quality}`; });
        await conn.sendMessage(from, { text: qText + `\n\nQuality අංකය Reply කරන්න.` });

        // ❗ මෙතනදී කලින් එක පටලවා නොගැනීමට අලුත් waitForReply එකක් පාවිච්චි කරයි
        const sel3 = await waitForReply(conn, from, sender);
        const qIdx = parseInt(sel3.text) - 1;
        const chosen = dlLinks[qIdx];
        if (!chosen) return reply("❌ වැරදි Quality අංකයක්.");

        // 5. ඩවුන්ලෝඩ් කර යැවීම
        await conn.sendMessage(from, { react: { text: "⏳", key: sel3.msg.key } });
        const bypassRes = await axios.get(`${SRIHUB_BYPASS_API}?url=${encodeURIComponent(chosen.direct_link)}&apikey=${SRIHUB_KEY}`);
        
        if (bypassRes.data?.success) {
            const file = bypassRes.data.result;
            await conn.sendMessage(from, {
                document: { url: file.downloadUrl },
                fileName: file.fileName,
                mimetype: file.mimetype,
                caption: `✅ *Download Complete*\n🎬 *${details.title}*\n💎 *Quality:* ${chosen.quality}\n⚖️ *Size:* ${file.fileSize}\n\n${AC2_FOOTER}`
            }, { quoted: sel3.msg });
        } else {
            reply("❌ Real File එක සකස් කිරීම අසාර්ථකයි.");
        }

    } catch (e) {
        console.log(`[ERROR] ${e.message}`);
        reply("⚠️ දෝෂයක්: " + e.message);
    }
});
