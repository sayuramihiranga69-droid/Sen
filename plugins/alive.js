const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "balance",
    alias: ["checkcoins"],
    react: "💰",
    desc: "Check SriHub API balance using a specific API Key.",
    category: "user",
    use: ".balance <your_api_key>",
    filename: __filename
},

async(conn, mek, m, { from, q, reply }) => {
    try {
        // q හරහා ලැබෙන්නේ command එකට පස්සේ user ටයිප් කරන දේ (API Key එක)
        if (!q) return reply("❗ කරුණාකර API Key එක ලබා දෙන්න.\n\n*Usage:* .balance YOUR_API_KEY");

        const apiKey = q.trim();
        const apiUrl = `https://api.srihub.store/user/info?apikey=${apiKey}`;

        await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

        // API එකට Request එක යැවීම
        const response = await axios.get(apiUrl).catch(e => null);

        if (!response || !response.data) {
            return reply("❌ දත්ත ලබා ගැනීමට නොහැකි විය. කරුණාකර API Key එක පරීක්ෂා කරන්න.");
        }

        const data = response.data;

        if (data.status) {
            const name = data.result.name || "User";
            const coins = data.result.coins || "0";
            const limit = data.result.limit || "Unlimited";

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
                        renderLargerThumbnail: false
                    }
                }
            }, { quoted: mek });

            await conn.sendMessage(from, { react: { text: "✅", key: m.key } });

        } else {
            // API එකෙන් error එකක් ආවොත් (වැරදි Key එකක් වැනි)
            return reply(`❌ Error: ${data.message || "Invalid API Key"}`);
        }

    } catch (e) {
        console.log(e);
        reply(`❌ පද්ධතියේ දෝෂයක් පවතී: ${e.message}`);
    }
});
