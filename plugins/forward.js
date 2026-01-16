const { readEnv } = require('../lib/database');
const { cmd } = require('../command');
const os = require("os");
const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, Func, fetchJson } = require('../lib/functions');
const axios = require('axios');
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

        // 3. Forward කිරීමේ ප්‍රධාන කොටස
        // q = ඉලක්කගත JID එක, m.quoted = reply කරපු මැසේජ් එක
        await conn.copyNForward(q, m.quoted, true);

        // 4. සාර්ථක බව පෙන්වන ලස්සන UI එක
        let successMsg = `🚀 *𝐒𝐀𝐘𝐔𝐑𝐀 𝐌𝐃 𝐅𝐎𝐑𝐖𝐀𝐑𝐃𝐄𝐑* 🚀\n\n`;
        successMsg += `📦 *Status:* Successfully Forwarded\n`;
        successMsg += `🎯 *Target JID:* \`${q}\` \n\n`;
        successMsg += `*powered by sayura md*`;

        await reply(successMsg);
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.error("Forward Error:", e);
        reply("❌ Forward කිරීමේදී දෝෂයක් සිදු විය. කරුණාකර JID එක නිවැරදිදැයි පරීක්ෂා කරන්න.");
    }
});
