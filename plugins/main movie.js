const { cmd } = require("../command");

// ----- Reply එක එනකන් බලා සිටින Function එක -----
function waitForReply(conn, from, replyToId, timeout = 120000) {
    return new Promise((resolve, reject) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;
            const ctx = msg.message?.extendedTextMessage?.contextInfo;
            const text = msg.message.conversation || msg.message?.extendedTextMessage?.text;
            
            // අපි එවපු message එකටම reply එකක්ද කියලා බලනවා
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

cmd({
    pattern: "movie",
    desc: "Main movie search engine menu",
    category: "downloader",
    react: "🎬",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ කරුණාකර සර්ච් කළ යුතු ෆිල්ම් එකේ නම සඳහන් කරන්න. \n\nEx: .movie Solo Leveling");

        // 1. සයිට් ලිස්ට් එක පෙන්වීම
        let listText = `🎬 *SAYURA MD MOVIE ENGINE* 🎬\n\n` +
            `🔍 Search: *${q}*\n\n` +
            `1. Sinhalasub (.sinhalasub)\n` +
            `2. Cinesubz (.cinesubz)\n` +
            `3. Dinka Sinhalasub (.dinka)\n` +
            `4. SL Anime Club (.anime)\n` +
            `5. Pirate.lk (.pirate)\n` +
            `6. Moviesublk (.moviesub)\n\n` +
            `අදාළ අංකය Reply කරන්න.\n\nSAYURA MD`;

        // ලිස්ට් එක යවනවා
        const listMsg = await conn.sendMessage(from, { text: listText }, { quoted: m });

        // 2. අංකය ලැබෙනකන් ඉන්නවා
        const { text: selText } = await waitForReply(conn, from, listMsg.key.id);
        const index = selText.trim();

        // 3. තෝරන අංකය අනුව Command එක Trigger කිරීම
        let cmdToRun = "";
        if (index === '1') cmdToRun = `.sinhalasub ${q}`;
        else if (index === '2') cmdToRun = `.cinesubz ${q}`;
        else if (index === '3') cmdToRun = `.dinka ${q}`;
        else if (index === '4') cmdToRun = `.anime ${q}`;
        else if (index === '5') cmdToRun = `.pirate ${q}`;
        else if (index === '6') cmdToRun = `.moviesub ${q}`;
        else return reply("❌ වැරදි අංකයක්. කරුණාකර 1-6 අතර අංකයක් දෙන්න.");

        // 4. අදාළ Plugin එකට Command එක යැවීම
        await conn.sendMessage(from, { text: cmdToRun }, { quoted: m });

    } catch (e) {
        console.error(e);
        // reply("⏰ කාලය අවසන් විය. නැවත උත්සාහ කරන්න.");
    }
});
