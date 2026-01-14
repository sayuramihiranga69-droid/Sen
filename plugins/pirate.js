const { cmd } = require("../command");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const MEGA_API_KEY = "edbcfabbca5a9750"; // Dark-Shan API key
const FOOTER = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌☢️☘";

// ───────── Wait for reply helper ─────────
function waitForReply(conn, from, replyToId, timeout = 120000) {
    return new Promise((resolve, reject) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;

            const ctx = msg.message?.extendedTextMessage?.contextInfo;
            const text =
                msg.message.conversation ||
                msg.message?.extendedTextMessage?.text;

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

// ───────── Thumbnail maker ─────────
async function makeThumbnail(url) {
    try {
        const img = await axios.get(url, { responseType: "arraybuffer" });
        return await sharp(img.data)
            .resize(300)
            .jpeg({ quality: 65 })
            .toBuffer();
    } catch {
        return null;
    }
}

// ───────── Pirate command ─────────
cmd({
    pattern: "pirate",
    desc: "Search Pirate movies and auto download Mega file",
    category: "downloader",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example: `.pirate Jolly`");

        await reply("🔍 Searching Pirate movies...");

        // 1️⃣ SEARCH
        const searchRes = await axios.get(
            `https://ty-opal-eta.vercel.app/movie/pirate/search?text=${encodeURIComponent(q)}`
        );

        const results = searchRes.data?.result?.data;
        if (!results?.length) return reply("❌ No results found");

        let list = "🎬 *Search Results*\n\n";
        results.slice(0, 10).forEach((v, i) => {
            list += `*${i + 1}.* ${v.title}\n`;
        });
        list += `\nReply with number\n\n${FOOTER}`;

        const listMsg = await conn.sendMessage(from, { text: list }, { quoted: m });

        // 2️⃣ SELECT MOVIE
        const selIndex = parseInt(await waitForReply(conn, from, listMsg.key.id)) - 1;
        if (!results[selIndex]) return reply("❌ Invalid selection");

        const movie = results[selIndex];

        // 3️⃣ MOVIE DETAILS
        const detailRes = await axios.get(
            `https://ty-opal-eta.vercel.app/movie/pirate/movie?url=${encodeURIComponent(movie.link)}`
        );

        const data = detailRes.data?.result?.data;
        if (!data) return reply("❌ Movie details not found");

        // 4️⃣ FILTER MEGA LINKS
        const megaLinks = data.dl_links?.filter(v => v.link.includes("mega.nz"));
        if (!megaLinks?.length) return reply("❌ No Mega links available");

        let qText = "📥 *Select Quality*\n\n";
        megaLinks.forEach((v, i) => {
            qText += `*${i + 1}.* ${v.quality} (${v.size})\n`;
        });
        qText += `\nReply with number\n\n${FOOTER}`;

        const qMsg = await conn.sendMessage(from, { text: qText }, { quoted: m });

        // 5️⃣ SELECT QUALITY
        const qIndex = parseInt(await waitForReply(conn, from, qMsg.key.id)) - 1;
        if (!megaLinks[qIndex]) return reply("❌ Invalid quality");

        const megaUrl = megaLinks[qIndex].link;

        // 6️⃣ INFO CARD
        const thumb = data.image ? await makeThumbnail(data.image) : null;

        await conn.sendMessage(from, {
            image: { url: data.image },
            caption: `🎬 *${data.title}*\n🎞️ ${megaLinks[qIndex].quality}\n\n⬆️ Downloading...\n\n${FOOTER}`
        }, { quoted: m });

        // 7️⃣ MEGA API → REAL FILE LINK
        const megaApi = await axios.get(
            `https://api-dark-shan-yt.koyeb.app/download/meganz?url=${encodeURIComponent(megaUrl)}&apikey=${MEGA_API_KEY}`
        );

        const file = megaApi.data?.data?.result?.[0];
        if (!file?.download) return reply("❌ Mega download failed");

        // 8️⃣ DOWNLOAD FILE
        const tempPath = path.join(__dirname, file.name);
        const writer = fs.createWriteStream(tempPath);

        const stream = await axios({
            url: file.download,
            method: "GET",
            responseType: "stream"
        });

        stream.data.pipe(writer);
        await new Promise((res, rej) => {
            writer.on("finish", res);
            writer.on("error", rej);
        });

        // 9️⃣ SEND DOCUMENT
        await conn.sendMessage(from, {
            document: fs.readFileSync(tempPath),
            fileName: file.name,
            mimetype: "video/x-matroska",
            jpegThumbnail: thumb || undefined,
            caption: `📥 *Download Complete*\n\n${FOOTER}`
        }, { quoted: m });

        fs.unlinkSync(tempPath);

    } catch (e) {
        console.error("PIRATE ERROR:", e);
        reply("⚠️ Error: " + e.message);
    }
});
