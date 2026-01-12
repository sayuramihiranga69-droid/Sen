
const config = require('../config');
const { cmd, commands } = require('../command');
const axios = require('axios');
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const apiKey = 'prabath_sk_5f6b6518b2aed4142f92d01f6c5f1026b88df3d3';

// ================= GLOBAL =================
let primeUsers = [];
global.lastSearch = global.lastSearch || {};
let isUploadingg = false;

// ================= LOAD PRIME USERS =================
async function loadPrimeUsers() {
  try {
    const res = await axios.get('https://raw.githubusercontent.com/sayuramihiranga69-droid/Data/refs/heads/main/prime_users.json');
    const raw = res.data || {};
    if (raw.numbers) primeUsers = raw.numbers.split(',').map(x => x.trim());
    console.log('[✔️] Prime users loaded:', primeUsers);
  } catch (err) {
    console.error('[❌] Failed loading prime users:', err);
  }
}
loadPrimeUsers();

// ================= CINÉ SEARCH =================
cmd({
  pattern: "cine",
  react: '🔎',
  category: "movie",
  alias: ["cinesubz"],
  desc: "Search movie from cinesubz.co",
  filename: __filename
}, async (conn, m, mek, { from, q, prefix, isPre, isMe, reply }) => {
  try {
    const pr = (await axios.get('https://raw.githubusercontent.com/sayuramihiranga69-droid/Data/refs/heads/main/main_var.json')).data;
    const isFree = pr.mvfree === "true";

    const senderNum = m.sender.replace(/[^0-9]/g, "");
    const isPremiumNumber = primeUsers.includes(senderNum);

    if (!isFree && !isMe && !isPre && !isPremiumNumber) {
      await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
      return await conn.sendMessage(from, {
        text: "*❗ You are not a premium user*\n\nPrice: 2000 LKR\nContact: 0743826406 , 0777145463"
      }, { quoted: mek });
    }

    if (!q) return await reply('*Please give a movie name 🎬*');

    const searchRes = await fetch('https://api.prabath.top/api/v1/cinesubz/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ query: q })
    }).then(res => res.json());

    if (!searchRes.data || searchRes.data.length === 0) {
      await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
      return await reply('*No results found ❌*');
    }

    // Save search results for this user
    global.lastSearch[m.sender] = searchRes.data;

    let listMsg = `_*CINESUBZ MOVIE SEARCH RESULTS 🎬*_ \n\n*Input:* ${q}\n\n`;
    searchRes.data.forEach((v, i) => {
      const titleClean = v.title.replace(/Sinhala Subtitles|සිංහල උපසිරැසි සමඟ/gi, "").trim();
      listMsg += `*${i + 1}.* ${titleClean}\n`;
    });
    listMsg += `\n*Reply with the number of the movie to get download links*`;

    await reply(listMsg);

  } catch (err) {
    console.error(err);
    await reply('🚩 *Error fetching movies*');
  }
});

// ================= NUMBER REPLY HANDLER =================
cmd({
  pattern: /^\d+$/,
  dontAddCommandList: true
}, async (conn, m, mek, { from, prefix, reply }) => {
  const num = parseInt(m.text);
  const data = global.lastSearch?.[m.sender];
  if (!data || !data[num - 1]) return;

  const movieLink = data[num - 1].link;
  await reply(`✅ Selected movie: ${data[num - 1].title}\nFetching details...`);

  const cinedlCmd = commands.get('cinedl');
  if (cinedlCmd) {
    await cinedlCmd.callback(conn, m, mek, { from, q: movieLink, prefix, reply });
  }
});

// ================= CINÉDL COMMAND =================
cmd({
  pattern: "cinedl",
  react: '🎥',
  desc: "Movie details and quality selection",
  filename: __filename
}, async (conn, m, mek, { from, q, prefix, reply }) => {
  try {
    if (!q || !q.includes('cinesubz')) return await reply('*❗ Invalid Link!*');

    const movieRes = await fetch('https://api.prabath.top/api/v1/cinesubz/movie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ url: q })
    }).then(res => res.json());

    if (!movieRes.data) return await reply('🚩 *Could not fetch movie info!*');

    const s = movieRes.data;
    let msg = `*🎬 Title:* ${s.title}\n` +
              `*📅 Released:* ${s.date || 'N/A'}\n` +
              `*💃 Rating:* ${s.imdb || 'N/A'}\n` +
              `*⏰ Runtime:* ${s.runtime || 'N/A'}\n` +
              `*🎭 Genres:* ${s.genres ? s.genres.join(', ') : 'N/A'}\n`;

    // Show qualities as list message
    s.dl_links.forEach((v, i) => {
      msg += `\n*${i + 1}.* ${v.quality} (${v.size}) → reply: paka ${s.image}±${s.title}±${v.link}±${v.quality}`;
    });

    await reply(msg);

  } catch (err) {
    console.error(err);
    await reply('🚩 *Error fetching movie details*');
  }
});

// ================= PAKA COMMAND =================
cmd({
  pattern: "paka",
  react: "⬇️",
  dontAddCommandList: true,
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  if (!q) return;
  if (isUploadingg) return await reply('*A movie is already being uploaded. Please wait...* ⏳');

  try {
    const [img, title, dlLink, quality] = q.split("±");
    isUploadingg = true;

    await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

    const dlRes = await fetch('https://api.prabath.top/api/v1/cinesubz/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ url: dlLink })
    }).then(res => res.json());

    const directLink = dlRes.data.direct || dlRes.data.gdrive2 || dlRes.data.pixeldrain;
    if (!directLink) {
      isUploadingg = false;
      return await reply("*🚩 Link generation failed!*");
    }

    const up_mg = await conn.sendMessage(from, { text: '*Uploading your movie..⬆️*' });

    await conn.sendMessage(config.JID || from, {
      document: { url: directLink },
      caption: `*🎬 Name:* ${title}\n*🌟 Quality:* ${quality}\n\n${config.FOOTER}`,
      mimetype: "video/mp4",
      fileName: `${title} (${quality}).mp4`,
      jpegThumbnail: await (await fetch(img)).buffer()
    });

    await conn.sendMessage(from, { delete: up_mg.key });
    await conn.sendMessage(from, { react: { text: '✔️', key: mek.key } });

  } catch (err) {
    console.error(err);
    await reply("🚩 *Upload Failed!*");
  } finally {
    isUploadingg = false;
  }
});
