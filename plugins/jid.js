const { cmd } = require('../command'); 

cmd({
    pattern: "jid2",
    desc: "Show JID of current chat, user or quoted message (Fixed LID)",
    category: "other",
    react: "🆔",
    filename: __filename
},
async (conn, mek, m, { from, quoted, reply, sender }) => {
    try {
        // --- LID ප්‍රශ්නය විසඳන Logic එක ---
        // මෙතනදී අපි බලනවා target JID එකේ ': ' හෝ '@lid' තියෙනවද කියලා. 
        // තිබේ නම් ඒක පිරිසිදු කරලා @s.whatsapp.net වලට හරවනවා.
        
        let targetJid = quoted ? quoted.sender : (m.isGroup ? from : from);
        
        // LID එකක් නම් එය සාමාන්‍ය JID එකකට පරිවර්තනය කිරීම
        if (targetJid.includes(':')) {
            targetJid = targetJid.split(':')[0] + "@s.whatsapp.net";
        } else if (targetJid.includes('@lid')) {
            targetJid = targetJid.split('@')[0] + "@s.whatsapp.net";
        }

        const botJid = conn.user.id.split(':')[0] + "@s.whatsapp.net";

        let jidInfo = `✨ *𝐒𝐀𝐘𝐔𝐑𝐀 𝐌𝐃 𝐉𝐈𝐃 𝐈𝐍𝐅𝐎* ✨\n\n`;

        if (m.isGroup) {
            jidInfo += `👥 *Group JID:* \`${from}\` \n`;
            if (quoted) jidInfo += `👤 *User JID:* \`${targetJid}\` \n`;
        } else {
            jidInfo += `👤 *Chat JID:* \`${targetJid}\` \n`;
        }

        jidInfo += `🤖 *Bot JID:* \`${botJid}\` \n\n`;
        jidInfo += `*ᴘᴏᴡᴇrd ʙʏ sᴀyura ᴍd*`;

        return await conn.sendMessage(from, { text: jidInfo }, { quoted: mek });

    } catch (e) {
        console.error("Error in JID command:", e);
        reply("❌ Error while fetching JID.");
    }
});
