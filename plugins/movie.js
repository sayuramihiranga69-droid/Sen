const config = require('../config');
const { cmd, commands } = require('../command');
const axios = require('axios');
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { fetchJson } = require('../lib/functions2');

const apiKey = 'prabath_sk_5f6b6518b2aed4142f92d01f6c5f1026b88df3d3';

//=================== PRIME USERS LOADER ===================
let primeUsers = [];

async function loadPrimeUsers() {
  try {
    const res = await axios.get('https://raw.githubusercontent.com/sayuramihiranga69-droid/Data/refs/heads/main/prime_users.json');
    const raw = res.data || {};
    if (raw.numbers) {
      primeUsers = raw.numbers.split(',').map(x => x.trim());
      console.log('[✔️] Loaded prime users:', primeUsers);
    }
  } catch (err) {
    console.error('[❌] Failed loading prime users list:', err);
  }
}

// Load on start
loadPrimeUsers();

// Optional reload command
cmd({
  pattern: "reloadprime",
  desc: "Reload prime users list",
}, async (conn, m, { reply }) => {
  await loadPrimeUsers();
  await reply('*✅ Premium list reloaded!*');
});

//=========================================================================================================================
// CINÉ COMMAND
cmd({
  pattern: "cine",
  react: '🔎',
  category: "movie",
  alias: ["cinesubz"],
  desc: "cinesubz.co movie search",
  use: ".cine 2025",
  filename: __filename
},
async (conn, m, mek, { from, q, prefix, isPre, isMe, reply }) => {
  try {
    const pr = (await axios.get('https://raw.githubusercontent.com/sayuramihiranga69-droid/Data/refs/heads/main/main_var.json')).data;
    const isFree = pr.mvfree === "true";

    const senderNum = m.sender.replace(/[^0-9]/g, "");
    const isPremiumNumber = primeUsers.includes(senderNum);

    if (!isFree && !isMe && !isPre && !isPremiumNumber) {
      await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
      return await conn.sendMessage(from, {
        text: "*`You are not a premium user⚠️`*\n\n" +
              "*Send a message to one of the 2 numbers below and buy Lifetime premium 🫟.*\n\n" +
              "_Price : 2000 LKR ✔️_\n\n" +
              "*👨‍💻Contact us : 0743826406 , 0777145463*"
      }, { quoted: mek });
    }

    if (!q) return await reply('*Please give me a movie name 🎬*');

    const searchRes = await fetch('https://api.prabath.top/api/v1/cinesubz/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ "query": q })
    }).then(res => res.json());

    if (!searchRes.data || searchRes.data.length === 0) {
      await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
      return await conn.sendMessage(from, { text: '*No results found ❌*' }, { quoted: mek });
    }

    const rowss = searchRes.data.map((v) => ({
      title: v.title.replace(/Sinhala Subtitles|සිංහල උපසිරැසි සමඟ/gi, "").trim(),
      id: prefix + `cinedl ${v.link}`
    }));

    const listButtons = {
      title: "Choose a Movie :)",
      sections: [{ title: "Available Results", rows: rowss }]
    };

    const caption = `_*CINESUBZ MOVIE SEARCH RESULTS 🎬*_ \n\n*\`Input :\`* ${q}`;

    if (config.BUTTON === "true") {
      await conn.sendMessage(from, {
        image: { url: config.LOGO },
        caption: caption,
        footer: config.FOOTER,
        buttons: [{
          buttonId: "movie_select",
          buttonText: { displayText: "🎥 Select Movie" },
          type: 4,
          nativeFlowInfo: { name: "single_select", paramsJson: JSON.stringify(listButtons) }
        }],
        viewOnce: true
      }, { quoted: mek });
    } else {
      let listMsg = caption + "\n\n";
      searchRes.data.forEach((v, i) => {
        listMsg += `*${i + 1}.* ${v.title}\n`;
      });
      await reply(listMsg);
    }

  } catch (e) {
    console.log(e);
    await conn.sendMessage(from, { text: '🚩 *Error !!*' }, { quoted: mek });
  }
});

