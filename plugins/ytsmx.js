const { cmd } = require("../command");
const axios = require("axios");

cmd({
  pattern: "sinhalasubk",
  alias: ["ssub", "sinhala"],
  desc: "Search SinhalaSub Movies + Info + Download",
  category: "movie",
  react: "🎬",
  filename: __filename
},
async (sock, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❎ Please enter a movie name!\nExample: .sinhalasubk Titanic");

    await sock.sendMessage(from, { react: { text: "🕵️", key: m.key } });

    const searchApi = `https://test-sadaslk-apis.vercel.app/api/v1/movie/sinhalasub/search?q=${encodeURIComponent(q)}&apiKey=55ba0f3355fea54b6a032e8c5249c60f`;
    const { data } = await axios.get(searchApi);

    if (!data?.data || data.data.length === 0) return reply("❎ No SinhalaSub movies found!");

    const results = data.data.slice(0, 3);

    let caption = `🎬 *Top results for:* ${q}\n\n`;
    results.forEach((movie, i) => {
      caption += `*${i + 1}. ${movie.Title}* (${movie.Year})\n`;
    });
    caption += `\nReply with number (1-${results.length}) to see details & download links.`;

    const sentMsg = await sock.sendMessage(from, {
      image: { url: results[0].Img },
      caption
    }, { quoted: mek });

    const listener = async (update) => {
      const m2 = update.messages[0];
      if (!m2.message) return;

      const text = m2.message.conversation || m2.message.extendedTextMessage?.text;
      const isReply = m2.message.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id;

      if (isReply && ["1", "2", "3"].includes(text)) {
        const index = parseInt(text) - 1;
        const selected = results[index];

        await sock.sendMessage(from, { react: { text: "⏳", key: m2.key } });

        try {
          const infoApi = `https://test-sadaslk-apis.vercel.app/api/v1/movie/sinhalasub/infodl?q=${selected.Link}&apiKey=55ba0f3355fea54b6a032e8c5249c60f`;
          const { data } = await axios.get(infoApi);
          const movie = data?.data;

          if (!movie) return reply("❎ Info not found.");

          let desc = `🎬 *${movie.title}* | සිංහල උපසිරසි සමඟ\n\n`;
          desc += `📅 Year: ${movie.date}\n🌍 Country: ${movie.country}\n⭐ Rating: ${movie.rating}\n💬 Subtitles: ${movie.subtitles}\n\n`;
          desc += `📖 ${movie.description}\n\n*💬 Download Options:*\n`;

          movie.downloadLinks.forEach((dl, i) => {
            desc += `${i + 1}️⃣ ║❯❯ ${dl.quality} (${dl.size})\n`;
          });

          const infoMsg = await sock.sendMessage(from, {
            image: { url: movie.images[0] },
            caption: desc
          }, { quoted: m2 });

          await sock.sendMessage(from, { react: { text: "🎬", key: m2.key } });

          const dlListener = async (dlUpdate) => {
            const d = dlUpdate.messages[0];
            if (!d.message) return;

            const text2 = d.message.conversation || d.message.extendedTextMessage?.text;
            const isReply2 = d.message.extendedTextMessage?.contextInfo?.stanzaId === infoMsg.key.id;

            if (isReply2) {
              const dlIndex = parseInt(text2) - 1;
              const dlObj = movie.downloadLinks[dlIndex];

              if (!dlObj) return reply("❎ Invalid download option.");

              await sock.sendMessage(from, { react: { text: "⬇️", key: d.key } });

              let finalLink = dlObj.link;

              if (finalLink.includes("pixeldrain.com")) {
                const fileId = finalLink.split("/u/")[1];
                finalLink = `https://pixeldrain.com/api/file/${fileId}`;
              }

              if (finalLink.includes("drive.google.com")) {
                const fileId = finalLink.match(/[-\w]{25,}/)?.[0];
                finalLink = `https://drive.google.com/uc?export=download&id=${fileId}`;
              }

              await sock.sendMessage(from, {
                document: { url: finalLink },
                mimetype: "video/mp4",
                fileName: `${movie.title} (${dlObj.quality}).mp4`,
                caption: `🎬 *${movie.title}*\n💿 Quality: ${dlObj.quality}\n📦 Size: ${dlObj.size}`
              }, { quoted: d });

              await sock.sendMessage(from, { react: { text: "✅", key: d.key } });

              sock.ev.off("messages.upsert", dlListener);
            }
          };

          sock.ev.on("messages.upsert", dlListener);
          sock.ev.off("messages.upsert", listener);

        } catch (err) {
          reply(`❌ Error: ${err.message}`);
          sock.ev.off("messages.upsert", listener);
        }
      }
    };

    sock.ev.on("messages.upsert", listener);

  } catch (err) {
    reply(`❌ ERROR: ${err.message}`);
  }
});
