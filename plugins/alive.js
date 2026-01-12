const config = require('../config')
const {cmd , commands} = require('../command')

cmd({
    pattern: "alive",
    desc: "Check bot online or no.",
    category: "main",
    react: "👋",
    filename: __filename
},
async(conn, mek, m,{from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply}) => {
try{

let des = `👋 𝙷𝚎𝚕𝚕𝚘 ${pushname} 𝙸'𝚖 𝚊𝚕𝚒𝚟𝚎 𝚗𝚘𝚠

*Im SAYURA-MD Whatsapp Bot Create By MR SAYURA MIHIRANGA 🍂✨*

| *Version*: 1.0.0
| *Memory*: 38.09MB/7930MB
| *Owner*: SAYUA MD

මම Sayura md whatsapp bot. මම ඔයාට උදව් කරන්නේ කෙසේ ද.
මෙනුව ලබා ගැනීමට, .menu ලෙස ටයිප් කරන්න
 ඔබට බොට් ගැන යමක් දැන ගැනීමට අවශ්‍ය නම්,
.owner ලෙස ටයිප් කර ප්‍රශ්නය මා වෙත යොමු කරන්න. සුබ දිනක්

*°᭄SAYURA 𝙼𝙳*

> © 𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐒𝐀𝐘𝐔𝐑𝐀 𝐌𝐃`
return await conn.sendMessage(from,{image: {url: config.ALIVE_IMG},caption: des},{quoted: mek})
}catch(e){
console.log(e)
reply(`${e}`)
}
})
