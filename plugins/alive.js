const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "balance",
    alias: ["keyinfo"],
    react: "💰",
    desc: "Check SriHub API balance with console logging.",
    category: "user",
    use: ".balance <api_key>",
    filename: __filename
},

async(conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ කරුණාකර API Key එක ලබා දෙන්න.");

        const apiKey = q.trim();
        const apiUrl = `https://api.srihub.store/api/keyinfo?apikey=${apiKey}`;

        // 📝 Console එකේ පෙන්වීම (Start logging)
        console.log('\x1b[36m%s\x1b[0m', `\n[ SRIHUB CHECK ] --------------------`);
        console.log(`[👤] Requested By: ${m.pushName || m.sender}`);
        console.log(`[🔑] API Key: ${apiKey}`);

        await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

        const response = await axios.get(apiUrl).catch(e => {
            // Console එකේ error එක ලොග් කිරීම
            console.log('\x1b[31m%s\x1b[0m', `[❌] Error: ${e.message}`);
            return e.response;
        });

        if (response && response.status === 200) {
            const data = response.data;
            
            if (data.status) {
                // 📝 සාර්ථකයි නම් තොරතුරු Console එකේ පෙන්වීම
                console.log('\x1b[32m%s\x1b[0m', `[✅] Success!`);
                console.log(`[💰] Coins: ${data.result.coins}`);
                console.log(`[👤] User: ${data.result.name}`);
                console.log('\x1b[36m%s\x1b[0m', `------------------------------------\n`);

                let balanceMsg = `*─── [ SRIHUB KEY INFO ] ───*\n\n`;
                balanceMsg += `👤 *User:* ${data.result.name}\n`;
                balanceMsg += `💰 *Coins:* ${data.result.coins}\n\n`;
                balanceMsg += `*© ᴄʀᴇᴀᴛᴇᴅ ʙʏ ꜱayura mihiranga*`;

                await conn.sendMessage(from, { text: balanceMsg }, { quoted: mek });
                await conn.sendMessage(from, { react: { text: "✅", key: m.key } });
            }
        } else if (response && response.status === 402) {
             console.log('\x1b[31m%s\x1b[0m', `[⚠️] Result: Out of Coins!`);
             return reply("❌ Payment Required: මෙම Key එකේ Coins ඉවරයි.");
        } else {
            console.log('\x1b[31m%s\x1b[0m', `[❌] Result: Invalid Key or 404`);
            return reply("❌ දෝෂයක්: API Key එක වැරදියි හෝ හමු නොවීය.");
        }

    } catch (e) {
        console.log('\x1b[31m%s\x1b[0m', `[🆘] Fatal Error: ${e.message}`);
        reply(`❌ Error: ${e.message}`);
    }
});
