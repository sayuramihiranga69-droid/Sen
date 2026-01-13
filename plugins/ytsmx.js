const { cmd } = require('../command');
const axios = require('axios');

const CREATOR = "Vajira";

cmd({
  pattern: "sinhalasubk",
  alias: ["ssubk", "sinhala"],
  desc: "Search SinhalaSub Movies + Info + Direct Download Links",
  category: "movie",
  react: "🎬",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗ Please provide a movie name\nExample: .sinhalasubk Titanic");

    await reply("🕵️ Searching SinhalaSub...");

    const searchApi = `https://test-sadaslk-apis.vercel.app/api/v1/movie/sinhalasub/search?q=${encodeURIComponent(q)}&apiKey=55ba0f3355fea54b6a032e8c5249c60f`;
    const { data } = await axios.get(searchApi);

    if (!data?.data || data.data.length === 0) return reply("❌ No SinhalaSub movies found!");

    const results = data.data.slice(0, 3);

    let caption = `🎬 *Top results for:* ${q}\n\n`;
    results.forEach((movie, i) => {
      caption += `*${i + 1}. ${movie.Title}* (${movie.Year})\n`;
    });
    caption += `\nReply with number (1-${results.length}) to see details & download links.`;

    const sentMsg = await conn.sendMessage(from, {
      image: { url: results[0].Img },
      caption
    }, { quoted: mek });

    // ──────────────── LISTENER ────────────────
    const listener = async (update) => {
      const m2 = update.messages[0];
      if (!m2.message) return;

      const text = m2.message.conversation || m2.message.extendedTextMessage?.text;
      const isReply = m2.message.extendedTextMessage &&
                      m2.message.extendedTextMessage.contextInfo?.stanzaId === sentMsg.key.id;

      if (isReply && ["1","2","3"].includes(text)) {
        const index = parseInt(text) - 1;
        const selected = results[index];

        await conn.sendMessage(from, { react: { text: "⏳", key: m2.key } });

        try {
          const infoApi = `https://test-sadaslk-apis.vercel.app/api/v1/movie/sinhalasub/infodl?q=${selected.Link}&apiKey=55ba0f3355fea54b6a032e8c5249c60f`;
          const { data } = await axios.get(infoApi);
          const movie = data?.data;
          if (!movie) return reply("❌ Movie info not found!");

          let msgText = `🎬 *${movie.title}*\n\n`;
          msgText += `📅 Year: ${movie.date}\n🌍 Country: ${movie.country}\n⭐ Rating: ${movie.rating}\n💬 Subtitles: ${movie.subtitles}\n\n`;
          msgText += `📖 ${movie.description}\n\n`;
          msgText += `*💬 Download Options:*\n`;

          movie.downloadLinks.slice(0, 5).forEach((dl, i) => {
            msgText += `${i + 1}️⃣ ${dl.quality} (${dl.size})\n`;
          });

          const infoMsg = await conn.sendMessage(from, {
            image: { url: movie.images[0] },
            caption: msgText
          }, { quoted: m2 });

          // ──────────────── DOWNLOAD LINKS ────────────────
          const dlListener = async (dlUpdate) => {
            const d = dlUpdate.messages[0];
            if (!d.message) return;

            const text2 = d.message.conversation || d.message.extendedTextMessage?.text;
            const isReply2 = d.message.extendedTextMessage &&
                             d.message.extendedTextMessage.contextInfo?.stanzaId === infoMsg.key.id;

            if (isReply2 && ["1","2","3","4","5"].includes(text2)) {
              const dlIndex = parseInt(text2) - 1;
              const dlObj = movie.downloadLinks[dlIndex];
              if (!dlObj) return reply("❌ Invalid option", from, { quoted: d });

              let finalLink = dlObj.link;

              // PixelDrain
              if (finalLink.includes("pixeldrain.com")) {
                const fileId = finalLink.split("/u/")[1];
                finalLink = `https://pixeldrain.com/api/file/${fileId}`;
              }

              // Google Drive
              if (finalLink.includes("drive.google.com")) {
                const fileId = finalLink.match(/[-\w]{25,}/)?.[0];
                finalLink = `https://drive.google.com/uc?export=download&id=${fileId}`;
              }

              await conn.sendMessage(from, {
                text: `✅ Download Link Ready:\n\n${finalLink}`
              }, { quoted: d });

              conn.ev.off("messages.upsert", dlListener);
            }
          };

          conn.ev.on("messages.upsert", dlListener);
          conn.ev.off("messages.upsert", listener);

        } catch (err) {
          await reply(`❌ Error: ${err.message}`, from, { quoted: m2 });
          conn.ev.off("messages.upsert", listener);
        }
      }
    };

    conn.ev.on("messages.upsert", listener);

  } catch (err) {
    await reply(`❌ ERROR: ${err.message}`, from, { quoted: mek });
  }
});
