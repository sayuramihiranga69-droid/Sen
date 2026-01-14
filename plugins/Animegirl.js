const config = require('../config');
const { cmd } = require('../command');
const fetch = require('node-fetch');
const fs = require('fs').promises; // Use promises-based fs for async/await
const fsStream = require('fs'); // For streaming
const path = require('path');

// Global message collector to handle multiple selections
const messageCollectors = new Map();

// Helper function to format file size
const formatSize = (bytes) => {
    if (bytes === 0) return '0B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
};

// Helper function to sanitize text
const sanitize = (text) => {
    return text.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim();
};

// Helper function to convert pixeldrain link to download format
const convertPixeldrainLink = (link) => {
    const match = link.match(/pixeldrain\.com\/(?:u|api\/file)\/([a-zA-Z0-9]+)/);
    if (!match) return null;
    const fileId = match[1];
    return `https://pixeldrain.com/api/file/${fileId}?download`;
};

// Helper function to fetch thumbnail as buffer
const fetchThumbnail = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch thumbnail');
        const buffer = await response.buffer();
        return buffer;
    } catch (error) {
        console.error('[THUMBNAIL FETCH ERROR]:', error);
        return null; // Return null if thumbnail fetch fails
    }
};

cmd({
    pattern: "movie",
    alias: ["moviedl", "film"],
    react: "🎬",
    desc: "Search movies/TV shows and send selected file with custom caption and thumbnail or details card to specified JID using Dark Yasiya API",
    category: "download",
    use: ".movie <search query> | <JID>",
    filename: __filename
}, async (conn, m, mek, { from, q, reply }) => {
    try {
        if (!q) return await reply("❌ Please provide a search query and JID (e.g., .movie Deadpool | 120363398809321097@g.us)!");

        // Parse query and JID
        const [searchQuery, targetJid] = q.split('|').map(s => s.trim());
        if (!searchQuery || !targetJid || !targetJid.includes('@g.us')) {
            return await reply("❌ Invalid format! Use: .movie <query> | <group JID>");
        }

        // Log input for debugging
        console.log('[MOVIE INPUT]:', { query: searchQuery, targetJid });

        // Fetch search results using Dark Yasiya API
        const searchUrl = `https://www.dark-yasiya-api.site/movie/sinhalasub/search?text=${encodeURIComponent(searchQuery)}`;
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) throw new Error(`Search API failed with status ${searchResponse.status}`);
        const searchData = await searchResponse.json();

        // Log search response
        console.log('[MOVIE SEARCH RESPONSE]:', searchData);

        if (!searchData?.status || !searchData?.result?.data?.length) {
            return await reply("❌ No movies or TV shows found for your query!");
        }

        // Get all search results
        const items = searchData.result.data;

        // Construct search results message
        let searchResults = `
╭「 *MOVIE SEARCH* 」╮
│
│ 🔎 *Search Query*: ${searchQuery}
│ 📍 *Target JID*: ${targetJid}
│ 📋 *Select a movie/TV show by replying with its number*:
│
${items.map((item, index) => `│ ${index + 1}. ${item.title || "Unknown"} [${item.type}, ${item.year}, ${item.imdb}]`).join('\n')}
│
╰─────────────╯
${config.FOOTER || "*© 𝙿𝙾𝚆𝙴𝚁𝙳 𝙱𝚈 𝚀𝚄𝙴𝙴𝙽 𝙶𝙸𝙼𝙸*"}
`;

        // Send search results message to original chat
        const searchMsg = await conn.sendMessage(
            from,
            { text: searchResults },
            { quoted: mek }
        );

        // Add reaction
        await conn.sendMessage(from, { react: { text: '🔎', key: searchMsg.key } });

        // Create a temporary directory for storing files
        const tempDir = path.join(__dirname, 'temp_movie_downloads');
        await fs.mkdir(tempDir, { recursive: true });

        // Message collector for handling multiple selections
        const collectorKey = `${from}_${searchMsg.key.id}`;
        messageCollectors.set(collectorKey, { items, searchMsg, targetJid });

        // Listen for user replies
        conn.ev.on('messages.upsert', async (messageUpdate) => {
            try {
                const mekInfo = messageUpdate?.messages[0];
                if (!mekInfo?.message) return;

                const messageType = mekInfo?.message?.conversation || mekInfo?.message?.extendedTextMessage?.text;
                const contextInfo = mekInfo?.message?.extendedTextMessage?.contextInfo;
                const isReplyToSentMsg = contextInfo?.stanzaId === searchMsg.key.id;
                const isReplyToInfoMsg = messageCollectors.has(`${from}_${contextInfo?.stanzaId}`);

                if (!isReplyToSentMsg && !isReplyToInfoMsg) return;

                let userReply = messageType.trim();

                if (isReplyToSentMsg) {
                    // Handle movie/TV show selection
                    const selectedIndex = parseInt(userReply) - 1;
                    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= items.length) {
                        return await conn.sendMessage(from, {
                            text: `❌ Invalid selection! Please reply with a number between 1 and ${items.length}`,
                            edit: searchMsg.key
                        });
                    }

                    const selectedItem = items[selectedIndex];

                    // Fetch movie details using Dark Yasiya API
                    const movieUrl = `https://www.dark-yasiya-api.site/movie/sinhalasub/movie?url=${encodeURIComponent(selectedItem.link)}`;
                    const movieResponse = await fetch(movieUrl);
                    if (!movieResponse.ok) throw new Error(`Movie API failed with status ${movieResponse.status}`);
                    const movieData = await movieResponse.json();

                    // Log movie response
                    console.log('[MOVIE DETAILS RESPONSE]:', movieData);

                    if (!movieData?.status || !movieData?.result?.data) {
                        return await reply("❌ Failed to fetch movie/TV show information!");
                    }
                    const movieInfo = movieData.result.data;

                    // Filter and convert pixeldrain links
                    const pixeldrainLinks = movieInfo.dl_links
                        .filter(dl => dl.link.includes('pixeldrain.com'))
                        .map(dl => ({
                            ...dl,
                            link: convertPixeldrainLink(dl.link) || dl.link // Convert to download format
                        }))
                        .filter(dl => dl.link); // Ensure valid links only

                    // Construct info message with thumbnail
                    let info = `
╭「 *MOVIE DOWNLOADER* 」╮
│
│ 🎬 *Title*: ${movieInfo.title || selectedItem.title || "Unknown"}
│ 📂 *Type*: ${selectedItem.type || "Unknown"}
│ 📅 *Release Date*: ${movieInfo.date || selectedItem.year || "N/A"}
│ 🌍 *Country*: ${movieInfo.country || "N/A"}
│ ⏱️ *Runtime*: ${movieInfo.runtime || "N/A"}
│ ⭐ *IMDb Rating*: ${movieInfo.imdbRate ? `${movieInfo.imdbRate} (${movieInfo.imdbVoteCount} votes)` : selectedItem.imdb || "N/A"}
│ 🌟 *TMDb;Rating*: ${movieInfo.tmdbRate || "N/A"}
│ 🎥 *Director*: ${movieInfo.director || "N/A"}
│ 🗂️ *Categories*: ${movieInfo.category?.join(", ") || "N/A"}
│ 💁‍♂️ *Subtitle By*: ${movieInfo.subtitle_author || "N/A"}
│
│ ⬇️ *Options*:
${pixeldrainLinks.length ? pixeldrainLinks.map((dl, index) => `│ 1.${index + 1} ${dl.quality} (${dl.size})`).join('\n') : "│ No pixeldrain download links available"}
│ 2.1 Details Card
│
│ 📋 *Select an option by replying with its number*:
│
╰────────────────╯
${config.FOOTER || "*© 𝙿𝙾𝚆𝙴𝚁𝙳 𝙱𝚈 𝚀𝚄𝙴𝙴𝙽 𝙶𝙸𝙼𝙸*"}
`;

                    // Send thumbnail with info to original chat
                    const infoMsg = await conn.sendMessage(
                        from,
                        {
                            image: { url: movieInfo.image || selectedItem.image || "https://i.imgur.com/404.png" },
                            caption: info
                        },
                        { quoted: mek }
                    );

                    // Add reaction
                    await conn.sendMessage(from, { react: { text: '📥', key: infoMsg.key } });

                    // Store info message for quality/details selection
                    messageCollectors.set(`${from}_${infoMsg.key.id}`, { movieInfo, pixeldrainLinks, selectedItem, infoMsg, targetJid });
                } else if (isReplyToInfoMsg) {
                    // Handle quality or details card selection
                    const { movieInfo, pixeldrainLinks, selectedItem, infoMsg, targetJid } = messageCollectors.get(`${from}_${contextInfo?.stanzaId}`);
                    const userSelection = userReply;

                    if (userSelection === "2.1") {
                        // Send details card to target JID
                        const detailsCard = `
*☘️ 𝗧𝗶𝘁𝗹𝗲 ➮* _${movieInfo.title || selectedItem.title || "Unknown"}_
*📅 𝗥𝗲𝗹𝗲𝗮𝘀𝗲𝗱 𝗗𝗮𝘁𝗲 ➮* _${movieInfo.date || selectedItem.year || "N/A"}_
*🌎 𝗖𝗼𝘂𝗻𝘁𝗿𝘆 ➮* _${movieInfo.country || "N/A"}_
*⏰ 𝗥𝘂𝗻𝘁𝗶𝗺𝗲 ➮* _${movieInfo.runtime || "N/A"}_
*⭐ 𝗜𝗠𝗗𝗯 𝗥𝗮𝘁𝗶𝗻𝗴 ➮* _${movieInfo.imdbRate ? movieInfo.imdbRate + (movieInfo.imdbVoteCount ? ` (${movieInfo.imdbVoteCount} votes)` : "") : selectedItem.imdb || "N/A"}_
*🌟 𝗧𝗠𝗗𝗯 𝗥𝗮𝘁𝗶𝗻𝗴 ➮* _${movieInfo.tmdbRate || "N/A"}_
*🎥 𝗗𝗶𝗿𝗲𝗰𝘁𝗼𝗿 ➮* _${movieInfo.director || "N/A"}_
*🗂️ 𝗖𝗮𝘁𝗲𝗴𝗼𝗿𝗶𝗲𝘀 ➮* _${movieInfo.category?.join(", ") || "N/A"}_
*💁‍♂️ 𝗦𝘂𝗯𝘁𝗶𝘁𝗹𝗲 𝗕𝘆 ➮* _${movieInfo.subtitle_author || "N/A"}_

*𝙲 𝙸 𝙽 𝙴 𝚅 𝙸 𝙱 𝙴 𝚂  𝙻 𝙺*
`;

                        await conn.sendMessage(
                            targetJid,
                            {
                                image: { url: movieInfo.image || selectedItem.image || "https://i.imgur.com/404.png" },
                                caption: detailsCard
                            }
                        );

                        // Send confirmation to original chat
                        await conn.sendMessage(from, {
                            text: `✅ Details card sent successfully to ${targetJid}!`,
                            edit: infoMsg.key
                        });

                        // Add reaction
                        await conn.sendMessage(from, { react: { text: '📋', key: infoMsg.key } });
                    } else {
                        // Handle quality selection
                        const selectedQualityIndex = parseInt(userSelection.split('.')[1]) - 1;
                        if (isNaN(selectedQualityIndex) || selectedQualityIndex < 0 || selectedQualityIndex >= pixeldrainLinks.length) {
                            return await conn.sendMessage(from, {
                                text: `❌ Invalid quality selection! Please reply with a number like 1.1, 1.2, ..., or 2.1 for details card`,
                                edit: infoMsg.key
                            });
                        }

                        const selectedQuality = pixeldrainLinks[selectedQualityIndex];

                        const processingMsg = await conn.sendMessage(from, { text: "⏳ Processing your request..." }, { quoted: mek });

                        // Check file size (WhatsApp document limit ~100MB)
                        const headResponse = await fetch(selectedQuality.link, { method: 'HEAD' });
                        const fileSize = parseInt(headResponse.headers.get('content-length') || '0');
                        if (fileSize > 2000 * 1024 * 1024) {
                            await conn.sendMessage(from, {
                                text: "❌ Video size exceeds WhatsApp's 100MB limit for documents!",
                                edit: processingMsg.key
                            });
                            return await conn.sendMessage(targetJid, {
                                text: `❌ Video size exceeds WhatsApp's 100MB limit for documents! (${selectedQuality.quality}, ${formatSize(fileSize)})`
                            });
                        }

                        // Construct filename
                        const fileName = `${sanitize(movieInfo.title || selectedItem.title || "movie")} - ${selectedQuality.quality}.mp4`.replace(/[^a-z0-9_.-]/gi, '_');
                        const filePath = path.join(tempDir, fileName);

                        // Fetch thumbnail
                        const thumbnailUrl = movieInfo.image || selectedItem.image || "https://i.imgur.com/404.png";
                        const thumbnail = await fetchThumbnail(thumbnailUrl);

                        // Stream file to disk
                        const fileRes = await fetch(selectedQuality.link);
                        if (!fileRes.ok) throw new Error(`Failed to fetch file with status ${fileRes.status}`);
                        const writer = fsStream.createWriteStream(filePath);
                        fileRes.body.pipe(writer);

                        // Wait for the stream to finish
                        await new Promise((resolve, reject) => {
                            writer.on('finish', resolve);
                            writer.on('error', reject);
                        });

                        // Send video as a document from disk to target JID with custom caption and thumbnail
                        await conn.sendMessage(
                            targetJid,
                            {
                                document: { url: filePath },
                                mimetype: 'video/mp4',
                                fileName: fileName,
                                caption: `*${sanitize(movieInfo.title || selectedItem.title)}* (${selectedQuality.quality})\n\n*𝙲 𝙸 𝙽 𝙴 𝚅 𝙸 𝙱 𝙴 𝚂  𝙻 𝙺*`,
                                jpegThumbnail: thumbnail
                            }
                        );

                        // Update processing message in original chat
                        await conn.sendMessage(from, {
                            text: `✅ File sent successfully to ${targetJid}! (${selectedQuality.quality}, ${formatSize(fileSize)})`,
                            edit: processingMsg.key
                        });

                        // Add reaction
                        await conn.sendMessage(from, { react: { text: '✅', key: processingMsg.key } });

                        // Clean up: Delete the file from disk after sending
                        await fs.unlink(filePath).catch((err) => console.error('Cleanup Error:', err));
                    }

                    // Keep collector active for further selections
                }
            } catch (error) {
                console.error('[MOVIE REPLY ERROR]:', error);
                await conn.sendMessage(from, {
                    text: `❌ Error: ${error.message}`,
                    edit: isReplyToSentMsg ? searchMsg.key : messageCollectors.get(`${from}_${contextInfo?.stanzaId}`)?.infoMsg.key
                });

                // Cleanup in case of error
                const fileName = `${sanitize(movieInfo?.title || selectedItem?.title || "movie")} - ${selectedQuality?.quality}.mp4`.replace(/[^a-z0-9_.-]/gi, '_');
                if (fileName) {
                    await fs.unlink(path.join(tempDir, fileName)).catch(() => {});
                }
            }
        });

        // Clean up collectors after 5 minutes to prevent memory leaks
        setTimeout(() => {
            messageCollectors.delete(collectorKey);
            for (let key of messageCollectors.keys()) {
                if (key.startsWith(`${from}_`)) {
                    messageCollectors.delete(key);
                }
            }
        }, 5 * 60 * 1000);

    } catch (error) {
        console.error('[MOVIE COMMAND ERROR]:', error);
        await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
        await reply(`❌ Error: ${error.message}`);
    }
});
