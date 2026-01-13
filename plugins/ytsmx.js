// ===============================
// 📌 SINHALA SUB MOVIE SEARCH PLUGIN
// ===============================

const axios = require("axios");

module.exports = {
  name: "sinhalasub",
  alias: ["ssub", "sinhala"],
  desc: "Search SinhalaSub Movies + Info + Download",
  category: "movie",
  usage: ".sinhalasub <movie name>",
  react: "🎬",

  start: async (sock, msg, { args, sender }) => {
    try {
      const q = args.join(" ");
      if (!q)
        return sock.sendMessage(msg.from, {
          text: '❎ Please enter a movie name or year!\n\nExample: *.sinhalasub Titanic*'
        }, { quoted: msg });

      await sock.sendMessage(msg.from, { react: { text: "🕵️", key: msg.key } });

      // 🔥 API KEY ADDED
      const searchApi = `https://test-sadaslk-apis.vercel.app/api/v1/movie/sinhalasub/search?q=${encodeURIComponent(q)}&apiKey=55ba0f3355fea54b6a032e8c5249c60f`;
      const { data } = await axios.get(searchApi);

      if (!data?.data || data.data.length === 0)
        return sock.sendMessage(msg.from, { text: "❎ No SinhalaSub movies found!" }, { quoted: msg });

      const results = data.data.slice(0, 3);

      let caption = `🎬 *Top SinhalaSub Results for:* ${q}\n\n`;
      results.forEach((movie, i) => {
        caption += `*${i + 1}. ${movie.Title}*\n📅 ${movie.Year} | ${movie.Type}\n💿 ${movie.Quality}\n\n`;
      });

      caption += `*💬 Reply with number (1-${results.length}) to view details.*`;

      const sentMsg = await sock.sendMessage(msg.from, {
        image: { url: results[0].Img },
        caption
      }, { quoted: msg });

      // ==========================
      //  MOVIE SELECT LISTENER
      // ==========================
      const listener = async (update) => {
        const m = update.messages[0];
        if (!m.message) return;

        const text = m.message.conversation || m.message.extendedTextMessage?.text;
        const isReply =
          m.message.extendedTextMessage &&
          m.message.extendedTextMessage.contextInfo?.stanzaId === sentMsg.key.id;

        if (isReply && ["1", "2", "3"].includes(text)) {
          const index = parseInt(text) - 1;
          const selected = results[index];

          await sock.sendMessage(msg.from, { react: { text: "⏳", key: m.key } });

          try {
            // 🔥 API KEY ADDED
            const infoApi = `https://test-sadaslk-apis.vercel.app/api/v1/movie/sinhalasub/infodl?q=${selected.Link}&apiKey=55ba0f3355fea54b6a032e8c5249c60f`;
            const { data } = await axios.get(infoApi);

            const movie = data?.data;
            if (!movie)
              return sock.sendMessage(msg.from, { text: "❎ Info not found." }, { quoted: m });

            let desc = `🎬 *${movie.title}*\n\n`;
            desc += `🗓 Year: ${movie.date}\n🌍 Country: ${movie.country}\n⏱ Duration: ${movie.duration}\n⭐ Rating: ${movie.rating}\n👤 Author: ${movie.author}\n💬 Subtitles: ${movie.subtitles}\n\n`;
            desc += `📖 ${movie.description}\n\n`;
            desc += `*💬 Select a download option:*\n`;

            movie.downloadLinks.slice(0, 3).forEach((dl, i) => {
              desc += `${i + 1}️⃣ ║❯❯ ${dl.quality} (${dl.size})\n`;
            });

            const infoMsg = await sock.sendMessage(msg.from, {
              image: { url: movie.images[0] },
              caption: desc
            }, { quoted: m });

            await sock.sendMessage(msg.from, { react: { text: "🎬", key: m.key } });

            // ==========================
            // DOWNLOAD LISTENER
            // ==========================
            const dlListener = async (dlUpdate) => {
              const d = dlUpdate.messages[0];
              if (!d.message) return;

              const text2 = d.message.conversation || d.message.extendedTextMessage?.text;
              const isReply2 =
                d.message.extendedTextMessage &&
                d.message.extendedTextMessage.contextInfo?.stanzaId === infoMsg.key.id;

              if (isReply2 && ["1", "2", "3"].includes(text2)) {
                const dlIndex = parseInt(text2) - 1;
                const dlObj = movie.downloadLinks[dlIndex];

                if (!dlObj)
                  return sock.sendMessage(msg.from, { text: "❎ Invalid download option." }, { quoted: d });

                await sock.sendMessage(msg.from, { react: { text: "⬇️", key: d.key } });

                try {
                  let finalLink = dlObj.link;

                  // PixelDrain Fix
                  if (finalLink.includes("pixeldrain.com")) {
                    const fileId = finalLink.split("/u/")[1];
                    finalLink = `https://pixeldrain.com/api/file/${fileId}`;
                  }

                  // Google Drive Fix
                  if (finalLink.includes("drive.google.com")) {
                    const fileId = finalLink.match(/[-\w]{25,}/)?.[0];
                    finalLink = `https://drive.google.com/uc?export=download&id=${fileId}`;
                  }

                  await sock.sendMessage(msg.from, {
                    document: { url: finalLink },
                    mimetype: "video/mp4",
                    fileName: `${movie.title} (${dlObj.quality}).mp4`,
                    caption: `🎬 *${movie.title}*\n💿 Quality: ${dlObj.quality}\n📦 Size: ${dlObj.size}`
                  }, { quoted: d });

                  await sock.sendMessage(msg.from, { react: { text: "✅", key: d.key } });

                } catch (err) {
                  await sock.sendMessage(msg.from, { react: { text: "❌", key: d.key } });
                  await sock.sendMessage(msg.from, {
                    text: `❌ Download failed!\n\nDirect link:\n${finalLink}`
                  }, { quoted: d });
                }

                sock.ev.off("messages.upsert", dlListener);
              }
            };

            sock.ev.on("messages.upsert", dlListener);
            sock.ev.off("messages.upsert", listener);

          } catch (err) {
            await sock.sendMessage(msg.from, { react: { text: "❌", key: m.key } });
            await sock.sendMessage(msg.from, { text: `❌ Error: ${err.message}` }, { quoted: m });
            sock.ev.off("messages.upsert", listener);
          }
        }
      };

      sock.ev.on("messages.upsert", listener);

    } catch (err) {
      await sock.sendMessage(msg.from, { react: { text: "❌", key: msg.key } });
      await sock.sendMessage(msg.from, { text: `❌ ERROR: ${err.message}` }, { quoted: msg });
    }
  }
};
