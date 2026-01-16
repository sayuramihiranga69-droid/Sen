const { cmd } = require('../command');

cmd({
    pattern: "id",
    react: "🔥",
    alias: ["getdeviceid"],
    desc: "Get message id",
    category: "main",
    use: '.id',
    filename: __filename
},
async(conn, mek, m,{from, l, quoted, isSudo, body, isCmd, msr, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isCreator ,isDev, isAdmins, reply}) => {
try{
if ( !isMe && !isOwner && !isSudo ) return await reply('*📛OWNER COMMAND*')
    
if ( !m.quoted ) return reply('*Please reply a Message... ℹ️*')
reply(m.quoted.id)
} catch (e) {
await conn.sendMessage(from, { react: { text: '❌', key: mek.key } })
console.log(e)
reply(`❌ *Error Accurated !!*\n\n${e}`)
}
})
