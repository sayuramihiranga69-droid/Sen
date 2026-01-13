const { cmd } = require('../command');
const axios = require('axios');

const API_BASE = "https://test-sadaslk-apis.vercel.app/api/v1/movie/sinhalasub";
const API_KEY = "55ba0f3355fea54b6a032e8c5249c60f";

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
    if (!q) return reply("❌ Please provide a movie name");

    reply("🕵️ Searching SinhalaSub...");

    const searchUrl = `${API_BASE}/search?q=${encodeURIComponent(q)}&apiKey=${API_KEY}`;
    const { data } = await axios.get(searchUrl);

    if (!data?.data || data.data.length === 0)
      return reply("❌ No SinhalaSub movies found!");

    const results = data.data.slice(0, 3);
    let msgText = `🎬 Top results for: ${q}\n\n`;
    results.forEach((movie, i) => {
      msgText += `${i + 1}. ${movie.Title} (${movie.Year})\n`;
    });
    msgText += `\nReply with number (1-${results.length}) to see details.`;

    const sentMsg = await conn.sendMessage(from, { text: msgText }, { quoted: mek });

    // Listener for selection
    const listener = async (update) => {
      const m2 = update.messages[0];
      if (!m2.message) return;

      const text = m2.message.conversation || m2.message.extendedTextMessage?.text;
      const isReply = m2.message.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id;

      if (isReply && ["1","2","3"].includes(text)) {
        const index = parseInt(text)-1;
        const movieLink = results[index].Link;

        reply("⏳ Fetching movie details...");

        const infoUrl = `${API_BASE}/infodl?q=${movieLink}&apiKey=${API_KEY}`;
        const { data: infoData } = await axios.get(infoUrl);
        const movie = infoData?.data;

        if (!movie) return reply("❌ Movie info not found!");

        let desc = `🎬 ${movie.title}\n\n📅 ${movie.date}\n🌍 ${movie.country}\n⭐ ${movie.rating}\n💬 Subtitles: ${movie.subtitles}\n\n📖 ${movie.description}\n\n`;
        desc += `Download options:\n`;
        movie.downloadLinks.slice(0,3).forEach((dl,i) => {
          desc += `${i+1}. ${dl.quality} (${dl.size})\n`;
        });

        const infoMsg = await conn.sendMessage(from, { text: desc }, { quoted: m2 });

        // Download listener
        const dlListener = async (dlUpdate) => {
          const d = dlUpdate.messages[0];
          if (!d.message) return;

          const text2 = d.message.conversation || d.message.extendedTextMessage?.text;
          const isReply2 = d.message.extendedTextMessage?.contextInfo?.stanzaId === infoMsg.key.id;

          if (isReply2 && ["1","2","3"].includes(text2)) {
            const dlIndex = parseInt(text2)-1;
            let finalLink = movie.downloadLinks[dlIndex].link;

            // PixelDrain fix
            if (finalLink.includes("pixeldrain.com")) {
              const fileId = finalLink.split("/u/")[1];
              finalLink = `https://pixeldrain.com/api/file/${fileId}`;
            }

            // Google Drive fix
            if (finalLink.includes("drive.google.com")) {
              const fileId = finalLink.match(/[-\w]{25,}/)?.[0];
              finalLink = `https://drive.google.com/uc?export=download&id=${fileId}`;
            }

            await conn.sendMessage(from, {
              document: { url: finalLink },
              mimetype: "video/mp4",
              fileName: `${movie.title} (${movie.downloadLinks[dlIndex].quality}).mp4`,
              caption: `🎬 ${movie.title}\n💿 ${movie.downloadLinks[dlIndex].quality}`
            }, { quoted: d });

            conn.ev.off("messages.upsert", dlListener);
          }
        };

        conn.ev.on("messages.upsert", dlListener);
        conn.ev.off("messages.upsert", listener);
      }
    };

    conn.ev.on("messages.upsert", listener);

  } catch (e) {
    console.error(e);
    reply(`❌ ERROR: ${e.message}`);
  }
});
