const { cmd } = require("../command");
const axios = require("axios");

const XN_FOOTER = "✫☘ 𝐒𝐀𝐘𝐔𝐑𝐀 𝐌𝐃 𝐗-𝐒𝐄𝐀𝐑𝐂𝐇 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐑 ☢️☘";
const SRIHUB_KEY = "dew_YyT0KDc2boHDasFlmZCqDcPoeDHReD20aYmEsm1G";
const SEARCH_API = "https://api.srihub.store/nsfw/xnxxsearch";
const DOWNLOAD_API = "https://api.srihub.store/nsfw/xnxxdl";

// ───────── Ultra Smart Waiter ─────────
function waitForReply(conn, from, sender, targetId) {
    return new Promise((resolve) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;

            const text = msg.message.conversation || msg.message?.extendedTextMessage?.text || "";
            const context = msg.message?.extendedTextMessage?.contextInfo;
            const msgSender = msg.key.participant || msg.key.remoteJid;
            
            const isTargetReply = context?.stanzaId === targetId;
            const isCorrectUser = msgSender.includes(sender.split('@')[0]) || msgSender.includes("@lid");

            if (msg.key.remoteJid === from && isCorrectUser && isTargetReply && !isNaN(text)) {
                conn.ev.off("messages.upsert", handler);
                resolve({ msg, text: text.trim() });
            }
        };
        conn.ev.on("messages.upsert", handler);
        setTimeout(() => { conn.ev.off("messages.upsert", handler); }, 300000); // 5 Minutes
    });
}

cmd({
    pattern: "xnxx2",
    alias: ["xsearch", "xn"],
    desc: "Search and download xnxx videos",
    category: "nsfw",
    react: "🔞",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ කරුණාකර සෙවිය යුතු නමක් (Query) ඇතුළත් කරන්න.");

        // 1. සෙවුම් ප්‍රතිඵල ලබා ගැනීම
        const searchRes = await axios.get(`${SEARCH_API}?q=${encodeURIComponent(q)}&apikey=${SRIHUB_KEY}`);
        const results = searchRes.data?.results?.result;

        if (!results || results.length === 0) return reply("❌ කිසිවක් හමු නොවීය.");

        let listText = "🔞 *𝐗𝐍𝐗𝐗 𝐒𝐄𝐀𝐑𝐂𝐇 𝐑𝐄𝐒𝐔𝐋𝐓𝐒*\n\n";
        results.slice(0, 15).forEach((v, i) => {
            listText += `*${i + 1}.* ${v.title}\n   _⏱️ ${v.duration} | 👁️ ${v.views}_\n\n`;
        });

        const sentSearch = await conn.sendMessage(from, { 
            text: listText + `කරුණාකර ඔබට අවශ්‍ය අංකය Reply කරන්න.` 
        }, { quoted: m });

        // --- ස්වාධීන පාලනය (Search Flow) ---
        const startFlow = async () => {
            const selection = await waitForReply(conn, from, sender, sentSearch.key.id);
            if (!selection) return;

            const idx = parseInt(selection.text) - 1;
            const selectedVideo = results[idx];
            if (!selectedVideo) return reply("❌ වැරදි අංකයකි.");

            await conn.sendMessage(from, { react: { text: "⏳", key: selection.msg.key } });

            try {
                // 2. වීඩියෝවේ බාගත කිරීමේ ලින්ක් ලබා ගැනීම
                const dlRes = await axios.get(`${DOWNLOAD_API}?url=${encodeURIComponent(selectedVideo.link)}&apikey=${SRIHUB_KEY}`);
                const data = dlRes.data?.results;

                if (!data) return reply("❌ බාගත කිරීමේ ලින්ක් ලබා ගත නොහැක.");

                let qualityText = `🎥 *${data.title}*\n\n` +
                                 `*1.* High Quality (MP4)\n` +
                                 `*2.* Low Quality (3GP)\n\n` +
                                 `ඔබට අවශ්‍ය ගුණාත්මක භාවයේ (Quality) අංකය Reply කරන්න.`;

                const sentQual = await conn.sendMessage(from, { 
                    image: { url: data.image }, 
                    caption: qualityText 
                }, { quoted: selection.msg });

                const qSel = await waitForReply(conn, from, sender, sentQual.key.id);
                if (!qSel) return;

                const videoUrl = qSel.text === "1" ? data.files.high : data.files.low;
                
                await conn.sendMessage(from, { react: { text: "📥", key: qSel.msg.key } });

                // 3. වීඩියෝව Document එකක් ලෙස යැවීම
                await conn.sendMessage(from, {
                    document: { url: videoUrl },
                    fileName: `${data.title}.mp4`,
                    mimetype: "video/mp4",
                    caption: `✅ *Download Complete*\n🎬 *${data.title}*\n\n${XN_FOOTER}`
                }, { quoted: qSel.msg });

            } catch (err) {
                console.error(err);
                reply("❌ බාගත කිරීමේදී දෝෂයක් සිදු විය.");
            }
        };

        startFlow();

    } catch (e) {
        console.log(e);
        reply("❌ පද්ධතියේ දෝෂයක් පවතී.");
    }
});
