const { cmd } = require("../command");
const axios = require("axios");
const yts = require("yt-search");

const FOOTER = "🎧 𝐒𝐀𝐘𝐔𝐑𝐀 𝐒𝐎𝐔𝐍𝐃 𝐒𝐘𝐒𝐓𝐄𝐌 🎧";

// ───────── Smart Waiter (Reply OR normal number) ─────────
function waitForReply(conn, from, sender, targetId) {
    return new Promise((resolve) => {
        let finished = false;

        const handler = (update) => {
            if (finished) return;

            const msg = update.messages?.[0];
            if (!msg?.message) return;

            const text =
                msg.message.conversation ||
                msg.message?.extendedTextMessage?.text ||
                "";

            if (!text || isNaN(text)) return;

            const context = msg.message?.extendedTextMessage?.contextInfo;
            const msgSender = msg.key.participant || msg.key.remoteJid;

            const sameChat = msg.key.remoteJid === from;
            const sameUser = msgSender === sender;
            const isReply = context?.stanzaId === targetId;

            if (sameChat && sameUser && (isReply || !context)) {
                finished = true;
                conn.ev.off("messages.upsert", handler);
                resolve({ msg, text: text.trim() });
            }
        };

        conn.ev.on("messages.upsert", handler);

        setTimeout(() => {
            if (finished) return;
            finished = true;
            conn.ev.off("messages.upsert", handler);
            resolve(null);
        }, 300000); // 5 minutes
    });
}

// ───────── Command ─────────
cmd({
    pattern: "song",
    alias: ["audio", "ytsong"],
    desc: "YouTube Song Downloader",
    category: "downloader",
    react: "🎧",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ සින්දුවේ නම හෝ YouTube link එකක් දෙන්න.");

        // 🔍 Search YouTube
        const search = await yts(q);
        const results = search.videos.slice(0, 10);

        if (!results.length) return reply("❌ සින්දු හමු නොවීය.");

        let list = `🎧 *YOUTUBE SOUND SEARCH*\n\n`;
        results.forEach((v, i) => {
            list += `*${i + 1}.* ${v.title} (${v.timestamp})\n`;
        });

        const sentMsg = await conn.sendMessage(
            from,
            { text: list + `\n🔢 අංකය send කරන්න` },
            { quoted: m }
        );

        // ⏳ Wait for user selection
        const selection = await waitForReply(
            conn,
            from,
            sender,
            sentMsg.key.id
        );

        if (!selection)
            return reply("⌛ කාලය ඉකුත් විය. නැවත උත්සාහ කරන්න.");

        const idx = Number(selection.text) - 1;
        if (idx < 0 || idx >= results.length)
            return reply("❌ වැරදි අංකයකි.");

        const video = results[idx];

        await conn.sendMessage(from, {
            react: { text: "⏳", key: selection.msg.key },
        });

        // 🎵 Download API
        const apiUrl = `https://api-dark-shan-yt.koyeb.app/download/ytmp3?url=${encodeURIComponent(
            video.url
        )}&apikey=edbcfabbca5a9750`;

        const apiRes = await axios.get(apiUrl, { timeout: 120000 });
        if (!apiRes.data?.status)
            return reply("❌ Download link එක ලබාගැනීමට බැරි විය.");

        const data = apiRes.data.data;

        // ⬇️ BUFFER AUDIO (WhatsApp SAFE)
        const audioRes = await axios.get(data.download, {
            responseType: "arraybuffer",
            timeout: 180000,
        });

        const audioBuffer = Buffer.from(audioRes.data);

        // ⚠️ Size limit safety (16MB)
        if (audioBuffer.length > 16 * 1024 * 1024) {
            return reply("❌ Audio file එක විශාලයි (16MB limit).");
        }

        // 📤 Send audio
        await conn.sendMessage(
            from,
            {
                audio: audioBuffer,
                mimetype: "audio/mpeg",
                fileName: `${data.title}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        title: data.title,
                        body: FOOTER,
                        thumbnailUrl: video.thumbnail,
                        sourceUrl: video.url,
                        mediaType: 1,
                        renderLargerThumbnail: true,
                    },
                },
            },
            { quoted: selection.msg }
        );

        await conn.sendMessage(from, {
            react: { text: "✅", key: selection.msg.key },
        });
    } catch (e) {
        console.error("SONG CMD ERROR:", e);
        if (e.code === "ECONNABORTED") {
            reply("⏱ Server delay. ටිකකින් නැවත උත්සාහ කරන්න.");
        } else {
            reply("❌ Error එකක් සිදු විය.");
        }
    }
});
