const { cmd } = require("../command");
const axios = require("axios");

const AC2_FOOTER = "✫☘ 𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄 ☢️☘";
const API_BASE = "https://sl-anime1.vercel.app/api/handler";
const SRIHUB_BYPASS_API = "https://api.srihub.store/download/gdrive";
const SRIHUB_KEY = "dew_YyT0KDc2boHDasFlmZCqDcPoeDHReD20aYmEsm1G";

// ───────── React helper ─────────
async function react(conn, jid, key, emoji) {
    try { await conn.sendMessage(jid, { react: { text: emoji, key } }); } catch {}
}

// ───────── Multi-User Wait for Reply Helper ─────────
function waitForReply(conn, from, sender, replyToId, timeout = 120000) {
    return new Promise((resolve, reject) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;

            const ctx = msg.message?.extendedTextMessage?.contextInfo;
            const text = msg.message.conversation || msg.message?.extendedTextMessage?.text;
            const isReplyToBot = ctx?.stanzaId === replyToId;
            const isSameUser = msg.key.participant === sender || msg.key.remoteJid === sender;

            // පටලැවිල්ල වැලැක්වීමට User ID සහ Message ID දෙකම පරීක්ෂා කරයි
            if (msg.key.remoteJid === from && isReplyToBot && isSameUser) {
                conn.ev.off("messages.upsert", handler);
                resolve({ msg, text: text ? text.trim() : "" });
            }
        };
        conn.ev.on("messages.upsert", handler);
        setTimeout(() => {
            conn.ev.off("messages.upsert", handler);
            reject(new Error("Timeout! පමා වැඩි නිසා අවලංගු විය."));
        }, timeout);
    });
}

// ───────── Command ─────────
cmd({
    pattern: "anime",
    alias: ["ac2", "movie"],
    desc: "Anime/Movie Downloader with Multi-User Support",
    category: "downloader",
    react: "⛩️",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ කරුණාකර නමක් සඳහන් කරන්න. (Ex: .anime Demon Slayer)");
        await react(conn, from, m.key, "🔍");

        // 1. සෙවීම
        const searchRes = await axios.get(`${API_BASE}?action=search&query=${encodeURIComponent(q)}`);
        const results = searchRes.data?.data;
        if (!results?.length) return reply("❌ කිසිවක් හමු නොවීය.");

        let listText = "⛩️ *𝐀𝐍𝐈𝐌𝐄𝐂𝐋𝐔𝐁𝟐 𝐒𝐄𝐀𝐑𝐂𝐇*\n\n";
        results.slice(0, 10).forEach((v, i) => { listText += `*${i + 1}.* ${v.title} (${v.type})\n`; });
        const listMsg = await conn.sendMessage(from, { text: listText + `\nඅදාළ අංකය Reply කරන්න.\n\n${AC2_FOOTER}` }, { quoted: m });

        // 2. තේරීම
        const { msg: selMsg, text: selText } = await waitForReply(conn, from, sender, listMsg.key.id);
        const index = parseInt(selText) - 1;
        if (isNaN(index) || !results[index]) return reply("❌ වැරදි අංකයක්.");
        await react(conn, from, selMsg.key, "🎬");

        // 3. විස්තර ගැනීම
        const detailsRes = await axios.get(`${API_BASE}?action=details&url=${encodeURIComponent(results[index].link)}`);
        const details = detailsRes.data?.data;
        let downloadUrl = results[index].link;

        if (details.is_tv_show && details.episodes) {
            let epText = `📺 *${details.title}*\n\n*Select Episode:*`;
            // සීමාවකින් තොරව සියලුම එපිසෝඩ් පෙන්වයි
            details.episodes.forEach((ep, i) => { epText += `\n*${i + 1}.* Episode ${ep.ep_num}`; });
            
            const epMsg = await conn.sendMessage(from, { 
                image: { url: details.image }, 
                caption: epText + `\n\nඑපිසෝඩ් අංකය Reply කරන්න.\n${AC2_FOOTER}`
            }, { quoted: selMsg });

            const { msg: epSelMsg, text: epSelText } = await waitForReply(conn, from, sender, epMsg.key.id);
            const epIdx = parseInt(epSelText) - 1;
            if (isNaN(epIdx) || !details.episodes[epIdx]) return reply("❌ වැරදි එපිසෝඩ් අංකයක්.");
            downloadUrl = details.episodes[epIdx].link;
            await react(conn, from, epSelMsg.key, "📥");
        }

        // 4. Quality තේරීම
        const dlRes = await axios.get(`${API_BASE}?action=download&url=${encodeURIComponent(downloadUrl)}`);
        const dlLinks = dlRes.data?.download_links;
        if (!dlLinks) return reply("❌ ලින්ක්ස් හමු නොවීය.");

        let qText = `🎬 *Select Quality:*`;
        dlLinks.forEach((dl, i) => { qText += `\n*${i + 1}.* ${dl.quality}`; });
        const qMsg = await conn.sendMessage(from, { text: qText + `\n\nQuality අංකය Reply කරන්න.` }, { quoted: selMsg });

        const { msg: lastMsg, text: lastText } = await waitForReply(conn, from, sender, qMsg.key.id);
        const chosen = dlLinks[parseInt(lastText) - 1];
        if (!chosen) return reply("❌ වැරදි Quality අංකයක්.");
        
        await react(conn, from, lastMsg.key, "⏳");

        // 5. SriHub GDrive Bypass (අර 2.5 KB අවුල නැති කිරීමට)
        const bypassRes = await axios.get(`${SRIHUB_BYPASS_API}?url=${encodeURIComponent(chosen.direct_link)}&apikey=${SRIHUB_KEY}`);
        
        if (bypassRes.data && bypassRes.data.success) {
            const realFile = bypassRes.data.result;
            const docMsg = await conn.sendMessage(from, {
                document: { url: realFile.downloadUrl },
                fileName: realFile.fileName,
                mimetype: realFile.mimetype,
                caption: `✅ *Download Complete*\n🎬 *${details.title}*\n💎 *Quality:* ${chosen.quality}\n⚖️ *Size:* ${realFile.fileSize}\n\n${AC2_FOOTER}`
            }, { quoted: lastMsg });
            await react(conn, from, docMsg.key, "✅");
        } else {
            reply("❌ Real File එක ලබාගැනීම අසාර්ථකයි. පසුව උත්සාහ කරන්න.");
        }

    } catch (e) {
        reply("⚠️ දෝෂයක්: " + e.message);
    }
});
