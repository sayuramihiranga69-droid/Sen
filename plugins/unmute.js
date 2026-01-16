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

    // Download the media
    const buffer = await match.quoted.download();
    let mtype = match.quoted.mtype;
    const caption = match.quoted.text || "";
    const target = sender; 

    // Handle View Once Messages (often the cause of 'not supported' errors)
    if (mtype === 'viewOnceMessageV2' || mtype === 'viewOnceMessage') {
        mtype = Object.keys(match.quoted.message)[0];
    }

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
      // Added support for Contact and Location just in case
      case "contactMessage":
        messageContent = { contacts: { displayName: match.quoted.displayName, contacts: [match.quoted.vcard] } };
        break;
      case "locationMessage":
        messageContent = { location: { degreesLatitude: match.quoted.lat, degreesLongitude: match.quoted.lng } };
        break;
      case "conversation":
      case "extendedTextMessage":
        messageContent = { text: match.quoted.text };
        break;
      default:
        // Log the unknown type to console so you can identify it
        console.log("Unknown mtype:", mtype);
        return await client.sendMessage(from, {
          text: `❌ This message type (${mtype}) is not supported yet.`
        }, { quoted: message });
    }

    await client.sendMessage(target, messageContent);
    
    if (target === sender && from !== sender) {
        await client.sendMessage(from, { text: "_Sent to your Inbox! ✅_" }, { quoted: message });
    }

  } catch (error) {
    console.error("Forward Error:", error);
    await client.sendMessage(from, {
      text: "❌ Error forwarding message:\n" + error.message
    }, { quoted: message });
  }
});
