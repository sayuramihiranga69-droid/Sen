const { cmd, commands } = require("../command");

// ----- Reply එක එනකන් බලා සිටින Function එක -----
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
    desc: "Internal trigger for movie plugins (Hidden mode)",
    category: "downloader",
    react: "🎬",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ කරුණාකර සෙවිය යුතු ෆිල්ම් එකේ නම ලබා දෙන්න.");

        let menu = `🎬 *SAYURA MD MOVIE ENGINE* 🎬\n\n` +
            `🔍 සෙවුම: *${q}*\n\n` +
            `1. Sinhalasub\n` +
            `2. Cinesubz\n` +
            `3. Dinka Sinhalasub\n` +
            `4. SL Anime Club\n` +
            `5. Pirate.lk\n` +
            `6. Moviesublk\n\n` +
            `අදාළ අංකය Reply කරන්න.\n\nSAYURA MD`;

        const listMsg = await conn.sendMessage(from, { text: menu }, { quoted: m });

        // 1. අංකය ලැබෙනකන් ඉන්නවා
        const { text: selText } = await waitForReply(conn, from, listMsg.key.id);
        
        // 2. අංකය අනුව Execute කළ යුතු Command එකේ Pattern එක තෝරනවා
        let targetPattern = "";
        if (selText === '1') targetPattern = "sinhalasub";
        else if (selText === '2') targetPattern = "cinesubz";
        else if (selText === '3') targetPattern = "dinka";
        else if (selText === '4') targetPattern = "anime";
        else if (selText === '5') targetPattern = "pirate";
        else if (selText === '6') targetPattern = "moviesub";
        else return reply("❌ වැරදි අංකයක්.");

        // 3. මේක තමයි ලොකුම වෙනස:
        // Bot ගේ Memory එකේ තියෙන commands වලින් අදාළ command එක හොයනවා.
        const selectedCmd = commands.find((c) => c.pattern === targetPattern);

        if (selectedCmd) {
            // මෙතනදී අලුතින් මැසේජ් එකක් යවන්නේ නැහැ. 
            // කෙලින්ම අර .dinka එකේ තියෙන logic එක මෙතනදිම run කරනවා.
            await selectedCmd.function(conn, mek, m, { 
                from, 
                q: q, 
                reply, 
                isGroup: m.isGroup, 
                sender: m.sender, 
                pushname: m.pushname 
            });
        } else {
            reply(`❌ ${targetPattern} plugin එක සොයාගත නොහැක.`);
        }

    } catch (e) {
        console.error(e);
    }
});
