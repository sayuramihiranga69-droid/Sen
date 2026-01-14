const { cmd } = require("../command");
const axios = require("axios");
const sharp = require("sharp");

const FOOTER = "✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌☢️☘";

// ───────── User session store ─────────
const sessions = new Map();

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
    desc: "Search Sinhala Movies via Pirate API and send Mega download links only",
    category: "downloader",
    react: "🎬",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Example: .pirate Green");

        await reply("🔍 Searching Pirate movies...");
        const searchRes = await axios.get(`https://ty-opal-eta.vercel.app/movie/pirate/search?text=${encodeURIComponent(q)}`);
        const results = searchRes.data?.result?.data;
        if (!results?.length) return reply("❌ No results found");

        // Save session
        sessions.set(from, { stage: "selectMovie", results });

        // Send top 10 list
        let listText = "🎬 *Search Results*\n\n";
        results.slice(0, 10).forEach((v, i) => {
            listText += `*${i + 1}.* ${v.title} | ${v.imdb || "IMDB N/A"}\n`;
        });
        listText += `\nReply number to select a movie.\n\n${FOOTER}`;
        await conn.sendMessage(from, { text: listText }, { quoted: m });

    } catch (e) {
        console.error("Pirate SEARCH ERROR:", e);
        reply("⚠️ Error: " + e.message);
    }
});

// ───────── Handle replies for multi-stage ─────────
cmd({
    pattern: ".*",
    fromMe: false,
    desc: "Handle replies for movie selection and quality",
    filename: __filename,
}, async (conn, mek, m, { from, reply }) => {
    try {
        const session = sessions.get(from);
        if (!session) return; // No active session

        const text = m.message.conversation || m.message?.extendedTextMessage?.text;

        // Stage 1: Movie selection
        if (session.stage === "selectMovie") {
            const index = parseInt(text) - 1;
            if (isNaN(index) || !session.results[index]) return reply("❌ Invalid number");
            const movie = session.results[index];

            // Fetch details
            const detailsRes = await axios.get(`https://ty-opal-eta.vercel.app/movie/pirate/movie?url=${encodeURIComponent(movie.link)}`);
            const data = detailsRes.data?.result?.data;
            if (!data) return reply("❌ Failed to fetch movie details");

            session.movie = data;
            session.stage = "selectQuality";
            sessions.set(from, session);

            // Send quality options
            let qualityText = "🎞️ *Select Quality*\n\n";
            (data.dl_links || []).forEach((dl, i) => {
                qualityText += `*${i + 1}.* ${dl.quality} (${dl.size})\n`;
            });
            qualityText += `\nReply number to select quality.\n\n${FOOTER}`;
            await conn.sendMessage(from, { text: qualityText }, { quoted: m });
        }

        // Stage 2: Quality selection
        else if (session.stage === "selectQuality") {
            const qIndex = parseInt(text) - 1;
            const movie = session.movie;
            if (!movie.dl_links?.[qIndex]) return reply("❌ Invalid number");

            const selectedDL = movie.dl_links[qIndex];
            if (!selectedDL.link.includes("mega.nz")) return reply("❌ Selected link is not Mega");

            session.stage = null; // End session
            sessions.set(from, null);

            // Send info + thumbnail
            const thumb = movie.image ? await makeThumbnail(movie.image) : null;
            let infoText = `🎬 *${movie.title}*\n`;
            infoText += movie.imdb ? `⭐ IMDB: ${movie.imdb}\n` : "";
            infoText += movie.tmdb ? `⭐ TMDB: ${movie.tmdb}\n` : "";
            infoText += `📅 Date: ${movie.date || "N/A"}\n`;
            infoText += `⏱️ Runtime: ${movie.runtime || "N/A"}\n`;
            infoText += `🌎 Country: ${movie.country || "N/A"}\n`;
            infoText += `🎭 Genres: ${movie.category?.join(", ") || "N/A"}\n\n${FOOTER}`;

            await conn.sendMessage(from, { image: { url: movie.image }, caption: infoText }, { quoted: m });

            // Send Mega link + info
            let dlText = `⬇️ Downloading from Mega...\n\nQuality: ${selectedDL.quality}\nSize: ${selectedDL.size}\nLink: ${selectedDL.link}`;
            await conn.sendMessage(from, { text: dlText }, { quoted: m });
        }

    } catch (e) {
        console.error("Pirate REPLY ERROR:", e);
        reply("⚠️ Error: " + e.message);
    }
});
