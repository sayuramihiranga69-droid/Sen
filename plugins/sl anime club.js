const { cmd } = require("../command");
const axios = require("axios");

const AC2_FOOTER = "✫☘ 𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄 ☢️☘";
const API_BASE = "https://sl-anime1.vercel.app/api/handler";
const SRIHUB_BYPASS_API = "https://api.srihub.store/download/gdrive";
const SRIHUB_KEY = "dew_ZJgBYGHUvIJNcY2mZ9ArwxulcDOjuen6KNNkPXjR";

// ───────── React helper ─────────
async function react(conn, jid, key, emoji) {
    try { await conn.sendMessage(jid, { react: { text: emoji, key } }); } catch {}
}

// ───────── High-Speed Multi-User Wait Helper ─────────
function waitForReply(conn, from, sender, timeout = 60000) {
    return new Promise((resolve, reject) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;

            // කොන්සෝල් එකේ හැම මැසේජ් එකක්ම පෙන්වයි (Debugging)
            const text = msg.message.conversation || msg.message?.extendedTextMessage?.text || "";
            const msgSender = msg.key.participant || msg.key.remoteJid;
            
            // ඔයා එවපු අංකය කොන්සෝල් එකේ ප්‍රින්ට් කරයි
            if (msg.key.remoteJid === from) {
                console.log(`[INCOMING MESSAGE] From: ${msgSender}, Text: ${text}`);
            }

            // අංකයක් ද සහ යූසර් නිවැරදිදැයි පරීක්ෂාව
            const isCorrectUser = msgSender.split('@')[0] === sender.split('@')[0];
            if (msg.key.remoteJid === from && isCorrectUser && !isNaN(text) && text.length > 0) {
                console.log(`[MATCH FOUND] User selected: ${text}`);
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
    desc: "Optimized Anime Downloader",
    category: "downloader",
    react: "⛩️",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ කරුණාකර නමක් සඳහන් කරන්න.");
        console.log(`[CONSOLE] Search started: ${q} by ${sender}`);
        await react(conn, from, m.key, "🔍");

        // 1. Search
        const searchRes = await axios.get(`${API_BASE}?action=search&query=${encodeURIComponent(q)}`);
        const results = searchRes.data?.data;
        if (!results?.length) return reply("❌ කිසිවක් හමු නොවීය.");

        let listText = "⛩️ *𝐀𝐍𝐈𝐌𝐄𝐂𝐋𝐔𝐁𝟐 𝐒𝐄𝐀𝐑𝐂𝐇*\n\n";
        results.slice(0, 10).forEach((v, i) => { listText += `*${i + 1}.* ${v.title}\n`; });
        await conn.sendMessage(from, { text: listText + `\nඅංකය Reply කරන්න.\n\n${AC2_FOOTER}` }, { quoted: m });

        // 2. Select Anime
        const { msg: selMsg, text: selText } = await waitForReply(conn, from, sender);
        const index = parseInt(selText) - 1;
        if (isNaN(index) || !results[index]) return reply("❌ වැරදි අංකයක්.");
        await react(conn, from, selMsg.key, "🎬");

        // 3. Get Details & Force Episode List
        const detailsRes = await axios.get(`${API_BASE}?action=details&url=${encodeURIComponent(results[index].link)}`);
        const details = detailsRes.data?.data;
        let downloadUrl = results[index].link;

        if (details.episodes && details.episodes.length > 0) {
            console.log(`[CONSOLE] Episode list displaying...`);
            let epText = `📺 *${details.title}*\n\n*Select Episode:*`;
            details.episodes.forEach((ep, i) => { epText += `\n*${i + 1}.* Episode ${ep.ep_num}`; });
            
            await conn.sendMessage(from, { 
                image: { url: details.image }, 
                caption: epText + `\n\nඑපිසෝඩ් අංකය Reply කරන්න.\n${AC2_FOOTER}`
            }, { quoted: selMsg });

            const { msg: epSelMsg, text: epSelText } = await waitForReply(conn, from, sender);
            downloadUrl = details.episodes[parseInt(epSelText) - 1].link;
            await react(conn, from, epSelMsg.key, "📥");
        }

        // 4. Quality selection
        const dlRes = await axios.get(`${API_BASE}?action=download&url=${encodeURIComponent(downloadUrl)}`);
        const dlLinks = dlRes.data?.download_links;
        
        let qText = `🎬 *Select Quality:*`;
        dlLinks.forEach((dl, i) => { qText += `\n*${i + 1}.* ${dl.quality}`; });
        await conn.sendMessage(from, { text: qText + `\n\nQuality අංකය Reply කරන්න.` }, { quoted: m });

        const { msg: lastMsg, text: lastText } = await waitForReply(conn, from, sender);
        const chosen = dlLinks[parseInt(lastText) - 1];
        await react(conn, from, lastMsg.key, "⏳");

        // 5. SriHub Bypass
        console.log(`[CONSOLE] Fetching Real File for: ${chosen.quality}`);
        const bypassRes = await axios.get(`${SRIHUB_BYPASS_API}?url=${encodeURIComponent(chosen.direct_link)}&apikey=${SRIHUB_KEY}`);
        
        if (bypassRes.data?.success) {
            const realFile = bypassRes.data.result;
            await conn.sendMessage(from, {
                document: { url: realFile.downloadUrl },
                fileName: realFile.fileName,
                mimetype: realFile.mimetype,
                caption: `✅ *Download Complete*\n🎬 *${details.title}*\n💎 *Quality:* ${chosen.quality}\n⚖️ *Size:* ${realFile.fileSize}\n\n${AC2_FOOTER}`
            }, { quoted: lastMsg });
            await react(conn, from, lastMsg.key, "✅");
        } else {
            reply("❌ Real File එක සකස් කිරීම අසාර්ථකයි.");
        }

    } catch (e) {
        console.log(`[FATAL ERROR] ${e.message}`);
        reply("⚠️ දෝෂයක්: " + e.message);
    }
});
