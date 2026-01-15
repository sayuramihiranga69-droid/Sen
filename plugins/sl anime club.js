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

// ───────── Secure Multi-User Wait Helper ─────────
function waitForReply(conn, from, sender, replyToId, timeout = 120000) {
    return new Promise((resolve, reject) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;
            const ctx = msg.message?.extendedTextMessage?.contextInfo;
            const text = msg.message.conversation || msg.message?.extendedTextMessage?.text;
            
            // StanzaId සහ Sender පරීක්ෂාව නිසා පටලැවෙන්නේ නැත
            if (msg.key.remoteJid === from && ctx?.stanzaId === replyToId && (msg.key.participant === sender || msg.key.remoteJid === sender)) {
                conn.ev.off("messages.upsert", handler);
                resolve({ msg, text: text ? text.trim() : "" });
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
    desc: "Anime Downloader with IMDb and All Episodes",
    category: "downloader",
    react: "⛩️",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ නමක් සඳහන් කරන්න.");
        await react(conn, from, m.key, "🔍");

        // 1. Search
        const searchRes = await axios.get(`${API_BASE}?action=search&query=${encodeURIComponent(q)}`);
        const results = searchRes.data?.data;
        if (!results?.length) return reply("❌ කිසිවක් හමු නොවීය.");

        let listText = "⛩️ *𝐀𝐍𝐈𝐌𝐄𝐂𝐋𝐔𝐁𝟐 𝐒𝐄𝐀𝐑𝐂𝐇*\n\n";
        results.slice(0, 10).forEach((v, i) => { listText += `*${i + 1}.* ${v.title}\n`; });
        const listMsg = await conn.sendMessage(from, { text: listText + `\nඅංකය Reply කරන්න.\n\n${AC2_FOOTER}` }, { quoted: m });

        // 2. Selection
        const { msg: selMsg, text: selText } = await waitForReply(conn, from, sender, listMsg.key.id);
        const index = parseInt(selText) - 1;
        if (isNaN(index) || !results[index]) return reply("❌ වැරදි අංකයක්.");
        await react(conn, from, selMsg.key, "🎬");

        // 3. Details (Fetching IMDb)
        const detailsRes = await axios.get(`${API_BASE}?action=details&url=${encodeURIComponent(results[index].link)}`);
        const details = detailsRes.data?.data;
        let downloadUrl = results[index].link;

        // IMDb Rating එක පෙන්වීම (Screenshot එකේ විදිහට)
        const rating = details.imdb_rating ? `⭐ IMDb: ${details.imdb_rating}` : "";

        if (details.is_tv_show && details.episodes) {
            let epText = `📺 *${details.title}*\n${rating}\n\n*Select Episode:*`;
            details.episodes.forEach((ep, i) => { epText += `\n*${i + 1}.* Episode ${ep.ep_num}`; });
            
            const epMsg = await conn.sendMessage(from, { 
                image: { url: details.image }, 
                caption: epText + `\n\nඑපිසෝඩ් අංකය Reply කරන්න.\n${AC2_FOOTER}`
            }, { quoted: selMsg });

            const { msg: epSelMsg, text: epSelText } = await waitForReply(conn, from, sender, epMsg.key.id);
            downloadUrl = details.episodes[parseInt(epSelText) - 1].link;
            await react(conn, from, epSelMsg.key, "📥");
        }

        // 4. Quality
        const dlRes = await axios.get(`${API_BASE}?action=download&url=${encodeURIComponent(downloadUrl)}`);
        const dlLinks = dlRes.data?.download_links;
        
        let qText = `🎬 *Select Quality:*`;
        dlLinks.forEach((dl, i) => { qText += `\n*${i + 1}.* ${dl.quality}`; });
        const qMsg = await conn.sendMessage(from, { text: qText }, { quoted: selMsg });

        const { msg: lastMsg, text: lastText } = await waitForReply(conn, from, sender, qMsg.key.id);
        const chosen = dlLinks[parseInt(lastText) - 1];
        await react(conn, from, lastMsg.key, "⏳");

        // 5. SriHub Bypass & Final Send
        const bypassRes = await axios.get(`${SRIHUB_BYPASS_API}?url=${encodeURIComponent(chosen.direct_link)}&apikey=${SRIHUB_KEY}`);
        
        if (bypassRes.data?.success) {
            const realFile = bypassRes.data.result;
            const docMsg = await conn.sendMessage(from, {
                document: { url: realFile.downloadUrl },
                fileName: realFile.fileName,
                mimetype: realFile.mimetype,
                caption: `✅ *Download Complete*\n🎬 *${details.title}*\n💎 *Quality:* ${chosen.quality}\n⚖️ *Size:* ${realFile.fileSize}\n\n${AC2_FOOTER}`
            }, { quoted: lastMsg });
            await react(conn, from, docMsg.key, "✅");
        } else {
            reply("❌ Real File එක සකස් කිරීම අසාර්ථකයි.");
        }

    } catch (e) {
        reply("⚠️ දෝෂයක්: " + e.message);
    }
});
