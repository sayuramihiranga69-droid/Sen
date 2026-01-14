const { cmd } = require("../command");
const axios = require("axios");
const fg = require("api-dylux");
const sharp = require("sharp");

const SRIHUB_FOOTER = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌𝐄☢️☘";

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

// ───────── Create thumbnail ─────────
async function makeThumbnail(url) {
    try {
        const img = await axios.get(url, { responseType: "arraybuffer" });
        return await sharp(img.data).resize(300).jpeg({ quality: 65 }).toBuffer();
    } catch (e) {
        console.log("Thumbnail error:", e.message);
        return null;
    }
}

// ───────── Moviesub command ─────────
cmd({
    pattern: "moviesub",
    desc: "Search Sinhala Movies with Subtitles (SriHub API) and send GDrive file as WhatsApp document",
    category: "downloader",
    react: "🎬",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example: .moviesub Stranger Things");

        await reply("🔍 Searching movies...");

        // 1️⃣ Search
        const searchRes = await axios.get(`https://api.srihub.store/movie/moviesub?q=${encodeURIComponent(q)}&apikey=dew_B59NylJtdTt6KmCaDpLt5VXWo1aohDRyRblCDlc7`);
        const results = searchRes.data?.result;
        if (!results?.length) return reply("❌ No results found");

        // 2️⃣ List top 10
        let listText = "🎬 *Search Results*\n\n";
        results.slice(0, 10).forEach((v, i) => listText += `*${i + 1}.* ${v.title}\n`);
        listText += `\nReply with the number to select.\n\n${SRIHUB_FOOTER}`;
        const listMsg = await conn.sendMessage(from, { text: listText }, { quoted: m });

        // 3️⃣ Wait for selection
        const { msg: selMsg, text: selText } = await waitForReply(conn, from, listMsg.key.id);
        const index = parseInt(selText) - 1;
        if (isNaN(index) || !results[index]) return reply("❌ Invalid number");

        const movie = results[index];

        // 4️⃣ Get download links
        const dlRes = await axios.get(`https://api.srihub.store/movie/moviesubdl?url=${encodeURIComponent(movie.url)}&apikey=dew_B59NylJtdTt6KmCaDpLt5VXWo1aohDRyRblCDlc7`);
        const dl = dlRes.data?.result?.downloads;
        if (!dl || (!dl.gdrive && !dl.telegram)) return reply("❌ No download links found");

        // 5️⃣ Create thumbnail
        const thumb = movie.thumbnail ? await makeThumbnail(movie.thumbnail) : null;

        // 6️⃣ Send movie info + thumbnail
        let infoText = `🎬 *${movie.title}*\n\n`;
        if (dl.gdrive) infoText += `🌐 GDrive Available\n`;
        if (dl.telegram) infoText += `📲 Telegram Available\n`;
        infoText += `\n${SRIHUB_FOOTER}`;

        await conn.sendMessage(from, { image: { url: movie.thumbnail }, caption: infoText }, { quoted: selMsg });

        // 7️⃣ Send GDrive file if available
        if (dl.gdrive) {
            // Fix GDrive link
            let gdriveLink = dl.gdrive.replace('https://drive.usercontent.google.com/download?id=', 'https://drive.google.com/file/d/').replace('&export=download', '/view');

            // Uploading message
            const uploadingMsg = await conn.sendMessage(from, { text: '⬆️ Uploading your movie, please wait...' }, { quoted: selMsg });

            // Download info
            let res = await fg.GDriveDl(gdriveLink);

            // Delete uploading message
            await conn.sendMessage(from, { delete: uploadingMsg.key });

            // Send file
            await conn.sendMessage(from, {
                document: { url: res.downloadUrl },
                fileName: res.fileName,
                mimetype: res.mimetype,
                jpegThumbnail: thumb || undefined,
                caption: res.fileName.replace('[Cinesubz.co]', '') + '\n\n> *•Sayura-MD•*'
            }, { quoted: selMsg });

        } else if (dl.telegram) {
            // Telegram link if GDrive not available
            await conn.sendMessage(from, { text: `📲 Telegram: ${dl.telegram}` }, { quoted: selMsg });
        }

    } catch (e) {
        console.error("MOVIESUB ERROR:", e);
        reply("⚠️ Error:\n" + e.message);
    }
});