//=========================================================================================================================
// CINÉDL COMMAND
cmd({
  pattern: "cinedl",
  react: '🎥',
  desc: "movie info & quality selector",
  filename: __filename
},
async (conn, m, mek, { from, q, prefix, reply }) => {
  try {
    if (!q || !q.includes('cinesubz')) {
      return await reply('*❗ Invalid Link!*');
    }

    const movieRes = await fetch('https://api.prabath.top/api/v1/cinesubz/movie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ "url": q })
    }).then(res => res.json());

    if (!movieRes.data) return await reply('🚩 *Could not fetch movie info!*');

    const s = movieRes.data;
    let msg = `*☘️ 𝗧ɪᴛʟᴇ ➮* *_${s.title}_*\n\n` +
              `*📅 𝗥ᴇʟᴇꜱᴇᴅ ➮* _${s.date || 'N/A'}_\n` +
              `*💃 𝗥ᴀᴛɪɴɢ ➮* _${s.imdb || 'N/A'}_\n` +
              `*⏰ 𝗥ᴜɴᴛɪᴍᴇ ➮* _${s.runtime || 'N/A'}_\n` +
              `*💁‍♂️ 𝗦ᴜʙᴛɪᴛʟᴇ ʙʏ ➮* _${s.subtitle_author || 'N/A'}_\n` +
              `*🎭 𝗚ᴇɴᴀʀᴇꜱ ➮* ${s.genres ? s.genres.join(', ') : 'N/A'}\n`;

    const rowss = movieRes.dl_links.map((v) => ({
      title: `${v.quality} (${v.size})`,
      id: prefix + `paka ${s.image}±${s.title}±${v.link}±${v.quality}`
    }));

    const listButtons = {
      title: "🎬 Choose a download link:",
      sections: [{ title: "Available Qualities", rows: rowss }]
    };

    if (config.BUTTON === "true") {
      await conn.sendMessage(from, {
        image: { url: s.image },
        caption: msg,
        footer: config.FOOTER,
        buttons: [
          {
            buttonId: prefix + 'ctdetails ' + q,
            buttonText: { displayText: "Details Send" },
            type: 1
          },
          {
            buttonId: "dl_select",
            buttonText: { displayText: "🎥 Select Quality" },
            type: 4,
            nativeFlowInfo: { name: "single_select", paramsJson: JSON.stringify(listButtons) }
          }
        ],
        viewOnce: true
      }, { quoted: mek });
    } else {
      await reply(msg + "\n\n*Quality links fetched. Please use buttons.*");
    }

  } catch (e) {
    console.log(e);
    await reply('🚩 *Error fetching movie details !!*');
  }
});

//=========================================================================================================================
// PAKA COMMAND
let isUploadingg = false;

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
      body: JSON.stringify({ "url": dlLink })
    }).then(res => res.json());

    const directLink = dlRes.data.direct || dlRes.data.gdrive2 || dlRes.data.pixeldrain;

    if (!directLink) {
      isUploadingg = false;
      return await reply("*🚩 Link generation failed!*");
    }

    const up_mg = await conn.sendMessage(from, { text: '*Uploading your movie..⬆️*' });

    await conn.sendMessage(config.JID || from, {
      document: { url: directLink },
      caption: `*🎬 Name :* ${title}\n*🌟 Quality :* ${quality}\n\n${config.FOOTER}`,
      mimetype: "video/mp4",
      fileName: `${title} (${quality}).mp4`,
      jpegThumbnail: await (await fetch(img)).buffer()
    });

    await conn.sendMessage(from, { delete: up_mg.key });
    await conn.sendMessage(from, { react: { text: '✔️', key: mek.key } });

  } catch (error) {
    console.error(error);
    await reply("🚩 *Upload Failed!*");
  } finally {
    isUploadingg = false;
  }
});

//=========================================================================================================================
// CTDETAILS COMMAND
cmd({
  pattern: "ctdetails",
  react: '🎥',
  desc: "details card",
  filename: __filename
},
async (conn, m, mek, { from, q, reply }) => {
  try {
    if (!q) return await reply('*Please provide a link!*');

    const movieRes = await fetch('https://api.prabath.top/api/v1/cinesubz/movie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ "url": q })
    }).then(res => res.json());

    const s = movieRes.data;
    const details = (await axios.get('https://raw.githubusercontent.com/sayuramihiranga69-droid/Data/refs/heads/main/main_var.json')).data;

    let msg = `*☘️ 𝗧ɪᴛʟᴇ ➮* *_${s.title}_*\n\n` +
              `*📅 𝗥ᴇʟᴇꜱᴇᴅ ➮* _${s.date || 'N/A'}_\n` +
              `*💃 𝗥ᴀᴛɪɴɢ ➮* _${s.imdb || 'N/A'}_\n` +
              `*⏰ 𝗥ᴜɴᴛɪᴍᴇ ➮* _${s.runtime || 'N/A'}_\n` +
              `*🎭 𝗚ᴇɴᴀʀᴇꜱ ➮* _${s.genres.join(', ')}_\n\n` +
              `> 🌟 Follow us: *${details.chlink}*`;

    await conn.sendMessage(config.JID || from, { image: { url: s.image }, caption: msg });
    await conn.sendMessage(from, { react: { text: '✔️', key: mek.key } });

  } catch (error) {
    console.error(error);
    await reply('🚩 *Error fetching details!*');
  }
});
