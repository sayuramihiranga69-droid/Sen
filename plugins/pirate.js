const { cmd } = require("../command");
const axios = require("axios");
const sharp = require("sharp");

const FOOTER = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌☢️☘";

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

// ───────── Make thumbnail ─────────
async function makeThumbnail(url) {
    try {
        const img = await axios.get(url, { responseType: "arraybuffer" });
        return await sharp(img.data).resize(300).jpeg({ quality: 65 }).toBuffer();
    } catch (e) {
        console.log("Thumbnail error:", e.message);
        return null;
    }
}

// ───────── Pirate search command ─────────
cmd({
    pattern: "pirate",
    desc: "Search Sinhala Movies via Pirate API and send GDrive / Mega download links only",
    category: "downloader",
    react: "🎬",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example: .pirate Green");

        await reply("🔍 Searching Pirate movies...");

        // 1️⃣ Search API
        const searchRes = await axios.get(`https://ty-opal-eta.vercel.app/movie/pirate/search?text=${encodeURIComponent(q)}`);
        const results = searchRes.data?.result?.data;
        if (!results?.length) return reply("❌ No results found");

        // 2️⃣ List top 10
        let listText = "🎬 *Pirate Search Results*\n\n";
        results.slice(0, 10).forEach((v, i) => {
            listText += `*${i + 1}.* ${v.title} | ${v.imdb || "IMDB N/A"}\n`;
        });
        listText += `\nReply with the number to select.\n\n${FOOTER}`;
        const listMsg = await conn.sendMessage(from, { text: listText }, { quoted: m });

        // 3️⃣ Wait for user selection
        const { msg: selMsg, text: selText } = await waitForReply(conn, from, listMsg.key.id);
        const index = parseInt(selText) - 1;
        if (isNaN(index) || !results[index]) return reply("❌ Invalid number");

        const movie = results[index];

        // 4️⃣ Get movie details
        const detailsRes = await axios.get(`https://ty-opal-eta.vercel.app/movie/pirate/movie?url=${encodeURIComponent(movie.link)}`);
        const data = detailsRes.data?.result?.data;
        if (!data) return reply("❌ Failed to fetch movie details");

        const thumb = data.image ? await makeThumbnail(data.image) : null;

        // 5️⃣ Send movie info
        let infoText = `🎬 *${data.title}*\n`;
        infoText += data.imdb ? `⭐ IMDB: ${data.imdb}\n` : "";
        infoText += data.tmdb ? `⭐ TMDB: ${data.tmdb}\n` : "";
        infoText += `📅 Date: ${data.date || "N/A"}\n`;
        infoText += `⏱️ Runtime: ${data.runtime || "N/A"}\n`;
        infoText += `🌎 Country: ${data.country || "N/A"}\n`;
        infoText += `🎭 Genres: ${data.category?.join(", ") || "N/A"}\n\n`;
        infoText += `${data.description?.slice(0, 500) || ""}...\n\n${FOOTER}`;

        await conn.sendMessage(from, { image: { url: data.image }, caption: infoText }, { quoted: selMsg });

        // 6️⃣ Filter GDrive and Mega links only
        const links = data.dl_links?.filter(dl => dl.link.includes("mega.nz") || dl.link.includes("drive.google.com"));
        if (!links?.length) return reply("❌ No GDrive or Mega links available");

        // 7️⃣ Send download links
        let linksText = "📥 *GDrive / Mega Download Links*\n\n";
        links.forEach(dl => {
            linksText += `• ${dl.quality} (${dl.size})\n`;
            linksText += `${dl.link}\n\n`;
        });

        await conn.sendMessage(from, { text: linksText }, { quoted: selMsg });

    } catch (e) {
        console.error("Pirate ERROR:", e);
        reply("⚠️ Error: " + e.message);
    }
});
