const { cmd } = require('../command');
const axios = require('axios');

cmd({
  pattern: "sinhalasubk",
  alias: ["ssub", "sinhala"],
  desc: "Search SinhalaSub Movies + Info + Download",
  category: "movie",
  react: "🎬",
  filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply(`❎ Please enter a movie name\n\nExample: .sinhalasubk Titanic`);

    await reply("🕵️ Searching SinhalaSub...");

    const searchApi = `https://sadaslk-apis.vercel.app/api/v1/movie/sublk/search?q=${encodeURIComponent(q)}&apiKey=a3b8844e3897880d75331c5b2526d701`;
    const { data } = await axios.get(searchApi);

    if (!data?.data || data.data.length === 0) return reply("❎ No SinhalaSub movies found!");

    const results = data.data.slice(0, 3);

    let message = `🎬 *Top results for:* ${q}\n\n`;
    results.forEach((movie, i) => {
      message += `*${i + 1}. ${movie.title}* (${movie.releaseDate})\n`;
    });
    message += `\n*💬 Reply with number (1-${results.length}) to see details & download links.*`;

    await conn.sendMessage(from, { image: { url: results[0].imageUrl }, caption: message }, { quoted: mek });

    // ==========================
    // MOVIE SELECT LISTENER
    // ==========================
    const listener = async (update) => {
      const mm = update.messages[0];
      if (!mm.message) return;

      const text = mm.message.conversation || mm.message.extendedTextMessage?.text;
      const isReply = mm.message.extendedTextMessage &&
                      mm.message.extendedTextMessage.contextInfo?.stanzaId;

      if (["1", "2", "3"].includes(text)) {
        const index = parseInt(text) - 1;
        const selected = results[index];
        await reply("⏳ Fetching movie details...");

        try {
          const infoApi = `https://sadaslk-apis.vercel.app/api/v1/movie/sublk/infodl?q=${encodeURIComponent(selected.url)}&apiKey=a3b8844e3897880d75331c5b2526d701`;
          const { data } = await axios.get(infoApi);
          const movie = data?.data;

          if (!movie) return reply("❎ Info not found");

          let desc = `🎬 *${movie.title}* | සිංහල උපසිරසි සමඟ\n\n`;
          desc += `📅 Year: ${movie.releaseDate}\n🌍 Country: ${movie.country}\n⭐ Rating: ${movie.ratingValue}\n\n`;
          desc += `📖 ${movie.tagline || ''}\n\n`;
          desc += `*💬 Download Options:*\n\n`;

          movie.pixeldrainDownloads.forEach((dl, i) => {
            let finalLink = dl.finalDownloadUrl;
            if (finalLink.includes("pixeldrain.com")) {
              const fileId = finalLink.split("/u/")[1];
              finalLink = `https://pixeldrain.com/api/file/${fileId}`;
            }
            if (finalLink.includes("drive.google.com")) {
              const fileId = finalLink.match(/[-\w]{25,}/)?.[0];
              finalLink = `https://drive.google.com/uc?export=download&id=${fileId}`;
            }
            desc += `${i + 1}️⃣ ║❯❯ ${dl.quality} (${dl.size})\n🔗 ${finalLink}\n\n`;
          });

          await conn.sendMessage(from, { image: { url: movie.imageUrl }, caption: desc }, { quoted: mm });
        } catch (err) {
          reply(`❌ Error: ${err.message}`);
        }

        conn.ev.off("messages.upsert", listener);
      }
    };

    conn.ev.on("messages.upsert", listener);

  } catch (err) {
    reply(`❌ ERROR: ${err.message}`);
  }
});
