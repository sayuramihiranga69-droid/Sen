const { cmd } = require('../command'); 

cmd({
    pattern: "jid",
    desc: "Show JID of current chat, user or quoted message",
    category: "other",
    react: "🆔",
    filename: __filename
},
async (conn, mek, m, { from, quoted, reply, sender }) => {
    try {
        // 1. Target එක තෝරා ගැනීම (Reply කර ඇත්නම් එම කෙනා, නැතිනම් මැසේජ් එක එවූ කෙනා)
        const targetJid = quoted ? quoted.sender : sender;
        const botJid = conn.user.id.split(':')[0] + "@s.whatsapp.net";

        let jidInfo = `✨ *𝐒𝐀𝐘𝐔𝐑𝐀 𝐌𝐃 𝐉𝐈𝐃 𝐈𝐍𝐅𝐎* ✨\n\n`;

        // 2. Chat එක Group එකක් නම් එහි JID එක
        if (m.isGroup) {
            jidInfo += `👥 *Group JID:* \`${from}\` \n`;
        }

        // 3. User ගේ JID එක (Reply කර ඇත්නම් එම කෙනාගේ)
        jidInfo += `👤 *User JID:* \`${targetJid}\` \n`;

        // 4. Bot ගේ JID එක
        jidInfo += `🤖 *Bot JID:* \`${botJid}\` \n\n`;
        
        jidInfo += `*ᴘᴏᴡᴇʀᴇᴅ ʙʏ sᴀʏᴜʀᴀ ᴍɪʜɪʀᴀɴɢᴀ*`;

        // මැසේජ් එක යැවීම
        return await conn.sendMessage(from, { text: jidInfo }, { quoted: mek });

    } catch (e) {
        console.error("Error in JID command:", e);
        reply("❌ Error while fetching JID.");
    }
});
