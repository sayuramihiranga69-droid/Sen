const config = require('../config')
const { cmd } = require('../command')
const axios = require('axios')
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args))

// ================= GLOBAL =================
let primeUsers = [];
global.lastSearch = global.lastSearch || {};
let isUploadingg = {}; // per-user upload flag

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
  // Normalize sender: remove @s.whatsapp.net if present
  const normalized = userId.split('@')[0];
  return primeUsers.includes(normalized);
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
}, async (conn, m, mek, { from, q, prefix, isPre, isMe, reply }) => {
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
        const results = apiRes.result || [];
        if (!results.length) return reply('*No results found ❌*');

        // CREATE BUTTONS/LIST
        let srh = results
            .filter(v => v.Link) // make sure Link exists
            .map(v => ({
                title: (v.Title || v.title || "Unknown Title")
                        .replace(/Sinhala Subtitles\s*\|?\s*සිංහල උපසිරසි.*/gi,"")
                        .trim(),
                rowId: prefix + 'sininfo ' + v.Link,
                description: ""
            }));

        if (!srh.length) return reply('*No valid results to show ❌*');

        await conn.sendMessage(from, {
            text: `_*SINHALASUB MOVIE SEARCH RESULTS 🎬*_\n\n*🔎 Input:* ${q}`,
            footer: config.FOOTER || "🎬 SENAL-MD 🎬",
            title: 'sinhalasub.lk Results 🎥',
            buttonText: 'Select Movie',
            sections: [{ title: "Results", rows: srh }]
        }, { quoted: mek });

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
}, async (conn, mek, m, { from, q, prefix, reply }) => {
    try {
        if (!q) return reply('🚩 *Please give me a valid movie URL!*');

        const { data } = await axios.get(`https://visper-md-ap-is.vercel.app/movie/sinhalasub/info?q=${encodeURIComponent(q)}`);
        const sadas = data.result;
        if (!sadas || Object.keys(sadas).length === 0) return reply('*🚫 No details found for this movie!*');

        const msg = `*🌾 Title:* *_${sadas.title || 'N/A'}_*\n` +
                    `*📅 Released:* _${sadas.date || 'N/A'}_\n` +
                    `*🌎 Country:* _${sadas.country || 'N/A'}_\n` +
                    `*💃 Rating:* _${sadas.rating || 'N/A'}_\n` +
                    `*⏰ Runtime:* _${sadas.duration || 'N/A'}_\n` +
                    `*🕵️ Subtitle By:* _${sadas.author || 'N/A'}_`;

        const rows = [
            { buttonId: prefix + 'daqt ' + q, buttonText: { displayText: '💡 Details' }, type: 1 },
            { buttonId: prefix + 'ch ' + q, buttonText: { displayText: '🖼️ Images' }, type: 1 }
        ];

        if (sadas.downloadLinks?.length) {
            sadas.downloadLinks.forEach(v => {
                if (!v.link) return;
                rows.push({
                    buttonId: prefix + `sindl ${v.link}±${sadas.images?.[1] || ''}±${sadas.title}`,
                    buttonText: { displayText: `${v.size || 'N/A'} - ${v.quality || 'Unknown'}` },
                    type: 1
                });
            });
        }

        await conn.sendMessage(from, {
            image: { url: sadas.images?.[0] || config.LOGO },
            caption: msg,
            footer: config.FOOTER || "🎬 SENAL-MD 🎬",
            buttons: rows,
            headerType: 4
        }, { quoted: mek });

    } catch (e) {
        console.error(e);
        reply('🚫 *Error Occurred !!*\n\n' + e);
    }
});

// ================= SEND MOVIE FILE =================
cmd({
    pattern: "sindl",
    react: "⬇️",
    dontAddCommandList: true,
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    const userFlag = m.sender;
    if (isUploadingg[userFlag]) return reply('*A movie is already being uploaded. Please wait ⏳*');

    try {
        const [pix, imglink, title] = q.split("±");
        if (!pix || !imglink || !title) return reply("⚠️ Invalid format. Use:\n`sindl link±img±title`");

        const match = pix.match(/pixeldrain\.com\/u\/([a-zA-Z0-9]+)/);
        if (!match) return reply("⚠️ Couldn’t extract Pixeldrain file ID.");
        const fileId = match[1];
        const fileUrl = `https://pixeldrain.com/api/file/${fileId}`;

        isUploadingg[userFlag] = true;
        await conn.sendMessage(from, { text: '*Uploading your movie.. ⬆️*', quoted: mek });

        await conn.sendMessage(from, {
            document: { url: fileUrl },
            mimetype: "video/mp4",
            fileName: `🎬 ${title}.mp4`,
            caption: `🎬 ${title}\n\n${config.NAME}\n\n${config.FOOTER}`
        });

        await conn.sendMessage(from, { text: '*Movie sent successfully ✔*', quoted: mek });

    } catch (e) {
        reply('🚫 *Error Occurred !!*\n\n' + e.message);
        console.error("sindl error:", e);
    } finally {
        isUploadingg[userFlag] = false;
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

        const msg = `*🍿 Title:* *_${sadas.title || 'N/A'}_*\n` +
                    `*📅 Released:* _${sadas.date || 'N/A'}_\n` +
                    `*🌎 Country:* _${sadas.country || 'N/A'}_\n` +
                    `*💃 Rating:* _${sadas.rating || 'N/A'}_\n` +
                    `*⏰ Runtime:* _${sadas.duration || 'N/A'}_\n` +
                    `*🕵️ Subtitle By:* _${sadas.author || 'N/A'}_`;

        await conn.sendMessage(from, {
            image: { url: sadas.images?.[0] || config.LOGO },
            caption: msg,
            footer: config.FOOTER || "🎬 SENAL-MD 🎬"
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✔️', key: mek.key } });

    } catch (error) {
        console.error('Error fetching movie:', error);
        reply('🚫 *Error Occurred !!*\n\n' + error.message);
    }
});
