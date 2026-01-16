const { cmd, commands } = require("../command");

/**
 * SAYURA MD - MOVIE SEARCH ENGINE (V4)
 * එකම ලිස්ට් එකට කිහිප වතාවක් රිප්ලයි (Multi-reply) කළ හැකි පරිදි සකසා ඇත.
 */

// ----- Multi-Reply Smart Waiter (Handler එක Off කරන්නේ නැත) -----
function waitForReply(conn, from, sender, targetId) {
    return new Promise((resolve) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;

            const text = msg.message.conversation || msg.message?.extendedTextMessage?.text || "";
            const context = msg.message?.extendedTextMessage?.contextInfo;
            const msgSender = msg.key.participant || msg.key.remoteJid;
            
            // අපි එවපු ලිස්ට් එකටමද රිප්ලයි කරන්නේ සහ අදාළ යූසර්මද කියලා බලනවා
            const isTargetReply = context?.stanzaId === targetId;
            const isCorrectUser = msgSender.includes(sender.split('@')[0]) || msgSender.includes("@lid");

            if (msg.key.remoteJid === from && isCorrectUser && isTargetReply && !isNaN(text)) {
                resolve({ msg, text: text.trim() });
            }
        };
        conn.ev.on("messages.upsert", handler);
        // විනාඩි 10ක් යනකම් රිප්ලයි බලාපොරොත්තු වේ
        setTimeout(() => { conn.ev.off("messages.upsert", handler); }, 600000); 
    });
}

cmd({
    pattern: "movie3",
    alias: ["movie5"],
    desc: "Multi-reply internal movie search engine",
    category: "downloader",
    react: "🎬",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ කරුණාකර සෙවිය යුතු ෆිල්ම් එකේ නම ලබා දෙන්න.");

        const posterUrl = "https://files.catbox.moe/d0v6fe.png";

        let menu = `╭━━━〔  🎬 *SAYURA MD ALL MOVIE SEARCH* 🎬  〕━━━┈⊷
┃
┃  🔍 *Search:* _${q.toUpperCase()}_
┃
┃  *Select your movie source:*
┃
┃  🔹 *01* ┋ Sinhalasub
┃  🔹 *02* ┋ Cinesubz
┃  🔹 *03* ┋ Dinka Sinhalasub
┃  🔹 *04* ┋ SL Anime Club
┃  🔹 *05* ┋ Pirate.lk
┃  🔹 *06* ┋ Moviesublk
┃
┃  *──────────────────────────*
┃  📌 *අංකය Reply කරන්න. (කිහිපයක් වුවද තේරිය හැක)*
┃  *──────────────────────────*
┃
╰━━━━━━━━━━━━━━━━━━━┈⊷
         *ᴘᴏᴡᴇʀᴇᴅ ʙʏ sᴀʏᴜʀᴀ ᴍᴅ*`;

        const listMsg = await conn.sendMessage(from, { 
            text: menu,
            contextInfo: {
                externalAdReply: {
                    title: "SAYURA MD MOVIE ENGINE",
                    body: "Multi-Source Search Active",
                    thumbnailUrl: posterUrl,
                    sourceUrl: "https://whatsapp.com/channel/0029VaoRshX47XeS8fK3uA3p",
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: m });

        // --- Multi-Reply Loop එක ආරම්භය ---
        const startFlow = async () => {
            while (true) {
                // User ගෙන් රිප්ලයි එකක් එනකන් හැමතිස්සෙම බලන් ඉන්නවා
                const selection = await waitForReply(conn, from, sender, listMsg.key.id);
                if (!selection) break;

                // රිප්ලයි එක ලැබුණු පසු අදාළ වැඩේ අභ්‍යන්තරව (async) සිදු කරයි
                (async () => {
                    let targetPattern = "";
                    const selText = selection.text;

                    if (selText === '1') targetPattern = "sinhalasub";
                    else if (selText === '2') targetPattern = "cinesubz";
                    else if (selText === '3') targetPattern = "dinka";
                    else if (selText === '4') targetPattern = "anime";
                    else if (selText === '5') targetPattern = "pirate";
                    else if (selText === '6') targetPattern = "moviesub";

                    if (targetPattern) {
                        await conn.sendMessage(from, { react: { text: "🔍", key: selection.msg.key } });
                        
                        const selectedCmd = commands.find((c) => c.pattern === targetPattern);
                        if (selectedCmd) {
                            await selectedCmd.function(conn, selection.msg, selection.msg, { 
                                from, 
                                q: q, 
                                reply, 
                                isGroup: m.isGroup, 
                                sender: m.sender, 
                                pushname: m.pushname 
                            });
                        }
                    }
                })();
            }
        };

        startFlow();

    } catch (e) {
        console.error(e);
    }
});
