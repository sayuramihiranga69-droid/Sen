const config = require('../config');
const { cmd } = require('../command');
const axios = require('axios');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
let isUploadinggg = false;

// ===================== PREMIUM CHECK =====================
async function isPremiumUser(userId) {
    try {
        const { data } = await axios.get(
            'https://raw.githubusercontent.com/sayuramihiranga69-droid/Data/refs/heads/main/prime_users.json'
        );
        return data.includes(userId);
    } catch (e) {
        console.error("Premium check failed:", e);
        return false; // Fail-safe: treat as non-premium
    }
}

// ===================== SINHALA SUB SEARCH =====================
cmd({
    pattern: "sinhalasub",
    react: '🔎',
    category: "movie",
    alias: ["sinsub", "sinhalasub"],
    desc: "Search movies on sinhalasub.lk",
    use: ".sinhalasub <movie name>",
    filename: __filename
},
async (conn, m, mek, { from, q, prefix, reply }) => {
    try {
        if (!q) return reply('*Please enter a movie name! 🎬*');

        // Premium check
        const premium = await isPremiumUser(mek.sender);
        if (!premium) {
            return await conn.sendMessage(from, { text: '*❌ Only premium users can use this command!*' }, { quoted: mek });
        }

        // Fetch search results
        const { data } = await axios.get(
            `https://visper-md-ap-is.vercel.app/movie/sinhalasub/search?q=${encodeURIComponent(q)}`
        );

        let results = data.result || [];
        if (!results.length) return reply('*❌ No results found!*');

        const rows = results.map((v, i) => ({
            title: v.title || v.Title || `Unknown Title ${i + 1}`,
            description: "",
            rowId: `${prefix}sininfo ${v.Link || v.link}`
        }));

        const listMessage = {
            text: `_*SINHALASUB MOVIE SEARCH RESULTS 🎬*_ \n\n*Input:* ${q}`,
            footer: config.FOOTER || "🎬 Ｒᴀᴠᴀɴᴀ－Ｘ－Ｍᴅ 🎬",
            title: 'Results 🎥',
            buttonText: 'Select Movie',
            sections: [{ title: 'Available Movies', rows }]
        };

        await conn.sendMessage(from, { listMessage }, { quoted: mek });

    } catch (e) {
        console.error("SinhalaSub search error:", e);
        reply('🚫 *Error Occurred !!*\n\n' + e.message);
    }
});

// ===================== SININFO / MOVIE DETAILS =====================
cmd({
    pattern: "sininfo",
    react: "🎥",
    desc: "Send movie details from sinhalasub.lk",
    filename: __filename
},
async (conn, m, mek, { from, q, prefix, reply }) => {
    try {
        if (!q) return reply('*❌ Please provide a valid movie URL!*');

        const { data } = await axios.get(
            `https://visper-md-ap-is.vercel.app/movie/sinhalasub/info?q=${encodeURIComponent(q)}`
        );
        const movie = data.result;
        if (!movie) return reply('*❌ Movie details not found!*');

        const msg = `*🎬 Title:* ${movie.title || 'N/A'}\n` +
                    `*📅 Released:* ${movie.date || 'N/A'}\n` +
                    `*🌎 Country:* ${movie.country || 'N/A'}\n` +
                    `*💃 Rating:* ${movie.rating || 'N/A'}\n` +
                    `*⏰ Duration:* ${movie.duration || 'N/A'}\n` +
                    `*🕵️ Subtitle by:* ${movie.author || 'N/A'}`;

        // Buttons: Details, Images, Download
        const downloadButtons = (movie.downloadLinks || []).map(dl => ({
            buttonId: `${prefix}sindl ${dl.link}±${movie.images?.[1] || ''}±${movie.title}`,
            buttonText: { displayText: `${dl.size || 'N/A'} - ${dl.quality || 'Unknown'}` },
            type: 1
        }));

        await conn.sendMessage(from, {
            image: { url: movie.images?.[0] || config.LOGO },
            caption: msg,
            footer: config.FOOTER,
            buttons: [
                { buttonId: prefix + 'daqt ' + q, buttonText: { displayText: "Details" }, type: 1 },
                { buttonId: prefix + 'ch ' + q, buttonText: { displayText: "Images" }, type: 1 },
                ...downloadButtons
            ],
            headerType: 1
        }, { quoted: mek });

    } catch (e) {
        console.error("Sininfo error:", e);
        reply('🚫 *Error Occurred !!*\n\n' + e.message);
    }
});

// ===================== SEND MOVIE VIDEO =====================
cmd({
    pattern: "sindl",
    react: "⬇️",
    dontAddCommandList: true,
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    if (isUploadinggg) return reply('*A movie is already being uploaded. Please wait ⏳*');

    try {
        const [pix, imglink, title] = q.split("±");
        if (!pix || !imglink || !title) return reply("⚠️ Invalid format. Use: sindl link±img±title");

        const da = pix.split("https://pixeldrain.com/u/")[1];
        if (!da) return reply("⚠️ Couldn’t extract Pixeldrain file ID.");

        const fhd = `https://pixeldrain.com/api/file/${da}`;
        isUploadinggg = true;

        await conn.sendMessage(from, { text: '*Uploading your movie.. ⬆️*', quoted: mek });
        await conn.sendMessage(from, { 
            document: { url: fhd },
            caption: `🎬 ${title}\n\n${config.NAME}\n\n${config.FOOTER}`,
            mimetype: "video/mp4",
            fileName: `🎬 Ｒᴀᴠᴀɴᴀ－Ｘ－Ｍᴅ 🎬 ${title}.mp4`
        });

        await conn.sendMessage(from, { react: { text: '✔️', key: mek.key } });
        await conn.sendMessage(from, { text: `*Movie sent successfully  ✔*`, quoted: mek });

    } catch (e) {
        reply('🚫 *Error Occurred !!*\n\n' + e.message);
        console.error("sindl error:", e);
    } finally {
        isUploadinggg = false;
    }
});

// ===================== FULL DETAILS COMMAND =====================
cmd({
    pattern: "daqt",
    react: "🎥",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply('*🚩 Please give me a valid movie URL!*');

        const { data } = await axios.get(
            `https://visper-md-ap-is.vercel.app/movie/sinhalasub/info?q=${encodeURIComponent(q)}`
        );
        const movie = data.result;
        if (!movie) return reply('*🚫 No details found!*');

        const msg = `*🍿 Title:* ${movie.title || 'N/A'}\n` +
                    `*📅 Released:* ${movie.date || 'N/A'}\n` +
                    `*🌎 Country:* ${movie.country || 'N/A'}\n` +
                    `*💃 Rating:* ${movie.rating || 'N/A'}\n` +
                    `*⏰ Duration:* ${movie.duration || 'N/A'}\n` +
                    `*🕵️‍♀️ Subtitle by:* ${movie.author || 'N/A'}`;

        await conn.sendMessage(from, {
            image: { url: movie.images?.[0] || config.LOGO },
            caption: msg,
            footer: config.FOOTER || "🎬 Ｒᴀᴠᴀɴᴀ－Ｘ－Ｍᴅ 🎬"
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✔️', key: mek.key } });

    } catch (e) {
        console.error('daqt error:', e);
        reply('🚫 *Error Occurred !!*\n\n' + e.message);
    }
});
