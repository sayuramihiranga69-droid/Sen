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
        const { from, quoted, args, q, isOwner, reply } = context;

        // Owner check
        if (!isOwner) return reply("🛑 This command is only for the bot owner!");

        // 1. Input එක ගන්නවා (Mention, Reply හෝ අතින් ගැහූ අංකය)
        let input = q || (quoted && quoted.sender) || (m.mentionedJid && m.mentionedJid[0]);

        if (!input && args.length > 0) {
            input = args.join(""); // හිස්තැන් තිබුණොත් ඒවා අයින් කරලා එකතු කරනවා
        }

        if (!input) {
            return reply("📱 Please provide a valid phone number, mention a user, or reply to a message.\nExample: `.getpp 94763513529`");
        }

        // 2. අංකයෙන් ඉලක්කම් විතරක් වෙන් කරලා ගන්නවා (හිස්තැන්, +, - ඔක්කොම අයින් වේ)
        const cleanNumber = input.replace(/[^0-9]/g, "");

        if (cleanNumber.length < 5 || cleanNumber.length > 15) {
            return reply("❌ Invalid phone number format! Please check the number again.");
        }

        const targetJid = cleanNumber + "@s.whatsapp.net";
        let ppUrl;

        // 3. Profile picture එක Fetch කරනවා
        try {
            ppUrl = await conn.profilePictureUrl(targetJid, "image");
        } catch (e) {
            // පින්තූරයක් නැතිනම් හෝ Privacy settings නිසා බැලිය නොහැකි නම්
            return reply("🖼️ This user has no profile picture or it is hidden by privacy settings!");
        }

        // 4. සාර්ථකව පින්තූරය යැවීම
        await conn.sendMessage(from, {
            image: { url: ppUrl },
            caption: `✅ *𝐒𝐀𝐘𝐔𝐑𝐀 𝐌𝐃 𝐆𝐄𝐓𝐏𝐏*\n\n👤 *User:* ${cleanNumber}\n📌 *Status:* Successfully Fetched\n\n*ᴘᴏᴡᴇරෙඩ් ʙʏ sᴀʏුරා ᴍඩී*`
        }, { quoted: mek });

        // React success
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        reply("🛑 An error occurred while executing the command!");
        console.error("❌ Error in getpp:", e);
    }
});
