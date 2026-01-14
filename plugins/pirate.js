const { cmd } = require("../command");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const MEGA_API_KEY = "edbcfabbca5a9750";
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
                resolve(text.trim());
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
    } catch {
        return null;
    }
}

// ───────── Pirate search + download ─────────
cmd({
    pattern: "pirate",
    desc: "Search Pirate movies + info card + Mega qualities + auto download",
    category: "downloader",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example: `.pirate Jolly`");

        await reply("🔍 Searching Pirate movies...");

        // 1️⃣ Search API
        const searchRes = await axios.get(
            `https://ty-opal-eta.vercel.app/movie/pirate/search?text=${encodeURIComponent(q)}`
        );
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
        const selText = await waitForReply(conn, from, listMsg.key.id);
        const index = parseInt(selText) - 1;
        if (isNaN(index) || !results[index]) return reply("❌ Invalid number");

        const movie = results[index];

        // 4️⃣ Get movie details
        const detailsRes = await axios.get(
            `https://ty-opal-eta.vercel.app/movie/pirate/movie?url=${encodeURIComponent(movie.link)}`
        );
        const data = detailsRes.data?.result?.data;
        if (!data) return reply("❌ Failed to fetch movie details");

        const thumb = data.image ? await makeThumbnail(data.image) : null;

        // 5️⃣ Send movie info card
        let infoText = `🎬 *${data.title}*\n`;
        if (data.imdb) infoText += `⭐ IMDB: ${data.imdb}\n`;
        if (data.tmdb) infoText += `⭐ TMDB: ${data.tmdb}\n`;
        infoText += `📅 Date: ${data.date || "N/A"}\n`;
        infoText += `⏱️ Runtime: ${data.runtime || "N/A"}\n`;
        infoText += `🌎 Country: ${data.country || "N/A"}\n`;
        infoText += `🎭 Genres: ${data.category?.join(", ") || "N/A"}\n\n`;
        infoText += `${data.description?.slice(0, 500) || ""}...\n\n${FOOTER}`;

        await conn.sendMessage(from, { image: { url: data.image }, caption: infoText }, { quoted: m });

        // 6️⃣ Filter Mega links only
        const megaLinks = data.dl_links?.filter(dl => dl.link.includes("mega.nz"));
        if (!megaLinks?.length) return reply("❌ No Mega links available");

        // 7️⃣ List Mega qualities
        let qualityText = "📥 *Available Mega Qualities*\n\n";
        megaLinks.forEach((dl, i) => {
            qualityText += `*${i + 1}.* ${dl.quality} (${dl.size})\n`;
        });
        qualityText += `\nReply with the number to download\n\n${FOOTER}`;
        const qualityMsg = await conn.sendMessage(from, { text: qualityText }, { quoted: m });

        // 8️⃣ Wait for quality selection
        const qSel = await waitForReply(conn, from, qualityMsg.key.id);
        const qIndex = parseInt(qSel) - 1;
        if (isNaN(qIndex) || !megaLinks[qIndex]) return reply("❌ Invalid quality number");

        const file = megaLinks[qIndex];

        // 9️⃣ Download via Dark-Shan Mega API
        await reply(`🔄 Downloading *${file.quality}*...`);
        const apiRes = await axios.get(
            `https://api-dark-shan-yt.koyeb.app/download/meganz?url=${encodeURIComponent(file.link)}&apikey=${MEGA_API_KEY}`
        );

        const dlFile = apiRes.data?.data?.result?.[0];
        if (!dlFile?.download) return reply("❌ Failed to get download link");

        const tempPath = path.join(__dirname, dlFile.name);
        const writer = fs.createWriteStream(tempPath);

        const downloadRes = await axios({
            url: dlFile.download,
            method: "GET",
            responseType: "stream"
        });

        downloadRes.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        // 10️⃣ Send file
        await conn.sendMessage(from, {
            document: fs.readFileSync(tempPath),
            fileName: dlFile.name,
            mimetype: "video/x-matroska",
            jpegThumbnail: thumb || undefined,
            caption: `📥 *Downloaded: ${dlFile.name}*\n📦 Size: ${(dlFile.size / 1024 / 1024).toFixed(2)} MB\n\n${FOOTER}`
        }, { quoted: m });

        fs.unlinkSync(tempPath);

    } catch (e) {
        console.error("Pirate ERROR:", e);
        reply("⚠️ Error: " + e.message);
    }
});
