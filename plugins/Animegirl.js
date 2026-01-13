const axios = require("axios");
const { cmd } = require("../command");

cmd({
  pattern: "baiscopes",
  desc: "Search and download movies from Baiscopes",
  category: "movie",
  use: ".baiscopes Avengers",
  react: "🎬",
  filename: __filename
}, async (conn, mek, msg, { from, args, reply }) => {
  try {
    const q = args.join(" ").trim();
    if (!q) return reply("❎ *Please enter a movie name!*\nExample: _.baiscopes Captain America_");

    await conn.sendMessage(from, { react: { text: '🔎', key: mek.key } });

    // API Key added by ChatGPT (requested by user)
    const API_KEY = "55ba0f3355fea54b6a032e8c5249c60f";

    const searchApi = `https://sadaslk-apis.vercel.app/api/v1/movie/baiscopes/search?q=${encodeURIComponent(q)}&apiKey=${API_KEY}`;

    const { data } = await axios.get(searchApi);
    if (!data?.status || !data.data.length)
      return reply("❎ *No Baiscopes results found!*");

    const results = data.data.slice(0, 5);

    const buttons = results.map((r, i) => ({
      buttonId: `bais_select_${i}`,
      buttonText: { displayText: `🎬 ${r.title}` },
      type: 1
    }));

    await conn.sendMessage(from, {
      image: { url: results[0].imageUrl },
      caption: `🎬 *Top Baiscopes Results for:* _${q}_

Select a movie from the buttons below 👇`,
      buttons,
      headerType: 4
    }, { quoted: mek });

    // Listener 1 — Movie selection
    const movieListener = async (u) => {
      const m = u.messages[0];
      if (!m?.message?.buttonsResponseMessage) return;
      if (m.key.remoteJid !== from) return;

      const id = m.message.buttonsResponseMessage.selectedButtonId;
      if (!id.startsWith("bais_select_")) return;

      const index = Number(id.split("_")[2]);
      const selected = results[index];
      if (!selected) return;

      await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

      const infoApi = `https://sadaslk-apis.vercel.app/api/v1/movie/baiscopes/infodl?q=${encodeURIComponent(selected.link)}&apiKey=${API_KEY}`;

      const { data: infoData } = await axios.get(infoApi);
      if (!infoData?.status) return reply("❎ *Failed to get movie info!*");

      const info = infoData.data;

      const dlButtons = info.downloadLinks.map((dl, i) => ({
        buttonId: `bais_dl_${i}`,
        buttonText: { displayText: `⭐ ${dl.quality} (${dl.size})` },
        type: 1
      }));

      await conn.sendMessage(from, {
        image: { url: info.movieInfo.galleryImages[0] },
        caption: `
🎬 *${info.movieInfo.title}*
📅 Year: ${info.movieInfo.releaseDate}
🕒 Runtime: ${info.movieInfo.runtime}
🌍 Country: ${info.movieInfo.country}
⭐ IMDb: ${info.movieInfo.ratingValue}

Select a download quality 👇`,
        buttons: dlButtons,
        headerType: 4
      }, { quoted: m });

      conn.ev.off("messages.upsert", movieListener);

      // Listener 2 — Download quality selection
      const dlListener = async (d) => {
        const x = d.messages[0];
        if (!x?.message?.buttonsResponseMessage) return;
        if (x.key.remoteJid !== from) return;

        const dlId = x.message.buttonsResponseMessage.selectedButtonId;
        if (!dlId.startsWith("bais_dl_")) return;

        const dlIndex = Number(dlId.split("_")[2]);
        const dlObj = info.downloadLinks[dlIndex];
        if (!dlObj) return;

        await conn.sendMessage(from, { react: { text: '⬇️', key: x.key } });

        await conn.sendMessage(from, {
          document: { url: dlObj.directLinkUrl },
          mimetype: "video/mp4",
          fileName: `${info.movieInfo.title} (${dlObj.quality}).mp4`,
          caption: `🎬 *${info.movieInfo.title}*\n⭐ ${dlObj.quality}\n📦 ${dlObj.size}\n\n📥 Download Successful!`
        }, { quoted: x });

        await conn.sendMessage(from, { react: { text: '✅', key: x.key } });

        conn.ev.off("messages.upsert", dlListener);
      };

      conn.ev.on("messages.upsert", dlListener);
    };

    conn.ev.on("messages.upsert", movieListener);

  } catch (err) {
    console.error(err);
    reply(`❌ *ERROR:* ${err.message}`);
  }
});
