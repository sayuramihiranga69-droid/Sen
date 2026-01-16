const { cmd, commands } = require("../command");

/**
 * SAYURA MD - MOVIE SEARCH ENGINE (V2)
 * ලස්සනට සහ අභ්‍යන්තරව (Internally) වැඩ කරන ලෙස සකසා ඇත.
 */

// ----- User Reply එක ලැබෙනකන් බලා සිටින Function එක -----
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
    pattern: "movie3",
    alias: ["movie5"],
    desc: "Internal trigger for movie plugins (Hidden mode)",
    category: "downloader",
    react: "🎬",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ කරුණාකර සෙවිය යුතු ෆිල්ම් එකේ නම ලබා දෙන්න.\n\nEx: .movie Solo Leveling");

        // --- ලස්සන කරපු Menu එක ---
        let menu = `┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃     🎬  *SAYURA MD MOVIE ENGINE* 🎬      
┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛

   🔍 *සෙවුම:* 👉 _${q.toUpperCase()}_

  *Select a Website to Search:*

  🔹 *01* ┋ Sinhalasub
  🔹 *02* ┋ Cinesubz
  🔹 *03* ┋ Dinka Sinhalasub
  🔹 *04* ┋ SL Anime Club
  🔹 *05* ┋ Pirate.lk
  🔹 *06* ┋ Moviesublk

  *──────────────────────────*
  📌 *ඉහත අංකයක් Reply කරන්න.*
  *──────────────────────────*

  *ᴘᴏᴡᴇʀᴇᴅ ʙʏ sᴀʏᴜʀᴀ ᴍᴅ ᴠ1*`;

        // පෝස්ටර් එකත් එක්ක මැසේජ් එක යැවීම
        const listMsg = await conn.sendMessage(from, { 
            text: menu,
            contextInfo: {
                externalAdReply: {
                    title: "SAYURA MD MOVIE DOWNLOADER",
                    body: "Select your movie source",
                    thumbnailUrl: "https://files.catbox.moe/d0v6fe.png",
                    sourceUrl: "https://whatsapp.com/channel/0029VaoRshX47XeS8fK3uA3p",
                    mediaType: 1,
                    showAdAttribution: true,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: m });

        // 1. User අංකයක් එවනකන් ඉන්නවා
        const { text: selText } = await waitForReply(conn, from, listMsg.key.id);
        
        // 2. අංකය අනුව Execute කළ යුතු Command එක තෝරනවා
        let targetPattern = "";
        if (selText === '1') targetPattern = "sinhalasub";
        else if (selText === '2') targetPattern = "cinesubz";
        else if (selText === '3') targetPattern = "dinka";
        else if (selText === '4') targetPattern = "anime";
        else if (selText === '5') targetPattern = "pirate";
        else if (selText === '6') targetPattern = "moviesub";
        else return reply("❌ වැරදි අංකයක්. කරුණාකර 1-6 අතර අංකයක් ලබා දෙන්න.");

        // සෙවුම ආරම්භ කළ බව පෙන්වීමට React එකක්
        await conn.sendMessage(from, { react: { text: "🔍", key: m.key } });

        // 3. හංගලා වැඩේ කරන කොටස (Internal Trigger)
        const selectedCmd = commands.find((c) => c.pattern === targetPattern);

        if (selectedCmd) {
            // මෙතනදී Command එක අතින් ගහන්න ඕන වෙන්නේ නැහැ, කෙලින්ම Execute වෙනවා
            await selectedCmd.function(conn, mek, m, { 
                from, 
                q: q, 
                reply, 
                isGroup: m.isGroup, 
                sender: m.sender, 
                pushname: m.pushname 
            });
        } else {
            reply(`❌ ${targetPattern} plugin එක සොයාගත නොහැක. කරුණාකර එය ස්ථාපනය කර ඇත්දැයි බලන්න.`);
        }

    } catch (e) {
        console.error("Movie Engine Error:", e);
    }
});
