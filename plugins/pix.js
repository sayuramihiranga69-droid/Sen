const axios = require("axios");
const { cmd } = require("../command");

cmd({
  pattern: "pixeldrain",
  alias: ["pix"],
  desc: "Download PixelDrain files",
  react: "🌐",
  category: "download",
  filename: __filename
}, async (conn, m, store, { from, q, reply }) => {
  try {
    if (!q) return reply("❌ Please provide a PixelDrain link.");

    await conn.sendMessage(from, { react: { text: "⬇️", key: m.key } });

    const apiUrl = `https://api-dark-shan-yt.koyeb.app/download/pixeldrain?url=${encodeURIComponent(q)}&apikey=deb4e2d4982c6bc2`;

    const { data } = await axios.get(apiUrl);

    // ✅ Check API response
    if (!data.status || !data.data || !data.data.success) {
      return reply("⚠️ Invalid PixelDrain link or API error.");
    }

    const file = data.data;

    await conn.sendMessage(from, { react: { text: "⬆️", key: m.key } });

    await conn.sendMessage(from, {
      document: { url: file.download },
      fileName: file.filename || "pixeldrain_file.mp4",
      mimetype: "application/octet-stream",
      caption:
        `📁 *File:* ${file.filename}\n` +
        `📦 *Size:* ${file.size}\n\n` +
        `*© Powered By 𝙳𝙰𝚁𝙺-𝙺𝙽𝙸𝙶𝙷𝚃-𝚇𝙼𝙳*`
    }, { quoted: m });

    await conn.sendMessage(from, { react: { text: "✅", key: m.key } });

  } catch (e) {
    console.error("PixelDrain Error:", e);
    reply("❌ Failed to download PixelDrain file.");
  }
});
