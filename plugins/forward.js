const { readEnv } = require('../lib/database');
const { cmd } = require('../command');
const config = require('../config');

cmd({
    pattern: "forward",
    desc: "Forward messages to a specific JID",
    alias: ["fo"],
    category: "owner",
    use: '.forward <JID>',
    filename: __filename
},
async (conn, mek, m, { from, q, isOwner, reply, quoted }) => {
    try {
        // 1. Owner check
        if (!isOwner) return reply("*🛑 Owner Only!*");

        // 2. මැසේජ් එකක් Reply කරලා තියෙනවද සහ JID එකක් දීලා තියෙනවද කියා බැලීම
        if (!m.quoted) return reply("*❌ කරුණාකර Forward කළ යුතු මැසේජ් එකට Reply කරන්න.*");
        if (!q) return reply("*❌ කරුණාකර Forward කළ යුතු JID ලිපිනය ලබා දෙන්න.*");

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        // 3. පිරිසිදු JID එකක් සකසා ගැනීම
        let targetJid = q.trim();
        if (!targetJid.includes('@')) {
            targetJid = targetJid + "@s.whatsapp.net";
        }

        // 4. මැසේජ් එක Forward (Copy) කිරීම
        // මෙතනදී copyNForward පාවිච්චි කිරීමෙන් caption සහ media ඔක්කොම යයි
        await conn.copyNForward(targetJid, m.quoted, true);

        // 5. සාර්ථක බව පෙන්වන ලස්සන UI එක
        let successMsg = `🚀 *𝐒𝐀𝐘𝐔𝐑𝐀 𝐌𝐃 𝐅𝐎𝐑𝐖𝐀𝐑𝐃𝐄𝐑* 🚀\n\n`;
        successMsg += `📦 *Status:* Successfully Forwarded\n`;
        successMsg += `🎯 *Target JID:* \`${targetJid}\` \n\n`;
        successMsg += `*ᴘᴏᴡᴇrd ʙʏ sᴀyura ᴍd*`;

        await reply(successMsg);
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.error("Forward Error:", e);
        reply(`❌ *Forward කිරීමේදී දෝෂයක් සිදු විය!* \n\nපොඩ්ඩක් බලන්න ඔයා දුන්න JID එක (\`${q}\`) නිවැරදිද කියලා. LID address වලට (Business IDs) සමහර වෙලාවට මැසේජ් යවන්න බෑ.`);
    }
});
