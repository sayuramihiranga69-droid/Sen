const { cmd } = require("../command");
const { getSearch, getDetails, getDownload } = require('sinhalasub.lk');
const NodeCache = require("node-cache");

const cache = new NodeCache({ stdTTL: 1800, checkperiod: 600 }); // cache 30 min

// ================== SINHALA SUB MOVIE SEARCH ==================
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
    const cacheKey = `sinhalasub_${q.toLowerCase()}`;
    let data = cache.get(cacheKey);

    if (!data) {
      data = await getSearch(q);
      cache.set(cacheKey, data);
    }

    if (!data.status || data.result.length === 0) {
      return conn.sendMessage(from, { text: "No movies found!" }, { quoted: mek });
    }

    // send first 5 results
    let text = `🎬 *Search results for:* ${q}\n\n`;
    data.result.slice(0, 5).forEach((movie, i) => {
      text += `${i+1}. ${movie.title}\n📅 Year: ${movie.year || 'N/A'} | ⭐ ${movie.rating || 'N/A'}\n🔗 ${movie.link}\n\n`;
    });
    text += `Reply with the number to get download links`;

    const sentMsg = await conn.sendMessage(from, { text }, { quoted: mek });

    // store message for reply handling
    conn.pendingReplies = conn.pendingReplies || {};
    conn.pendingReplies[m.id] = { movies: data.result.slice(0,5), from };

  } catch (err) {
    console.log(err);
    conn.sendMessage(from, { text: "❌ Error fetching movies" }, { quoted: mek });
  }
});

// ================== REPLY HANDLER ==================
cmd({
  pattern: "reply",
  desc: "Handle reply for sinhalasub",
  category: "media",
  filename: __filename
}, async (conn, mek, m, { from, quoted, text }) => {
  if (!quoted || !conn.pendingReplies) return;
  const pending = conn.pendingReplies[quoted.id];
  if (!pending) return;

  let choice = parseInt(text);
  if (!choice || choice < 1 || choice > pending.movies.length) {
    return conn.sendMessage(from, { text: "❌ Invalid choice" }, { quoted: mek });
  }

  const movie = pending.movies[choice-1];

  try {
    const details = await getDetails(movie.link);
    let msg = `🎬 *${details.result.title}*\n\n`;
    msg += `📅 ${details.result.year} | ⭐ ${details.result.rating}\n`;
    msg += `🎞 Categories: ${details.result.category.join(", ")}\n\n`;
    msg += `🔗 Download Links:\n`;
    details.result.dl_links.forEach(dl => {
      msg += `- ${dl.quality || 'Subtitles'}: ${dl.link} (${dl.size})\n`;
    });

    conn.sendMessage(from, { text: msg, quoted: mek });
  } catch (err) {
    console.log(err);
    conn.sendMessage(from, { text: "❌ Error fetching movie details" }, { quoted: mek });
  }

  // remove pending
  delete conn.pendingReplies[quoted.id];
});
