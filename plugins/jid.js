const { cmd } = require('../lib/command'); 

cmd({
    pattern: "jid2",
    desc: "Show JID of current chat, user or quoted message",
    category: "other",
    react: "🆔",
    filename: __filename
},
async (conn, mek, m, { from, quoted, reply, sender }) => {
    try {
        // --- Smart Target Selection ---
        let targetJid;
        
        if (quoted) {
            // 1. මැසේජ් එකකට රිප්ලයි කර ඇත්නම්: එම මැසේජ් එක එවූ කෙනාගේ JID
            targetJid = quoted.sender;
        } else if (m.isGroup) {
            // 2. ගෲප් එකක නම්: ගෲප් එකේ JID
            targetJid = from;
        } else {
            // 3. පෞද්ගලික චැට් එකක නම්: එම චැට් එකේ අනෙක් පුද්ගලයාගේ JID
            targetJid = from; 
        }

        const botJid = conn.user.id.split(':')[0] + "@s.whatsapp.net";

        let jidInfo = `✨ *𝐒𝐀𝐘𝐔𝐑𝐀 𝐌𝐃 𝐉𝐈𝐃 𝐈𝐍𝐅𝐎* ✨\n\n`;

        // චැට් එකේ වර්ගය අනුව පෙන්වන විස්තරය වෙනස් කිරීම
        if (m.isGroup) {
            jidInfo += `👥 *Group JID:* \`${from}\` \n`;
            if (quoted) jidInfo += `👤 *User JID:* \`${targetJid}\` \n`;
        } else {
            jidInfo += `👤 *Chat JID:* \`${targetJid}\` \n`;
        }

        jidInfo += `🤖 *Bot JID:* \`${botJid}\` \n\n`;
        jidInfo += `*ᴘᴏᴡᴇරෙඩ් ʙʏ sᴀʏුරා ᴍඩී*`;

        return await conn.sendMessage(from, { text: jidInfo }, { quoted: mek });

    } catch (e) {
        console.error("Error in JID command:", e);
        reply("❌ Error while fetching JID.");
    }
});
