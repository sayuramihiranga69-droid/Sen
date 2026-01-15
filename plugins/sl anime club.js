const { cmd } = require('../command');
const axios = require('axios');
const sharp = require('sharp');

const footer_text = "✫☘ 𝐀𝐍𝐈𝐌𝐄𝐂𝐋𝐔𝐁𝟐 𝐃𝐋 ☢️☘";
const API_BASE = "https://sl-anime1.vercel.app/api/handler";

// ───────── React helper ─────────
async function react(conn, jid, key, emoji) {
    try { await conn.sendMessage(jid, { react: { text: emoji, key } }); } catch {}
}

// ───────── Create thumbnail ─────────
async function makeThumbnail(url) {
    try {
        const img = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
        return await sharp(img.data).resize(300).jpeg({ quality: 65 }).toBuffer();
    } catch (e) {
        return null;
    }
}

// ───────── Wait for reply ─────────
function waitForReply(conn, from, replyToId, timeout = 120000) {
    return new Promise((resolve, reject) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;
            const ctx = msg.message?.extendedTextMessage?.contextInfo;
            const text = msg.message.conversation || msg.message?.extendedTextMessage?.text;
            if (msg.key.remoteJid === from && ctx?.stanzaId === replyToId) {
                conn.ev.off("messages.upsert", handler);
                resolve({ msg, text });
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
    desc: "Download Anime and Movies from AnimeClub2",
    category: "downloader",
    react: "⛩️",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example: .anime Demon Slayer");
        await react(conn, from, m.key, "🔍");

        // 1️⃣ Search
        const searchRes = await axios.get(`${API_BASE}?action=search&query=${encodeURIComponent(q)}`);
        const results = searchRes.data?.data;
        if (!results?.length) return reply("❌ No results found on AnimeClub2");

        let listText = `⛩️ *AnimeClub2 Results*\n\n`;
        results.slice(0, 10).forEach((v, i) => { listText += `*${i + 1}.* ${v.title}\n`; });

        const listMsg = await conn.sendMessage(from, {
            text: listText + `\nReply with the number to select.\n\n${footer_text}`
        }, { quoted: mek });

        // 2️⃣ Select Anime/Movie
        const { msg: selMsg, text: selText } = await waitForReply(conn, from, listMsg.key.id);
        const index = parseInt(selText) - 1;
        if (isNaN(index) || !results[index]) return reply("❌ Invalid selection");
        const selected = results[index];

        // 3️⃣ Get Details (Episodes or Movie Info)
        const detailsRes = await axios.get(`${API_BASE}?action=details&url=${encodeURIComponent(selected.link)}`);
        const details = detailsRes.data?.data;
        if (!details) return reply("❌ Failed to fetch details");

        let downloadUrl = selected.link; // Default for movies

        if (details.is_tv_show) {
            // TV SHOW LOGIC: Select Episode
            let epText = `📺 *${details.title}*\n\n*Select an Episode:*`;
            details.episodes.slice(0, 20).forEach((ep, i) => { epText += `\n*${i + 1}.* Episode ${ep.ep_num}`; });
            
            const epMsg = await conn.sendMessage(from, {
                image: { url: details.image },
                caption: epText + `\n\nReply episode number\n${footer_text}`
            }, { quoted: selMsg });

            const { msg: epSelMsg, text: epSelText } = await waitForReply(conn, from, epMsg.key.id);
            const epIndex = parseInt(epSelText) - 1;
            if (isNaN(epIndex) || !details.episodes[epIndex]) return reply("❌ Invalid episode");
            downloadUrl = details.episodes[epIndex].link;
            await react(conn, from, epSelMsg.key, "📥");
        }

        // 4️⃣ Get Qualities (Download Links)
        const dlRes = await axios.get(`${API_BASE}?action=download&url=${encodeURIComponent(downloadUrl)}`);
        const dlLinks = dlRes.data?.download_links;
        if (!dlLinks || dlLinks.length === 0) return reply("❌ No download links found for this selection");

        let qText = `🎬 *${details.title}*\n\n*Available Qualities:*`;
        dlLinks.forEach((dl, i) => { qText += `\n*${i + 1}.* ${dl.quality}`; });

        const qMsg = await conn.sendMessage(from, {
            text: qText + `\n\nReply with quality number to start download.\n${footer_text}`
        }, { quoted: selMsg });

        // 5️⃣ Final Download & Send
        const { msg: lastMsg, text: lastText } = await waitForReply(conn, from, qMsg.key.id);
        const qIndex = parseInt(lastText) - 1;
        if (isNaN(qIndex) || !dlLinks[qIndex]) return reply("❌ Invalid quality selection");

        const chosen = dlLinks[qIndex];
        await react(conn, from, lastMsg.key, "⬇️");

        // 6️⃣ Send as Document
        const thumb = details.image ? await makeThumbnail(details.image) : null;
        const finalDoc = await conn.sendMessage(from, {
            document: { url: chosen.direct_link },
            fileName: `${details.title} - ${chosen.quality}.mp4`.replace(/[\/\\:*?"<>|]/g,""),
            mimetype: "video/mp4",
            jpegThumbnail: thumb || undefined,
            caption: `✅ *Download Complete*\n🎬 *${details.title}*\n💎 *Quality:* ${chosen.quality}\n\n${footer_text}`
        }, { quoted: lastMsg });

        await react(conn, from, finalDoc.key, "✅");

    } catch (e) {
        console.error("ANIME DL ERROR:", e);
        reply("⚠️ Error: " + e.message);
    }
});
