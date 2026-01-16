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

        // 1. Input එක ගන්නවා (args, quoted හෝ mention වලින්)
        let input = q || (quoted && quoted.sender) || (m.mentionedJid && m.mentionedJid[0]);

        if (!input && args.length > 0) {
            input = args.join(""); // හිස්තැන් අයින් කරලා අංක ටික එකතු කරනවා
        }

        if (!input) {
            return reply("📱 Please provide a valid phone number, mention a user, or reply to a message.\nExample: `.getpp 94763513529`");
        }

        // 2. අංකයෙන් ඉලක්කම් විතරක් වෙන් කරලා ගන්නවා (හිස්තැන්, +, - ඔක්කොම අයින් වෙනවා)
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
            return reply("🖼️ This user has no profile picture or it is hidden by privacy settings!");
        }

        // 4. සාර්ථකව Send කරනවා
        await conn.sendMessage(from, {
            image: { url: ppUrl },
            caption: `✅ *SAYURA MD GETPP*\n\n👤 *User:* ${cleanNumber}\n📌 *Status:* Successfully Fetched`
        }, { quoted: mek });

        // React success
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        reply("🛑 An error occurred while fetching the profile picture!");
        console.log("❌ Error in getpp:", e);
    }
});
