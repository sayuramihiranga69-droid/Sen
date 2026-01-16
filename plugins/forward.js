const { cmd } = require('../command');

cmd({
    pattern: "jid",
    desc: "Show full JID information including names and types",
    category: "other",
    react: "🔍",
    filename: __filename
},
async (conn, mek, m, { from, quoted, reply, sender, pushname }) => {
    try {
        const remoteJid = from;
        const isGroup = m.isGroup;
        
        // 1. LID (Business ID) පිරිසිදු කරගැනීමේ Logic එක
        const cleanJid = (id) => {
            if (!id) return id;
            // :1 හෝ @lid තිබේ නම් ඒවා ඉවත් කර @s.whatsapp.net ලබා දීම
            if (id.includes(':')) return id.split(':')[0] + "@s.whatsapp.net";
            if (id.includes('@lid')) return id.split('@')[0] + "@s.whatsapp.net";
            return id;
        };

        // 2. Sender සහ Bot JID ලබා ගැනීම
        const senderJid = cleanJid(m.quoted ? m.quoted.sender : sender);
        const botJid = cleanJid(conn.user.id);

        let groupName = "N/A";
        let senderDisplayName = m.quoted ? "Quoted User" : pushname;

        // 3. Group එකක් නම් Metadata ලබා ගැනීම
        if (isGroup) {
            const metadata = await conn.groupMetadata(remoteJid);
            groupName = metadata.subject || "Unnamed Group";
        }

        // 4. පණිවිඩය සැකසීම
        const fullText = `🔍 *𝐉𝐈𝐃 𝐅𝐔𝐋𝐋 𝐃𝐄𝐓𝐀𝐈𝐋𝐒*

🏢 *Group Name:* ${isGroup ? groupName : "❌ Not a Group"}
🆔 *Group JID:* \`${isGroup ? remoteJid : "❌"}\`

👤 *User:* ${senderDisplayName}
🆔 *User JID:* \`${senderJid}\`

🤖 *Bot JID:* \`${botJid}\`

💬 *Chat Type:* ${isGroup ? "Group Chat" : "Private Chat"}
🕐 *Message ID:* \`${m.key.id}\`

*ᴘᴏᴡᴇරෙඩ් ʙʏ sᴀයූරා ᴍඩී*`;

        // 5. මැසේජ් එක යැවීම
        await conn.sendMessage(from, {
            text: fullText
        }, { quoted: mek });

    } catch (err) {
        console.error("Error in .jid command:", err);
        reply("❌ Error getting JID info!");
    }
});
