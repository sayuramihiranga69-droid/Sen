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
            
            const isTargetReply = context?.stanzaId === targetId;
            const isCorrectUser = msgSender.includes(sender.split('@')[0]) || msgSender.includes("@lid");

            if (msg.key.remoteJid === from && isCorrectUser && isTargetReply && !isNaN(text)) {
                resolve({ msg, text: text.trim() });
            }
        };
        conn.ev.on("messages.upsert", handler);
        setTimeout(() => { conn.ev.off("messages.upsert", handler); }, 600000); 
    });
}

cmd({
    pattern: "movie",
    alias: ["movie5"],
    desc: "Advanced Multi-reply movie search engine",
    category: "downloader",
    react: "🎬",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("❗ කරුණාකර සෙවිය යුතු ෆිල්ම් එකේ නම ලබා දෙන්න.");

        // --- පෝස්ටර් එක අනිවාර්යයෙන්ම පෙන්වීමට Buffer එකක් ලෙස ගැනීම ---
        const posterUrl = "https://files.catbox.moe/d0v6fe.png";
        let posterBuffer;
        try {
            const res = await axios.get(posterUrl, { responseType: 'arraybuffer' });
            posterBuffer = Buffer.from(res.data, 'utf-8');
        } catch (e) {
            posterBuffer = { url: posterUrl }; // Error එකක් වුණොත් ලින්ක් එකම දෙනවා
        }

        // --- ලස්සනම පෙනුම (UI Design) ---
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
         *ᴘᴏවෙරෙඩ් ʙʏ sᴀʏᴜʀᴀ ᴍඩී*`;

        const listMsg = await conn.sendMessage(from, { 
            text: menu,
            contextInfo: {
                externalAdReply: {
                    title: "SAYURA MD MOVIE ENGINE",
                    body: "Searching for: " + q,
                    thumbnail: posterBuffer, // මෙතන Buffer එක පාවිච්චි කිරීමෙන් Preview එක අනිවාර්යයෙන්ම එයි
                    sourceUrl: "https://whatsapp.com/channel/0029VaoRshX47XeS8fK3uA3p",
                    mediaType: 1,
                    renderLargerThumbnail: true,
                    showAdAttribution: true
                }
            }
        }, { quoted: m });

        // --- Multi-Reply Loop එක (කිහිප පාරක් අංක ගැහිය හැක) ---
        const startFlow = async () => {
            while (true) {
                const selection = await waitForReply(conn, from, sender, listMsg.key.id);
                if (!selection) break;

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
                        } else {
                            reply(`❌ Plugin '${targetPattern}' සොයාගත නොහැක.`);
                        }
                    }
                })();
            }
        };

        startFlow();

    } catch (e) {
        console.error("Movie Engine Error:", e);
    }
});
