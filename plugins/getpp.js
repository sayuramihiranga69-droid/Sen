const { cmd } = require('../command'); 
const fs = require('fs');    
const config = require('../config'); 

cmd({
    pattern: "getpp",
    react: "🖼️",
    desc: "Sends the profile picture of a user by phone number (owner only)",
    category: "owner",
    use: ".getpp <phone number>",
    filename: __filename
},
async (conn, mek, m, context) => {
    try {
        const { from, quoted, args, isOwner, reply } = context;

        // Owner check
        if (!isOwner) return reply("🛑 This command is only for the bot owner!");

        let targetJid;

        // 1. ක්‍රමය: වෙනත් කෙනෙක්ගේ මැසේජ් එකකට Reply කරලා තිබේ නම්
        if (m.quoted) {
            targetJid = m.quoted.sender;
        } 
        // 2. ක්‍රමය: කෙනෙක්ව Mention කරලා තිබේ නම් (@947xxx)
        else if (m.mentionedJid && m.mentionedJid.length > 0) {
            targetJid = m.mentionedJid[0];
        } 
        // 3. ක්‍රමය: අතින් අංකයක් ලබා දී තිබේ නම් (args/q පාවිච්චිය)
        else if (args.length > 0) {
            const cleanNumber = args.join("").replace(/[^0-9]/g, "");
            if (cleanNumber.length >= 5) {
                targetJid = cleanNumber + "@s.whatsapp.net";
            }
        }

        // කිසිවක් නැතිනම්
        if (!targetJid) {
            return reply("📱 Please provide a valid phone number, mention a user, or reply to a message.\n\nExample: `.getpp 94763513529` or reply with `.getpp` ");
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        let ppUrl;
        try {
            // Profile picture එක ගන්නවා
            ppUrl = await conn.profilePictureUrl(targetJid, "image");
        } catch (e) {
            return reply("🖼️ This user has no profile picture or it is hidden by privacy settings!");
        }

        // පින්තූරය යැවීම
        await conn.sendMessage(from, {
            image: { url: ppUrl },
            caption: `✅ *𝐒𝐀𝐘𝐔𝐑𝐀 𝐌𝐃 𝐆𝐄𝐓𝐏𝐏*\n\n👤 *User:* ${targetJid.split('@')[0]}\n📌 *Status:* Successfully Fetched\n\n*ᴘᴏᴡᴇරෙඩ් ʙʏ sᴀʏුරා ᴍඩී*`
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        reply("🛑 An error occurred!");
        console.error("❌ Error in getpp:", e);
    }
});
