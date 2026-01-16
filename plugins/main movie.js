const { cmd, commands } = require("../command");
const axios = require("axios");

// ----- Multi-Reply Smart Waiter (Anime plugin එකේ logic එක) -----
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
    pattern: "movie",
    alias: ["movie5"],
    desc: "Multi-reply internal movie search engine with fixed UI",
    category: "downloader",
    react: "🎬",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ කරුණාකර සෙවිය යුතු ෆිල්ම් එකේ නම ලබා දෙන්න.\n\nEx: .movie solo leveling");

        const posterUrl = "https://files.catbox.moe/d0v6fe.png";

        // ලස්සන UI ලිස්ට් එක
        let menu = `╭───〔 🎬 *SAYURA MD ALL* 🎬 〕───┈⊷
│
│ 🔍 *Search:* _${q.toUpperCase()}_
│
│ *Select your movie source:*
│
│ 🔷 *01* ┋ Sinhalasub
│ 🔷 *02* ┋ Cinesubz
│ 🔷 *03* ┋ Dinka Sinhalasub
│ 🔷 *04* ┋ SL Anime Club
│ 🔷 *05* ┋ Pirate.lk
│ 🔷 *06* ┋ Moviesublk
│
│ ╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼
│ 📌 *අංකය Reply කරන්න. (Multi-Reply ON)*
│ ╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼
│
╰━━━━━━━━━━━━━━━━━━━━━━┈⊷
         *ᴘᴏᴡᴇරෙඩ් ʙʏ sᴀʏᴜʀᴀ ᴍඩී*`;

        // පෝස්ටර් එක Image එකක් විදිහටම Caption එකත් එක්ක යැවීම (මෙතනදී අනිවාර්යයෙන්ම පින්තූරය පේනවා)
        const listMsg = await conn.sendMessage(from, { 
            image: { url: posterUrl }, 
            caption: menu 
        }, { quoted: m });

        // --- Multi-Reply Flow එක පාලනය කරන ලූප් එක ---
        const startFlow = async () => {
            while (true) {
                // User ගෙන් රිප්ලයි එකක් එනකන් බලා සිටීම
                const selection = await waitForReply(conn, from, sender, listMsg.key.id);
                if (!selection) break;

                // රිප්ලයි එක ලැබුණු පසු අභ්‍යන්තරව trigger කිරීම
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
                        // සෙවුම ආරම්භ කළ බව පෙන්වීමට රිප්ලයි කළ මැසේජ් එකට React කිරීම
                        await conn.sendMessage(from, { react: { text: "🔍", key: selection.msg.key } });
                        
                        // Bot ගේ memory එකෙන් අදාළ plugin එක සොයාගැනීම
                        const selectedCmd = commands.find((c) => c.pattern === targetPattern);
                        if (selectedCmd) {
                            // Plugin එක හංගලා Execute කිරීම
                            await selectedCmd.function(conn, selection.msg, selection.msg, { 
                                from, 
                                q: q, 
                                reply, 
                                isGroup: m.isGroup, 
                                sender: m.sender, 
                                pushname: m.pushname 
                            });
                        } else {
                            reply(`❌ Plugin '${targetPattern}' සොයාගත නොහැක.`);
                        }
                    }
                })();
            }
        };

        startFlow();

    } catch (e) {
        console.error("Movie Error:", e);
    }
});
