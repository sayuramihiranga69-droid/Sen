const axios = require("axios");
const { cmd } = require("../command");

cmd({
  pattern: "pixeldrain",
  alias: ["pix"],
  desc: "Pixeldrain file එක WhatsApp එකට සෘජුව එවන්න",
  react: "🌐",
  category: "download",
  filename: __filename
}, async (conn, m, store, { from, q, reply }) => {
  try {
    if (!q) return reply("❌ කරුණාකර Pixeldrain ලින්ක් එකක් ලබා දෙන්න.");

    await conn.sendMessage(from, { react: { text: "⬇️", key: m.key } });

    let fileUrl = q.trim();

    // Pixeldrain file එක WhatsApp එකට document එකක් වගේ එවන්න
    await conn.sendMessage(from, {
      document: { url: fileUrl },
      mimetype: "application/octet-stream",
      fileName: `pixeldrain_${Date.now()}.mp4`,
      caption: "📥 Pixeldrain එකෙන් සෘජුව ලබා ගන්නා ලදි"
    }, { quoted: m });

    await conn.sendMessage(from, { react: { text: "✅", key: m.key } });

  } catch (e) {
    console.error("Pixeldrain සෘජු එවීමේ දෝෂය:", e);
    reply("❌ Pixeldrain file එක සෘජුව එවීමට නොහැක.");
  }
});
