const { cmd, commands } = require("../command");

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
                resolve({ text: text?.trim(), msg: msg });
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
    desc: "Main menu to trigger other plugins internally",
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
        
        // 2. අංකය අනුව Command නම තීරණය කරනවා
        let selectedCommand = "";
        switch (selText) {
            case '1': selectedCommand = "sinhalasub"; break;
            case '2': selectedCommand = "cinesubz"; break;
            case '3': selectedCommand = "dinka"; break;
            case '4': selectedCommand = "anime"; break;
            case '5': selectedCommand = "pirate"; break;
            case '6': selectedCommand = "moviesub"; break;
            default: return reply("❌ වැරදි අංකයක්.");
        }

        // 3. මෙතන තමයි වැදගත්ම දේ:
        // අපි චැට් එකේ command එක ගහන්නේ නැතුව, Bot ගේ memory එකේ තියෙන command එක trigger කරනවා.
        const cmdObj = commands.find((c) => c.pattern === selectedCommand);
        
        if (cmdObj) {
            // Command එක හොයාගත්තා නම් ඒක "Internal" විදිහට run කරනවා
            await cmdObj.function(conn, mek, m, { 
                from, 
                q: q, 
                reply, 
                isGroup: m.isGroup, 
                sender: m.sender, 
                pushname: m.pushname 
            });
        } else {
            reply(`❌ ${selectedCommand} plugin එක සොයාගත නොහැක.`);
        }

    } catch (e) {
        console.error(e);
    }
});
