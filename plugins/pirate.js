const { default: makeWASocket, useSingleFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { cmd } = require("../command");
const P = require('pino');
const axios = require('axios');

const { state, saveState } = useSingleFileAuthState('./auth_info.json');

async function startBot() {
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        version
    });

    sock.ev.on('creds.update', saveState);

    const searchMemory = {}; // store search results

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;

        // ===== Command system =====
        if (text.startsWith('.movie ')) {
            const query = text.replace('.movie ', '').trim();
            console.log(`[CMD SEARCH] ${from} searched for: "${query}"`);
            await sock.sendMessage(from, { text: `🔍 Searching for "${query}"...` });

            try {
                const searchApi = `https://ty-opal-eta.vercel.app/movie/pirate/search?text=${encodeURIComponent(query)}`;
                const response = await axios.get(searchApi);
                const results = response.data.result.data;

                if (!results || results.length === 0) {
                    await sock.sendMessage(from, { text: '❌ No movies found.' });
                    return;
                }

                let messageText = '🎬 *Search Results*\n\n';
                results.slice(0, 10).forEach((movie, i) => {
                    messageText += `*${i + 1}.* ${movie.title} | ${movie.year}\nIMDB: ${movie.imdb}\n`;
                });
                messageText += '\nReply with the number of the movie.';
                await sock.sendMessage(from, { text: messageText });

                searchMemory[from] = results; // store results for reply
            } catch (err) {
                console.error('[CMD SEARCH ERROR]', err);
                await sock.sendMessage(from, { text: '❌ Error searching movies.' });
            }
        }

        // ===== Handle number reply =====
        else if (/^\d+$/.test(text)) {
            const index = parseInt(text) - 1;
            const results = searchMemory[from];
            if (!results || !results[index]) return;

            // React to user selection
            try {
                await sock.sendMessage(from, {
                    react: { text: '🔄', key: msg.key }
                });
            } catch (e) {
                console.error('[REACT ERROR]', e);
            }

            const movie = results[index];
            console.log(`[CMD SELECT] ${from} selected: "${movie.title}"`);
            await sock.sendMessage(from, { text: `⬇️ Fetching links for *${movie.title}*...` });

            try {
                const movieApi = `https://ty-opal-eta.vercel.app/movie/pirate/movie?url=${encodeURIComponent(movie.link)}`;
                const res = await axios.get(movieApi);
                const data = res.data.result.data;

                const links = { "480P": {}, "720P": {}, "1080P": {} };
                data.dl_links.forEach(l => {
                    const q = l.quality.toLowerCase();
                    if (q.includes('480')) links["480P"][l.link.includes('mega') ? 'mega' : 'gdrive'] = l.link;
                    else if (q.includes('720')) links["720P"][l.link.includes('mega') ? 'mega' : 'gdrive'] = l.link;
                    else if (q.includes('1080')) links["1080P"][l.link.includes('mega') ? 'mega' : 'gdrive'] = l.link;
                    else if (q.includes('sub') || q.includes('සිංහල')) {
                        links["480P"].sub = l.link;
                        links["720P"].sub = l.link;
                        links["1080P"].sub = l.link;
                    }
                });

                let msgText = `🎬 *${data.title}*\n\n⭐ TMDB: ${data.tmdb || "N/A"}\n📅 Release: ${data.date}\n⏱ Duration: ${data.runtime}\n🎭 Genre: ${data.category.join(', ')}\n🎬 Director: ${data.director}\n\n⬇️ *Download Links*\n`;
                ["480P","720P","1080P"].forEach(q => {
                    msgText += `\n*${q}*\n• Mega: ${links[q].mega || "N/A"}\n• GDrive: ${links[q].gdrive || "N/A"}\n• Subtitles: ${links[q].sub || "N/A"}\n`;
                });
                msgText += '\n✫☘𝐆𝐎𝐉𝐎 𝐌𝐎𝐕𝐈𝐄 𝐇𝐎𝐌☢️☘';

                console.log(`[CMD LINKS] Sent download links for "${data.title}"`);
                await sock.sendMessage(from, {
                    image: { url: data.image },
                    caption: msgText
                });
            } catch (err) {
                console.error('[CMD MOVIE ERROR]', err);
                await sock.sendMessage(from, { text: '❌ Error fetching movie links.' });
            }
        }
    });
}

startBot();
