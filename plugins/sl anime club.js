const { cmd } = require("../command");
const axios = require("axios");
const sharp = require("sharp");

const AC2_FOOTER = "✫☘ 𝐀𝐍𝐈𝐌𝐄𝐂𝐋𝐔𝐁𝟐 𝐃𝐋 ☢️☘";
const API_BASE = "https://sl-anime1.vercel.app/api/handler";

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

// ───────── Create Thumbnail ─────────
async function makeThumbnail(url) {
    try {
        const img = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
        return await sharp(img.data).resize(300).jpeg({ quality: 65 }).toBuffer();
    } catch (e) { return null; }
}

// ───────── Command ─────────
cmd({
    pattern: "anime",
    alias: ["ac2"],
    desc: "Download Real Video File from AnimeClub2",
    category: "downloader",
    react: "📥",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example: .anime Demon Slayer");
        await react(conn, from, m.key, "🔍");

        // 1️⃣ Search
        const searchRes = await axios.get(`${API_BASE}?action=search&query=${encodeURIComponent(q)}`);
        const results = searchRes.data?.data;
        if (!results?.length) return reply("❌ No results found");

        let listText = "⛩️ *AnimeClub2 Results*\n\n";
        results.slice(0, 10).forEach((v, i) => { listText += `*${i + 1}.* ${v.title}\n`; });
        const listMsg = await conn.sendMessage(from, { text: listText + `\nReply with number\n\n${AC2_FOOTER}` }, { quoted: m });

        // 2️⃣ Select Anime
        const { msg: selMsg, text: selText } = await waitForReply(conn, from, listMsg.key.id);
        const index = parseInt(selText) - 1;
        if (isNaN(index) || !results[index]) return reply("❌ Invalid number");
        const selected = results[index];

        // 3️⃣ Get Details
        const detailsRes = await axios.get(`${API_BASE}?action=details&url=${encodeURIComponent(selected.link)}`);
        const details = detailsRes.data?.data;
        let downloadUrl = selected.link;

        if (details.is_tv_show) {
            let epText = `📺 *${details.title}*\n\n*Select Episode:*`;
            details.episodes.slice(0, 20).forEach((ep, i) => { epText += `\n*${i + 1}.* Episode ${ep.ep_num}`; });
            const epMsg = await conn.sendMessage(from, { image: { url: details.image }, caption: epText }, { quoted: selMsg });
            const { msg: epSelMsg, text: epSelText } = await waitForReply(conn, from, epMsg.key.id);
            downloadUrl = details.episodes[parseInt(epSelText) - 1].link;
        }

        // 4️⃣ Get Qualities
        const dlRes = await axios.get(`${API_BASE}?action=download&url=${encodeURIComponent(downloadUrl)}`);
        const dlLinks = dlRes.data?.download_links;
        if (!dlLinks) return reply("❌ No links found");

        let qText = `🎬 *Select Quality:*`;
        dlLinks.forEach((dl, i) => { qText += `\n*${i + 1}.* ${dl.quality}`; });
        const qMsg = await conn.sendMessage(from, { text: qText }, { quoted: selMsg });

        // 5️⃣ Final Download & Send Document
        const { msg: lastMsg, text: lastText } = await waitForReply(conn, from, qMsg.key.id);
        const chosen = dlLinks[parseInt(lastText) - 1];
        
        await reply("🚀 Downloading to server... Please wait.");
        await react(conn, from, lastMsg.key, "⏳");

        const thumb = await makeThumbnail(details.image);

        // ❗ මෙතනදී තමයි Real File එක Stream කරලා යවන්නේ
        await conn.sendMessage(from, {
            document: { url: chosen.direct_link },
            fileName: `${details.title} - ${chosen.quality}.mp4`.replace(/[\/\\:*?"<>|]/g,""),
            mimetype: "video/mp4",
            jpegThumbnail: thumb || undefined,
            caption: `✅ *Download Complete*\n🎬 *${details.title}*\n💎 *Quality:* ${chosen.quality}\n\n${AC2_FOOTER}`
        }, { quoted: lastMsg });

        await react(conn, from, lastMsg.key, "✅");

    } catch (e) {
        reply("⚠️ Error: " + e.message);
    }
});
