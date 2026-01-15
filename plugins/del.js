// ========================
// VAJIRA MD MOVIE-DL BOT
// ========================

const { cmd } = require('../command');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { sizeFormatter } = require('human-readable');
const config = require('../config');

const FOOTER = "✫☘VAJIRA MD MOVIE-DL☢️☘";

// ───────── Wait for multi-reply helper ─────────
function waitForReply(conn, from, replyToId, timeout = 120000) {
    return new Promise((resolve, reject) => {
        const handler = (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message) return;
            const ctx = msg.message?.extendedTextMessage?.contextInfo;
            const text = msg.message.conversation || msg.message?.extendedTextMessage?.text;
            if (msg.key.remoteJid === from && ctx?.stanzaId === replyToId) {
                conn.ev.off("messages.upsert", handler);
                resolve(text.trim());
            }
        };
        conn.ev.on("messages.upsert", handler);
        setTimeout(() => {
            conn.ev.off("messages.upsert", handler);
            reject(new Error("Reply timeout"));
        }, timeout);
    });
}

// ───────── Make thumbnail ─────────
async function makeThumbnail(url) {
    try {
        const img = await axios.get(url, { responseType: "arraybuffer" });
        return await sharp(img.data).resize(300).jpeg({ quality: 65 }).toBuffer();
    } catch {
        return null;
    }
}

// ───────── Google Drive download ─────────
async function GDriveDl(url) {
    const formatSize = sizeFormatter({ std: 'JEDEC', decimalPlaces: 2 });
    try {
        if (!url.match(/drive\.google/i)) return { error: true };
        const id = (url.match(/\/?id=(.+)/i) || url.match(/\/d\/(.*?)\//))[1];
        if (!id) throw 'Drive ID not found';

        const res = await fetch(`https://drive.google.com/uc?id=${id}&authuser=0&export=download`, {
            method: 'POST',
            headers: {
                'accept-encoding': 'gzip, deflate, br',
                'content-length': 0,
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'origin': 'https://drive.google.com',
                'user-agent': 'Mozilla/5.0',
                'x-drive-first-party': 'DriveWebUi',
                'x-json-requested': 'true'
            }
        });

        const { fileName, sizeBytes, downloadUrl } = JSON.parse((await res.text()).slice(4));
        if (!downloadUrl) throw 'Download Limit Reached';

        const data = await fetch(downloadUrl);
        if (data.status !== 200) throw 'Failed to fetch file';

        return {
            downloadUrl,
            fileName,
            fileSize: formatSize(sizeBytes),
            mimetype: data.headers.get('content-type')
        };

    } catch (e) {
        return { error: true, message: e.message };
    }
}

// =========================
// Movie main command
// =========================
cmd({
    pattern: "movie",
    category: "movie",
    react: "🎬",
    desc: "Search movies & select site + subtitle + info",
    filename: __filename
}, async (conn, mek, m, { reply, from, q, prefix }) => {
    try {
        if (!q) return reply('*Please provide movie name!*');

        const sites = [
            { name: "Cinesubz", cmd: "cinesubz" },
            { name: "Sinhalasub", cmd: "sinhalasub" },
            { name: "Ytsmx", cmd: "ytsmx" },
            { name: "Pirate", cmd: "pirate" },
            { name: "Slanimeclub", cmd: "slanimeclub" },
            { name: "Ginisisila", cmd: "ginisisila" },
            { name: "Firemoviehub", cmd: "firemovie" }
        ];

        // List movie sites
        let listText = "🎬 *Select Movie Site*\n\n";
        sites.forEach((s, i) => listText += `*${i+1}.* ${s.name}\n`);
        const siteMsg = await conn.sendMessage(from, { text: listText + "\nReply number:" }, { quoted: m });

        const siteSel = await waitForReply(conn, from, siteMsg.key.id);
        const siteIndex = parseInt(siteSel)-1;
        if (isNaN(siteIndex) || !sites[siteIndex]) return reply("❌ Invalid number");
        const siteCmd = sites[siteIndex].cmd;

        // Call the site command (example: cinesubz, pirate, etc.)
        return conn.sendMessage(from, { text: `✅ You selected: ${sites[siteIndex].name}\nRun: ${prefix}${siteCmd} ${q}` }, { quoted: m });

    } catch (e) {
        console.error(e);
        reply("⚠️ Error: " + e.message);
    }
});

// =========================
// Ginisisila cartoon search
// =========================
cmd({
    pattern: "ginisisila",
    react: '📑',
    category: "movie",
    desc: "Ginisisila cartoon search",
    filename: __filename
}, async (conn, m, mek, { from, prefix, q, reply }) => {
    try {
        if (!q) return reply('*Please provide cartoon name!*');
        const url = `https://ginisisilacartoon.net/search.php?q=${q}`;
        const res = await axios.get(url);
        const $ = cheerio.load(res.data);

        const results = [];
        $("#page_panels_ > table > tbody > tr > td > div").each((i, el) => {
            results.push({
                title: $(el).find("div.video-title").text(),
                date: $(el).find("div.posted-time").text(),
                link: $(el).find("a").attr("href")
            });
        });
        if (!results.length) return reply("❌ No cartoons found!");

        // send list
        let listMsgText = "🎬 *Select Cartoon*\n\n";
        results.forEach((r,i) => listMsgText += `*${i+1}.* ${r.title} | ${r.date}\n`);
        const listMsg = await conn.sendMessage(from, { text: listMsgText + "\nReply number:" }, { quoted: m });

        const sel = await waitForReply(conn, from, listMsg.key.id);
        const index = parseInt(sel)-1;
        if (isNaN(index) || !results[index]) return reply("❌ Invalid number");

        const cartoonLink = results[index].link;

        // GDrive iframe parse
        const genUrl = `https://ginisisilacartoon.net/${cartoonLink}`;
        const pageRes = await axios.get(genUrl);
        const $$ = cheerio.load(pageRes.data);
        const download = $$("#player-holder > div > iframe").attr("src");
        const title = $$("#watch-contentHd").text();

        await conn.sendMessage(from, {
            text: `📃 Title: ${title}\n⬇️ Downloading from Google Drive...`
        }, { quoted: m });

        const file = await GDriveDl(download);
        if (file.error) return reply(`⚠️ Failed: ${file.message || 'Unknown error'}`);

        await conn.sendMessage(from, {
            document: { url: file.downloadUrl },
            fileName: file.fileName,
            mimetype: file.mimetype,
            caption: `📥 Downloaded: ${file.fileName}\n📦 Size: ${file.fileSize}`
        }, { quoted: m });

    } catch (e) {
        console.error(e);
        reply("⚠️ Error: " + e.message);
    }
});
