const { cmd } = require("../command");
const sinhalasub = require("sinhalasub.lk");

const getSearch = sinhalasub.getSearch || sinhalasub.default?.getSearch;

cmd({
  pattern: "sinhalasub",
  alias: ["ssub","sublk"],
  desc: "🎬 Search Sinhala Sub movies",
  category: "media",
  react: "🎬",
  filename: __filename
}, async (conn, mek, m, { from, q }) => {
  if (!q) return conn.sendMessage(from, { text: "Use: .sinhalasub <movie name>" }, { quoted: mek });

  try {
    const data = await getSearch(q); // search API call

    if (!data.status || !data.result || data.result.length === 0) {
      return conn.sendMessage(from, { text: "❌ No movies found!" }, { quoted: mek });
    }

    let text = `🎬 *Search results for:* ${q}\n\n`;
    data.result.slice(0, 5).forEach((movie, i) => {
      text += `${i+1}. ${movie.title}\n📅 Year: ${movie.year || 'N/A'} | ⭐ ${movie.rating || 'N/A'}\n🔗 ${movie.link}\n\n`;
    });

    conn.sendMessage(from, { text }, { quoted: mek });

  } catch (err) {
    console.log(err);
    conn.sendMessage(from, { text: "❌ Error fetching movies" }, { quoted: mek });
  }
});
