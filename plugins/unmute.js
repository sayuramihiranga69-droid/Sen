const { cmd } = require("../command");

cmd({
  pattern: "send",
  alias: ["sendme", "save"],
  react: "📤",
  desc: "Forwards quoted message back to your DM or current chat",
  category: "utility",
  filename: __filename
}, async (client, message, match, { from, sender }) => {
  try {
    if (!match.quoted) {
      return await client.sendMessage(from, {
        text: "*🍁 Please reply to a message (image, video, audio, or doc)!*"
      }, { quoted: message });
    }

    // --- FIX FOR STATUS/UNDEFINED TYPES ---
    // Extract the actual message content if it's wrapped (common in Status updates)
    let quotedMsg = match.quoted.message || match.quoted;
    
    // Resolve mtype manually if match.quoted.mtype is undefined
    let mtype = match.quoted.mtype || Object.keys(quotedMsg)[0];

    // Handle View Once wrappers
    if (mtype === 'viewOnceMessageV2' || mtype === 'viewOnceMessage') {
        quotedMsg = quotedMsg[mtype].message;
        mtype = Object.keys(quotedMsg)[0];
    }
    // ---------------------------------------

    const buffer = await match.quoted.download();
    const caption = match.quoted.text || "";
    const target = sender; 

    let messageContent = {};

    switch (mtype) {
      case "imageMessage":
        messageContent = { image: buffer, caption };
        break;
      case "videoMessage":
        messageContent = { video: buffer, caption };
        break;
      case "audioMessage":
        messageContent = { 
            audio: buffer, 
            mimetype: match.quoted.mimetype || "audio/mp4", 
            ptt: match.quoted.ptt || false 
        };
        break;
      case "stickerMessage":
        messageContent = { sticker: buffer };
        break;
      case "documentMessage":
        messageContent = { 
            document: buffer, 
            mimetype: match.quoted.mimetype, 
            fileName: match.quoted.fileName || 'file' 
        };
        break;
      case "conversation":
      case "extendedTextMessage":
        messageContent = { text: match.quoted.text || quotedMsg[mtype]?.text || quotedMsg[mtype] };
        break;
      default:
        return await client.sendMessage(from, {
          text: `❌ This message type (${mtype}) is not supported yet.`
        }, { quoted: message });
    }

    await client.sendMessage(target, messageContent);
    
    if (target === sender && from !== sender) {
        await client.sendMessage(from, { text: "_Sent to your Sayura Md Inbox! ✅_" }, { quoted: message });
    }

  } catch (error) {
    console.error("Forward Error:", error);
    await client.sendMessage(from, {
      text: "❌ Error forwarding message:\n" + error.message
    }, { quoted: message });
  }
});
