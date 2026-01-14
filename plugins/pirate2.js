const { cmd } = require("../command");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const FOOTER = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌☢️☘";
const API_KEY = "edbcfabbca5a9750";

const sessions = new Map();

async function reactMsg(conn, jid, key, emoji) {
    try {
        await conn.sendMessage(jid, {
            react: {
                text: emoji,
                key: key
            }
        });
    } catch (e) {
        console.log("React error:", e.message);
    }
}

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
    pattern: "pirate2",
    desc: "Search Sinhala Movies via Pirate API with Mega download and react support",
    category: "downloader",
    react: "🎬",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example: .pirate Green");

        await reactMsg(conn, from, m.key, "⏳");
        await reply("🔍 Searching Pirate movies...");

        const searchRes = await axios.get(`https://ty-opal-eta.vercel.app/movie/pirate/search?text=${encodeURIComponent(q)}`);
        const results = searchRes.data?.result?.data;
        if (!results?.length) return reply("❌ No results found");

        sessions.set(from, { stage: "selectMovie", results });
        let listText = "🎬 *Search Results*\n\n";
        results.slice(0, 10).forEach((v, i) => {
            listText += `*${i + 1}.* ${v.title} | ${v.imdb || "IMDB N/A"}\n`;
        });
        listText += `\nReply number to select a movie.\n\n${FOOTER}`;

        const listMsg = await conn.sendMessage(from, { text: listText }, { quoted: m });
        await reactMsg(conn, from, listMsg.key, "🎬"); // React to movie list
    } catch (e) {
        console.error("Pirate SEARCH ERROR:", e);
        reply("⚠️ Error: " + e.message);
    }
});

// ───────── Handle multi-stage replies with react ─────────
cmd({
    pattern: ".*",
    fromMe: false,
    desc: "Handle replies for movie selection, quality, and auto-download with react",
    filename: __filename,
}, async (conn, mek, m, { from, reply }) => {
    try {
        const session = sessions.get(from);
        if (!session) return;

        const text = m.message.conversation || m.message?.extendedTextMessage?.text;

        // Stage 1: Movie selection
        if (session.stage === "selectMovie") {
            const index = parseInt(text) - 1;
            if (isNaN(index) || !session.results[index]) return reply("❌ Invalid number");
            const movie = session.results[index];

            const detailsRes = await axios.get(`https://ty-opal-eta.vercel.app/movie/pirate/movie?url=${encodeURIComponent(movie.link)}`);
            const data = detailsRes.data?.result?.data;
            if (!data) return reply("❌ Failed to fetch movie details");

            session.movie = data;
            session.stage = "selectQuality";
            sessions.set(from, session);

            let qualityText = "🎞️ *Select Quality*\n\n";
            (data.dl_links || []).forEach((dl, i) => {
                qualityText += `*${i + 1}.* ${dl.quality} (${dl.size})\n`;
            });
            qualityText += `\nReply number to select quality.\n\n${FOOTER}`;

            const qualMsg = await conn.sendMessage(from, { text: qualityText }, { quoted: m });
            await reactMsg(conn, from, qualMsg.key, "🎞️"); // React to quality options
        }

        // Stage 2: Quality selection + Mega download
        else if (session.stage === "selectQuality") {
            const qIndex = parseInt(text) - 1;
            const movie = session.movie;
            if (!movie.dl_links?.[qIndex]) return reply("❌ Invalid number");

            const selectedDL = movie.dl_links[qIndex];
            if (!selectedDL.link.includes("mega.nz")) return reply("❌ Selected link is not Mega");

            session.stage = null;
            sessions.set(from, null);

            let infoText = `🎬 *${movie.title}*\n`;
            infoText += movie.imdb ? `⭐ IMDB: ${movie.imdb}\n` : "";
            infoText += movie.tmdb ? `⭐ TMDB: ${movie.tmdb}\n` : "";
            infoText += `📅 Date: ${movie.date || "N/A"}\n`;
            infoText += `⏱️ Runtime: ${movie.runtime || "N/A"}\n`;
            infoText += `🌎 Country: ${movie.country || "N/A"}\n`;
            infoText += `🎭 Genres: ${movie.category?.join(", ") || "N/A"}\n\n${FOOTER}`;

            await conn.sendMessage(from, { image: { url: movie.image }, caption: infoText }, { quoted: m });
            await reactMsg(conn, from, m.key, "✅"); // React info card

            await reply("⬇️ Downloading file from Mega...");
            await reactMsg(conn, from, m.key, "⬇️"); // React download start

            // Mega API
            const apiUrl = `https://api-dark-shan-yt.koyeb.app/download/meganz?url=${encodeURIComponent(selectedDL.link)}&apikey=${API_KEY}`;
            const res = await axios.get(apiUrl);
            if (!res.data.status) return reply("❌ Mega API error");

            const file = res.data.data.result[0];
            if (!file?.download) return reply("❌ Download link not found");

            const tempPath = path.join(__dirname, file.name);
            const writer = fs.createWriteStream(tempPath);

            const downloadRes = await axios({
                url: file.download,
                method: "GET",
                responseType: "stream"
            });
            downloadRes.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on("finish", resolve);
                writer.on("error", reject);
            });

            await conn.sendMessage(from, {
                document: fs.readFileSync(tempPath),
                fileName: file.name,
                mimetype: "video/x-matroska",
                caption: `📥 Download Complete\n📁 ${file.name}\n📦 Size: ${(file.size / 1024 / 1024).toFixed(2)} MB\n\n${FOOTER}`
            }, { quoted: m });
            await reactMsg(conn, from, m.key, "✅"); // React file sent

            fs.unlinkSync(tempPath);
        }

    } catch (e) {
        console.error("Pirate REPLY ERROR:", e);
        reply("⚠️ Error: " + e.message);
    }
});
