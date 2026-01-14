const { cmd } = require("../command");
const axios = require("axios");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const FOOTER = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌☢️☘";
const MEGA_API_KEY = "edbcfabbca5a9750"; // Dark-Shan API KEY

// ───────── GLOBAL REPLY QUEUE (MULTI USER) ─────────
const replyQueue = new Map();

function waitForReply(from, msgId, timeout = 120000) {
    return new Promise((resolve, reject) => {
        const key = `${from}_${msgId}`;
        const timer = setTimeout(() => {
            replyQueue.delete(key);
            reject(new Error("Reply timeout"));
        }, timeout);
        replyQueue.set(key, { resolve, timer });
    });
}

function initReplyListener(conn) {
    conn.ev.on("messages.upsert", update => {
        const msg = update.messages?.[0];
        if (!msg?.message) return;

        const text =
            msg.message.conversation ||
            msg.message?.extendedTextMessage?.text;

        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        if (!ctx?.stanzaId) return;

        const key = `${msg.key.remoteJid}_${ctx.stanzaId}`;
        if (replyQueue.has(key)) {
            const { resolve, timer } = replyQueue.get(key);
            clearTimeout(timer);
            replyQueue.delete(key);
            resolve(text.trim());
        }
    });
}

// ───────── THUMBNAIL ─────────
async function makeThumbnail(url) {
    try {
        const img = await axios.get(url, { responseType: "arraybuffer" });
        return await sharp(img.data).resize(300).jpeg({ quality: 70 }).toBuffer();
    } catch {
        return null;
    }
}

// ───────── PIRATE COMMAND ─────────
cmd({
    pattern: "pirate2",
    desc: "Pirate.lk search + Mega auto download",
    category: "downloader",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    initReplyListener(conn);

    try {
        if (!q) return reply("❗ Example: .pirate Green");

        await reply("🔍 Searching movies...");

        // 1️⃣ SEARCH
        const search = await axios.get(
            `https://ty-opal-eta.vercel.app/movie/pirate/search?text=${encodeURIComponent(q)}`
        );

        const results = search.data?.result?.data;
        if (!results?.length) return reply("❌ No results found");

        let list = "🎬 *Search Results*\n\n";
        results.slice(0, 10).forEach((v, i) => {
            list += `*${i + 1}.* ${v.title}\n`;
        });
        list += `\nReply number\n\n${FOOTER}`;

        const listMsg = await conn.sendMessage(from, { text: list }, { quoted: m });

        // 2️⃣ MOVIE SELECT
        const movieIndex = parseInt(await waitForReply(from, listMsg.key.id)) - 1;
        if (!results[movieIndex]) return reply("❌ Invalid selection");

        const movie = results[movieIndex];

        // 3️⃣ MOVIE DETAILS
        const details = await axios.get(
            `https://ty-opal-eta.vercel.app/movie/pirate/movie?url=${encodeURIComponent(movie.link)}`
        );

        const data = details.data?.result?.data;
        if (!data) return reply("❌ Details fetch failed");

        const thumb = await makeThumbnail(data.image);

        let info = `🎬 *${data.title}*\n`;
        if (data.imdb) info += `⭐ IMDB: ${data.imdb}\n`;
        info += `⏱️ ${data.runtime}\n`;
        info += `🎭 ${data.category.join(", ")}\n\n`;
        info += `${FOOTER}`;

        const infoMsg = await conn.sendMessage(
            from,
            { image: { url: data.image }, caption: info },
            { quoted: m }
        );

        // 4️⃣ MEGA LINKS ONLY
        const megaLinks = data.dl_links.filter(v => v.link.includes("mega.nz"));
        if (!megaLinks.length) return reply("❌ No Mega links");

        let qText = "🎞️ *Select Quality*\n\n";
        megaLinks.forEach((v, i) => {
            qText += `*${i + 1}.* ${v.quality} (${v.size})\n`;
        });
        qText += `\nReply number\n\n${FOOTER}`;

        const qMsg = await conn.sendMessage(from, { text: qText }, { quoted: infoMsg });

        // 5️⃣ QUALITY SELECT
        const qIndex = parseInt(await waitForReply(from, qMsg.key.id)) - 1;
        if (!megaLinks[qIndex]) return reply("❌ Invalid quality");

        const megaUrl = megaLinks[qIndex].link;

        await reply("⬇️ Downloading from Mega...");

        // 6️⃣ MEGA REAL FILE
        const megaApi = await axios.get(
            `https://api-dark-shan-yt.koyeb.app/download/meganz?url=${encodeURIComponent(megaUrl)}&apikey=${MEGA_API_KEY}`
        );

        const file = megaApi.data?.data?.result?.[0];
        if (!file?.download) return reply("❌ Mega failed");

        const filePath = path.join(__dirname, file.name);
        const writer = fs.createWriteStream(filePath);

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

        // 7️⃣ SEND FILE
        await conn.sendMessage(from, {
            document: fs.readFileSync(filePath),
            fileName: file.name,
            mimetype: "video/x-matroska",
            jpegThumbnail: thumb,
            caption: `🎬 ${data.title}\n📦 ${(file.size / 1024 / 1024).toFixed(1)} MB\n\n${FOOTER}`
        }, { quoted: m });

        fs.unlinkSync(filePath);

    } catch (e) {
        console.error("PIRATE ERROR:", e);
        reply("⚠️ Error occurred");
    }
});
