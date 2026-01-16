const { cmd } = require("../command");
const axios = require("axios");

// ----- Reply එක ගන්න Function එක -----
function waitForReply(conn, from, replyToId, timeout = 120000) {
    return new Promise((resolve, reject) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;
            const ctx = msg.message?.extendedTextMessage?.contextInfo;
            const text = msg.message.conversation || msg.message?.extendedTextMessage?.text;
            if (msg.key.remoteJid === from && ctx?.stanzaId === replyToId) {
                conn.ev.off("messages.upsert", handler);
                resolve({ text: text?.trim() });
            }
        };
        conn.ev.on("messages.upsert", handler);
        setTimeout(() => {
            conn.ev.off("messages.upsert", handler);
            reject(new Error("Timeout"));
        }, timeout);
    });
}

cmd({
    pattern: "movie",
    alias: ["movie5"],
    desc: "Search movies without visible commands",
    category: "downloader",
    react: "🎬",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ කරුණාකර සෙවිය යුතු නම ලබා දෙන්න.");

        let menu = `🎬 *SAYURA MD MOVIE ENGINE* 🎬\n\n` +
            `🔍 සෙවුම: *${q}*\n\n` +
            `1. Sinhalasub\n` +
            `2. Cinesubz\n` +
            `3. Dinka Sinhalasub\n` +
            `4. SL Anime Club\n` +
            `5. Pirate.lk\n` +
            `6. Moviesublk\n\n` +
            `Reply with a number.\n\nSAYURA MD`;

        const listMsg = await conn.sendMessage(from, { text: menu }, { quoted: m });

        // 1. අංකය ලැබෙනකන් ඉන්නවා
        const { text: selText } = await waitForReply(conn, from, listMsg.key.id);
        
        // 2. අංකය අනුව API එක තෝරනවා
        let sitePath = "";
        if (selText === '1') sitePath = "sinhalasub";
        else if (selText === '2') sitePath = "cinesubsk";
        else if (selText === '3') sitePath = "dinka";
        else if (selText === '4') sitePath = "anime";
        else if (selText === '5') sitePath = "pirate";
        else if (selText === '6') sitePath = "moviesub";
        else return reply("❌ වැරදි අංකයක්.");

        await react(conn, from, m.key, "🔍");

        // 3. මෙතනදී කෙලින්ම API එකට Call එක දෙනවා (Hide එකේ වැඩේ වෙන්නේ මෙහෙමයි)
        // මම මේ උදාහරණයට ගත්තේ ඔයා කලින් එවපු Srihub API එක
        const response = await axios.get(`https://api.srihub.store/movie/${sitePath}?q=${encodeURIComponent(q)}&apikey=${API_KEY}`);
        const results = response.data?.result;

        if (!results || results.length === 0) return reply("❌ කිසිවක් හමු නොවීය.");

        // 4. දැන් කෙලින්ම Result ලිස්ට් එක පෙන්වනවා
        let resText = `🎬 *RESULTS FROM ${sitePath.toUpperCase()}*\n\n`;
        results.slice(0, 10).forEach((v, i) => {
            resText += `*${i + 1}.* ${v.title}\n`;
        });
        resText += `\nReply with the number to download.\n\nSAYURA MD`;

        await conn.sendMessage(from, { text: resText }, { quoted: m });

    } catch (e) {
        console.error(e);
        if (e.message.includes("402")) {
            reply("⚠️ API Key එක ඉවරයි හෝ වැරදියි (Status 402).");
        }
    }
});
