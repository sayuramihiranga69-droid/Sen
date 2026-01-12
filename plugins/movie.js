const config = require('../config');
const { cmd } = require('../command');
const axios = require('axios');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// ================= GLOBAL =================
let primeUsers = [];
global.lastSearch = global.lastSearch || {};
let isUploadingg = false;

// ================= LOAD PRIME USERS =================
async function loadPrimeUsers() {
  try {
    const res = await axios.get('https://raw.githubusercontent.com/sayuramihiranga69-droid/Data/refs/heads/main/prime_users.json');
    const raw = res.data || {};

    if (raw.numbers) {
      if (typeof raw.numbers === "string") {
        primeUsers = raw.numbers.split(',').map(x => x.trim());
      } else if (Array.isArray(raw.numbers)) {
        primeUsers = raw.numbers.map(x => x.toString().trim());
      }
    }

    console.log('[✔️] Prime users loaded:', primeUsers);
  } catch (err) {
    console.error('[❌] Failed loading prime users:', err);
  }
}
loadPrimeUsers();

// ================= CHECK PREMIUM =================
function isPremiumUser(userId) {
  return primeUsers.includes(userId);
}

// ================= SINHALA SUB SEARCH =================
cmd({
    pattern: "sinhalasub",
    react: '🔎',
    category: "movie",
    alias: ["sinsub"],
    desc: "Search movies on sinhalasub.lk",
    use: ".sinhalasub <movie name>",
    filename: __filename
}, async (conn, m, mek, { from, q, isPre, isMe, reply }) => {
    try {
        if (!q) return reply('*Please enter a movie name! 🎬*');

        // PREMIUM CHECK
        if (!isPremiumUser(m.sender) && !isMe && !isPre) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return await conn.sendMessage(from, {
                text: "*`You are not a premium user⚠️`*\n\n" +
                      "*Send a message to buy Lifetime premium 📤.*\n\n" +
                      "_Price : 100 LKR_\n\n" +
                      "*Contact: 94754871798*"
            }, { quoted: mek });
        }

        // FETCH MOVIE RESULTS
        const { data: apiRes } = await axios.get(`https://visper-md-ap-is.vercel.app/movie/sinhalasub/search?q=${encodeURIComponent(q)}`);
        let results = [];
        if (Array.isArray(apiRes)) results = apiRes;
        else if (Array.isArray(apiRes.result)) results = apiRes.result;
        else if (Array.isArray(apiRes.results)) results = apiRes.results;
        else if (Array.isArray(apiRes.data)) results = apiRes.data;

        if (!results.length) return reply('*No results found ❌*');

        // PREPARE TEXT REPLY
        let text = `_*SINHALASUB MOVIE SEARCH RESULTS 🎬*_ \n\n*🔎 Input:* ${q}\n\n`;
        results.forEach((v, i) => {
            const title = (v.Title || v.title || "Unknown Title").replace(/Sinhala Subtitles\s*\|?\s*සිංහල උපසිරසි.*/gi,"").trim();
            const year = v.Year || '';
            const quality = v.Quality || '';
            const link = v.Link || v.link || '';
            text += `*${i+1}. ${title} (${year})*\nQuality: ${quality}\nLink: ${link}\n\n`;
        });

        await reply(text);

    } catch (e) {
        console.error("🔥 SinhalaSub Error:", e);
        reply('🚫 *Error Occurred !!*\n\n' + e.message);
    }
});

// ================= SININFO MOVIE DETAILS =================
cmd({
    pattern: "sininfo",
    alias: ["mdv"],
    react: "🎥",
    desc: "Movie details from sinhalasub.lk",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply('🚩 *Please give me a valid movie URL!*');

        const { data } = await axios.get(`https://visper-md-ap-is.vercel.app/movie/sinhalasub/info?q=${encodeURIComponent(q)}`);
        const sadas = data.result;
        if (!sadas || Object.keys(sadas).length === 0) return reply('*🚫 No details found for this movie!*');

        let msg = `*🌾 Title:* *_${sadas.title || 'N/A'}_*\n`;
        msg += `*📅 Released:* _${sadas.date || 'N/A'}_\n`;
        msg += `*🌎 Country:* _${sadas.country || 'N/A'}_\n`;
        msg += `*💃 Rating:* _${sadas.rating || 'N/A'}_\n`;
        msg += `*⏰ Runtime:* _${sadas.duration || 'N/A'}_\n`;
        msg += `*🕵️ Subtitle By:* _${sadas.author || 'N/A'}_\n\n`;

        if (sadas.downloadLinks && sadas.downloadLinks.length > 0) {
            msg += "*Available Download Links:*\n";
            sadas.downloadLinks.forEach((v, i) => {
                msg += `${i+1}. ${v.size || 'N/A'} - ${v.quality || 'Unknown Quality'}\nLink: ${v.link}\n\n`;
            });
        }

        await reply(msg);

    } catch (e) {
        console.error(e);
        reply('🚫 *Error Occurred !!*\n\n' + e.message);
    }
});

// ================= SEND MOVIE FILE =================
cmd({
    pattern: "sindl",
    react: "⬇️",
    dontAddCommandList: true,
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (isUploadingg) return reply('*A movie is already being uploaded. Please wait ⏳*');

    try {
        const [pix, imglink, title] = q.split("±");
        if (!pix || !imglink || !title) return reply("⚠️ Invalid format. Use:\n`sindl link±img±title`");

        const da = pix.split("https://pixeldrain.com/u/")[1];
        if (!da) return reply("⚠️ Couldn’t extract Pixeldrain file ID.");

        const fileUrl = `https://pixeldrain.com/api/file/${da}`;
        isUploadingg = true;
        conn.sendMessage(from, { text: '*Uploading your movie.. ⬆️*', quoted: mek });

        await conn.sendMessage(from, {
            document: { url: fileUrl },
            mimetype: "video/mp4",
            fileName: `🎬 ${title}.mp4`,
            caption: `🎬 ${title}\n\n${config.NAME}\n\n${config.FOOTER}`
        });

        conn.sendMessage(from, { text: '*Movie sent successfully ✔*', quoted: mek });

    } catch (e) {
        reply('🚫 *Error Occurred !!*\n\n' + e.message);
        console.error("sindl error:", e);
    } finally {
        isUploadingg = false;
    }
});

// ================= MOVIE DETAILS SHORT =================
cmd({
    pattern: "daqt",
    react: "🎥",
    alias: ["mdv"],
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply('🚩 *Please give me a valid movie URL!*');

        const { data } = await axios.get(`https://visper-md-ap-is.vercel.app/movie/sinhalasub/info?q=${encodeURIComponent(q)}`);
        const sadas = data.result;
        if (!sadas || Object.keys(sadas).length === 0) return reply('*🚫 No details found for this movie!*');

        let msg = `*🍿 Title:* *_${sadas.title || 'N/A'}_*\n`;
        msg += `*📅 Released:* _${sadas.date || 'N/A'}_\n`;
        msg += `*🌎 Country:* _${sadas.country || 'N/A'}_\n`;
        msg += `*💃 Rating:* _${sadas.rating || 'N/A'}_\n`;
        msg += `*⏰ Runtime:* _${sadas.duration || 'N/A'}_\n`;
        msg += `*🕵️ Subtitle By:* _${sadas.author || 'N/A'}_`;

        await reply(msg);

    } catch (error) {
        console.error('Error fetching movie:', error);
        reply('🚫 *Error Occurred !!*\n\n' + error.message);
    }
});
