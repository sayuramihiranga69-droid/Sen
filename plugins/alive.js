const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "balance",
    alias: ["checkcoins", "keyinfo"],
    react: "💰",
    desc: "Check SriHub API balance using a specific API Key.",
    category: "user",
    use: ".balance <your_api_key>",
    filename: __filename
},

async(conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ කරුණාකර API Key එක ලබා දෙන්න.\n\n*Usage:* .balance dew_YyT0KD...");

        const apiKey = q.trim();
        
        // SriHub API එකේ සාමාන්‍යයෙන් Key එක check කරන ලින්ක් එක
        // ඔබේ API documentation එකේ මේ ලින්ක් එක මීට වඩා වෙනස් නම් එය මෙතනට දාන්න
        const apiUrl = `https://api.srihub.store/api/keyinfo?apikey=${apiKey}`;

        await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

        const response = await axios.get(apiUrl).catch(e => {
            return { data: { status: false, message: e.message } };
        });

        const data = response.data;

        // මෙහිදී 'status' හෝ 'success' යන දෙකෙන් එකක් තිබිය හැක
        if (data.status || data.success) {
            const res = data.result || data; // සමහර විට result ඇතුළේ නැතිව කෙලින්ම දත්ත එන්න පුළුවන්
            
            const name = res.name || "User";
            const coins = res.coins || res.balance || "0";
            const limit = res.limit || "Unlimited";

            let balanceMsg = `*─── [ SRIHUB KEY INFO ] ───*\n\n`;
            balanceMsg += `👤 *User:* ${name}\n`;
            balanceMsg += `💰 *Coins:* ${coins}\n`;
            balanceMsg += `📊 *Limit:* ${limit}\n\n`;
            balanceMsg += `*© ᴄʀᴇᴀᴛᴇᴅ ʙʏ ꜱayura mihiranga*`;

            await conn.sendMessage(from, {
                text: balanceMsg,
                contextInfo: {
                    externalAdReply: {
                        title: "SRIHUB COIN CHECKER",
                        body: "Live Balance Status",
                        sourceUrl: "https://api.srihub.store/",
                        mediaType: 1,
                        thumbnailUrl: "https://files.catbox.moe/p4b6y6.jpg", // මෙතනට කැමති image එකක් දාන්න
                        renderLargerThumbnail: false
                    }
                }
            }, { quoted: mek });

            await conn.sendMessage(from, { react: { text: "✅", key: m.key } });

        } else {
            // API එකෙන් එන නියම Error එක පෙන්වන්න
            return reply(`❌ දෝෂයක්: ${data.message || "Invalid API Key or API Down"}`);
        }

    } catch (e) {
        console.log(e);
        reply(`❌ පද්ධතියේ දෝෂයක් පවතී: ${e.message}`);
    }
});
