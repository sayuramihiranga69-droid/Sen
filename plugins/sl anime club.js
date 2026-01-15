const { cmd } = require("../command");
const axios = require("axios");

const AC2_FOOTER = "✫☘ 𝐀𝐍𝐈𝐌𝐄𝐂𝐋𝐔𝐁𝟐 𝐃𝐋 ☢️☘";
const API_BASE = "https://sl-anime1.vercel.app/api/handler";
const SRIHUB_BYPASS_API = "https://api.srihub.store/download/gdrive";
const SRIHUB_KEY = "dew_YyT0KDc2boHDasFlmZCqDcPoeDHReD20aYmEsm1G";

// ───────── React helper ─────────
async function react(conn, jid, key, emoji) {
    try { await conn.sendMessage(jid, { react: { text: emoji, key } }); } catch {}
}

// ───────── Wait for reply helper ─────────
function waitForReply(conn, from, replyToId, timeout = 120000) {
    return new Promise((resolve, reject) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;
            const ctx = msg.message?.extendedTextMessage?.contextInfo;
            const text = msg.message.conversation || msg.message?.extendedTextMessage?.text;
            if (msg.key.remoteJid === from && ctx?.stanzaId === replyToId) {
                conn.ev.off("messages.upsert", handler);
                resolve({ msg, text: text ? text.trim() : "" });
            }
        };
        conn.ev.on("messages.upsert", handler);
        setTimeout(() => {
            conn.ev.off("messages.upsert", handler);
            reject(new Error("Reply timeout"));
        }, timeout);
    });
}

// ───────── Command ─────────
cmd({
    pattern: "anime",
    alias: ["ac2"],
    desc: "Download Real Video File using SriHub Bypass",
    category: "downloader",
    react: "📥",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example: .anime Demon Slayer");
        await react(conn, from, m.key, "🔍");

        // 1. සෙවීම
        const searchRes = await axios.get(`${API_BASE}?action=search&query=${encodeURIComponent(q)}`);
        const results = searchRes.data?.data;
        if (!results?.length) return reply("❌ No results found");

        let listText = "⛩️ *AnimeClub2 Results*\n\n";
        results.slice(0, 10).forEach((v, i) => { listText += `*${i + 1}.* ${v.title}\n`; });
        const listMsg = await conn.sendMessage(from, { text: listText + `\nReply with number\n\n${AC2_FOOTER}` }, { quoted: m });

        const { text: selText } = await waitForReply(conn, from, listMsg.key.id);
        const selected = results[parseInt(selText) - 1];

        // 2. විස්තර ගැනීම
        const detailsRes = await axios.get(`${API_BASE}?action=details&url=${encodeURIComponent(selected.link)}`);
        const details = detailsRes.data?.data;
        let downloadUrl = selected.link;

        if (details.is_tv_show) {
            let epText = `📺 *${details.title}*\n\n*Select Episode:*`;
            details.episodes.slice(0, 20).forEach((ep, i) => { epText += `\n*${i + 1}.* Episode ${ep.ep_num}`; });
            const epMsg = await conn.sendMessage(from, { text: epText }, { quoted: m });
            const { text: epSelText } = await waitForReply(conn, from, epMsg.key.id);
            downloadUrl = details.episodes[parseInt(epSelText) - 1].link;
        }

        // 3. Quality ලින්ක්ස් ගැනීම
        const dlRes = await axios.get(`${API_BASE}?action=download&url=${encodeURIComponent(downloadUrl)}`);
        const dlLinks = dlRes.data?.download_links;
        
        let qText = `🎬 *Select Quality:*`;
        dlLinks.forEach((dl, i) => { qText += `\n*${i + 1}.* ${dl.quality}`; });
        const qMsg = await conn.sendMessage(from, { text: qText }, { quoted: m });

        const { msg: lastMsg, text: lastText } = await waitForReply(conn, from, qMsg.key.id);
        const chosen = dlLinks[parseInt(lastText) - 1];
        
        await reply("🚀 SriHub හරහා Real Link එක සකස් කරමින් පවතී...");
        await react(conn, from, lastMsg.key, "⏳");

        // 4. SriHub Bypass API එකෙන් Real Download URL එක ගැනීම
        const bypassRes = await axios.get(`${SRIHUB_BYPASS_API}?url=${encodeURIComponent(chosen.direct_link)}&apikey=${SRIHUB_KEY}`);
        
        if (bypassRes.data && bypassRes.data.success) {
            const realFile = bypassRes.data.result;

            // 5. Real File එක Document එකක් විදිහට යැවීම
            await conn.sendMessage(from, {
                document: { url: realFile.downloadUrl },
                fileName: realFile.fileName,
                mimetype: realFile.mimetype,
                caption: `✅ *Download Complete*\n🎬 *${details.title}*\n💎 *Quality:* ${chosen.quality}\n⚖️ *Size:* ${realFile.fileSize}\n\n${AC2_FOOTER}`
            }, { quoted: lastMsg });

            await react(conn, from, lastMsg.key, "✅");
        } else {
            reply("❌ Real link එක ලබාගැනීමට නොහැකි වුණා. පසුව උත්සාහ කරන්න.");
        }

    } catch (e) {
        reply("⚠️ Error: " + e.message);
    }
});
