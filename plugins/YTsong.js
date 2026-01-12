const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

// track ongoing audio upload (to avoid multiple)
let isUploading = false;

// 🎵 .yta command
cmd({
  pattern: "yta",
  alias: ["ytsong", "ytaudio", "song", "audio"],
  desc: "🎧 Download YouTube Audio via Senal YT DL",
  category: "download",
  react: "🎵",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗ Please provide a YouTube link or song name.");

    await reply("⏳ *Searching YouTube... Please wait!*");

    const search = await yts(q);
    const data = search.videos[0];
    if (!data?.videoId) return reply("❌ No results found.");

    // 🔗 Fetch MP3 info from API
    const apiUrl = `https://senalytdl.vercel.app/mp3?id=${data.videoId}`;
    const { data: res } = await axios.get(apiUrl);
    if (!res.downloadUrl) return reply("❌ Failed to fetch audio.");

    const caption = `
🎧 *${res.title}*
👤 *Developer:* Mr Sayura
💾 *Format:* MP3 (${res.quality} kbps)
⏱ *Duration:* ${Math.floor(res.duration / 60)}:${(res.duration % 60).toString().padStart(2,"0")}
🔗 *Source:* YouTube
    `.trim();

    const buttons = [
      { buttonId: `playnow_${data.videoId}`, buttonText: { displayText: "▶️ Play Audio" }, type: 1 },
      { buttonId: `down_${data.videoId}`, buttonText: { displayText: "⬇️ Download Audio" }, type: 1 },
      { buttonId: "api_info", buttonText: { displayText: "ℹ️ API Info" }, type: 1 }
    ];

    await conn.sendMessage(from, {
      image: { url: res.thumbnail },
      caption,
      footer: "🚀 Powered by Sayura YT DL",
      buttons,
      headerType: 1 // ✅ must be 1 for buttons
    }, { quoted: mek });

  } catch (err) {
    console.error("Error in .yta command:", err);
    reply("❌ An error occurred while processing the song.");
  }
});

// 🔘 Button click handler using Baileys RC9 events
conn.ev.on('messages.upsert', async ({ messages, type }) => {
  try {
    const msg = messages[0];
    if (!msg.message?.buttonsResponseMessage) return;

    const btnId = msg.message.buttonsResponseMessage.selectedButtonId;
    const from = msg.key.remoteJid;
    const mek = msg;

    if (isUploading) {
      await conn.sendMessage(from, { text: '*A song is already being sent. Please wait ⏳*' }, { quoted: mek });
      return;
    }

    // ▶️ Play Audio
    if (btnId.startsWith("playnow_")) {
      const videoId = btnId.split("_")[1];
      await conn.sendMessage(from, { text: "⏳ *Fetching and sending audio...*" }, { quoted: mek });

      const { data: res } = await axios.get(`https://senalytdl.vercel.app/mp3?id=${videoId}`);
      if (!res.downloadUrl) return conn.sendMessage(from, { text: "❌ Failed to fetch audio." }, { quoted: mek });

      isUploading = true;
      await conn.sendMessage(from, {
        audio: { url: res.downloadUrl },
        mimetype: "audio/mpeg",
        ptt: false,
        caption: `🎵 *${res.title}*\n✅ Sent by *Mr Sayura*`
      }, { quoted: mek });
      isUploading = false;
    }

    // ⬇️ Download as MP3 document
    else if (btnId.startsWith("down_")) {
      const videoId = btnId.split("_")[1];
      await conn.sendMessage(from, { text: "⏳ *Downloading audio...*" }, { quoted: mek });

      const { data: res } = await axios.get(`https://senalytdl.vercel.app/mp3?id=${videoId}`);
      if (!res.downloadUrl) return conn.sendMessage(from, { text: "❌ Failed to fetch audio." }, { quoted: mek });

      isUploading = true;
      await conn.sendMessage(from, {
        document: { url: res.downloadUrl },
        mimetype: "audio/mpeg",
        fileName: `${res.title}.mp3`,
        caption: "✅ MP3 file sent by *Mr Sayura*"
      }, { quoted: mek });
      isUploading = false;
    }

    // ℹ️ API Info
    else if (btnId === "api_info") {
      await conn.sendMessage(from, {
        text: `
🧠 *Sayura YT DL API Info*
👨‍💻 Developer: Mr Sayura
📦 Project: Sayura YT DL v2.0
🔗 Base URL: https://senalytdl.vercel.app/
🎵 Endpoint: /mp3?id=VIDEO_ID
        `.trim()
      }, { quoted: mek });
    }

  } catch (err) {
    console.error("Button handler error:", err);
  }
});
