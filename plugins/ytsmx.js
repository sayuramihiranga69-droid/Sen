const config = require('../config');
const { cmd } = require('../command');
const { getSearch, getDetails, getDownload } = require('sinhalasub.lk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

cmd({
    pattern: "sinhalasub",
    alias: ["submovie", "sinhala"],
    react: "🎬",
    desc: "Search and download movies with Sinhala subtitles as MP4 document with thumbnail preview",
    category: "download",
    use: ".sinhalasub <movie name>",
    filename: __filename
}, async (conn, m, mek, { from, q, reply }) => {
    try {
        if (!q) return await reply("❌ Please provide a movie name to search!");

        // Search for movies using sinhalasub.lk
        const searchResponse = await getSearch(q);
        if (!searchResponse.status || !searchResponse.result || searchResponse.result.length === 0) {
            return await reply("❌ No movies found for your query!");
        }

        // Show all search results
        const results = searchResponse.result;
        let info = `🎬 *𝚂𝙸𝙽𝙷𝙰𝙻𝙰𝚂𝚄𝙱 𝙼𝙾𝚅𝙸𝙴 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳𝙴𝚁* 🎬\n\n` +
            `🔍 *Search Query:* ${q}\n\n` +
            `🔽 *Reply with a number to select a movie:*\n`;

        results.forEach((movie, index) => {
            info += `${index + 1}. *${movie.title}* (${movie.year})\n` +
                    `   ⭐ Rating: ${movie.rating || "N/A"}\n` +
                    `   🔗 ${movie.link}\n`;
        });

        info += `\n${config.FOOTER || "*© 𝙿𝙾𝚆𝙴𝚁𝙳 𝙱𝚈 𝚀𝚄𝙴𝙴𝙽 𝙶𝙸𝙼𝙸*"}`;

        // Try to send message with thumbnail, fallback to text
        let sentMsg;
        try {
            sentMsg = await conn.sendMessage(from, { 
                image: { url: results[0].image || 'https://placehold.co/200x300' }, 
                caption: info 
            }, { quoted: mek });
        } catch (imageError) {
            console.error(`Failed to load thumbnail: ${imageError.message}`);
            sentMsg = await conn.sendMessage(from, { text: info }, { quoted: mek });
        }

        const messageID = sentMsg.key.id;
        await conn.sendMessage(from, { react: { text: '🎥', key: sentMsg.key } });

        // Listen for movie selection reply
        conn.ev.on('messages.upsert', async (messageUpdate) => {
            try {
                const mekInfo = messageUpdate?.messages[0];
                if (!mekInfo?.message) return;

                const messageType = mekInfo?.message?.conversation || mekInfo?.message?.extendedTextMessage?.text;
                const isReplyToSentMsg = mekInfo?.message?.extendedTextMessage?.contextInfo?.stanzaId === messageID;

                if (!isReplyToSentMsg) return;

                let selectedIndex = parseInt(messageType) - 1;
                if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= results.length) {
                    return await reply("❌ Invalid choice! Reply with a number between 1 and " + results.length + ".");
                }

                const selectedMovie = results[selectedIndex];
                const movieDetails = await getDetails(selectedMovie.link);
                if (!movieDetails.status || !movieDetails.result) {
                    return await reply("❌ Failed to fetch movie details!");
                }

                const { title, image: thumbnail, year, rating, category, director, dl_links } = movieDetails.result;
                const qualityOptions = dl_links.filter(link => link.quality !== 'Subtitles');
                if (qualityOptions.length === 0) {
                    return await reply("❌ No download links available for this movie!");
                }

                let qualityMenu = `🎬 *Selected Movie:* ${title}\n` +
                    `📅 *Year:* ${year}\n` +
                    `⭐ *Rating:* ${rating}\n` +
                    `🎭 *Category:* ${category.join(', ')}\n` +
                    `🎥 *Director:* ${director || 'N/A'}\n\n` +
                    `🔽 *Reply with a number to select quality (downloads as MP4 document):*\n`;

                const qualityMap = {};
                qualityOptions.forEach((link, index) => {
                    qualityMenu += `${index + 1}. *${link.quality} (${link.size})*\n`;
                    qualityMap[`${index + 1}`] = { quality: link.quality, link: link.link, size: link.size };
                });

                qualityMenu += `\n${config.FOOTER || "*© ᴘᴏᴡᴇᴀʀᴅ ʙʏ ᴍᴀɴᴊᴜ-ᴍᴅ*"}`;

                // Try to send quality menu with thumbnail, fallback to text
                let qualityMsg;
                try {
                    qualityMsg = await conn.sendMessage(from, { 
                        image: { url: thumbnail }, 
                        caption: qualityMenu 
                    }, { quoted: mek });
                } catch (imageError) {
                    console.error(`Failed to load quality menu thumbnail: ${imageError.message}`);
                    qualityMsg = await conn.sendMessage(from, { text: qualityMenu }, { quoted: mek });
                }

                const qualityMessageID = qualityMsg.key.id;

                // Listen for quality selection reply
                conn.ev.on('messages.upsert', async (subMessageUpdate) => {
                    try {
                        const subMekInfo = subMessageUpdate?.messages[0];
                        if (!subMekInfo?.message) return;

                        const subMessageType = subMekInfo?.message?.conversation || subMekInfo?.message?.extendedTextMessage?.text;
                        const isReplyToQualityMsg = subMekInfo?.message?.extendedTextMessage?.contextInfo?.stanzaId === qualityMessageID;

                        if (!isReplyToQualityMsg) return;

                        let userReply = subMessageType.trim();
                        if (!qualityMap[userReply]) {
                            return await reply("❌ Invalid choice! Reply with a number (e.g., 1, 2, 3).");
                        }

                        const { quality, link: downloadPageLink, size } = qualityMap[userReply];
                        const msg = await conn.sendMessage(from, { text: `⏳ Downloading *${title}* (${quality})...` }, { quoted: mek });

                        // Get direct download link
                        let directDownloadUrl;
                        try {
                            const downloadResponse = await getDownload(downloadPageLink);
                            console.log('Download Response:', downloadResponse); // Log response for debugging
                            if (!downloadResponse.status || !downloadResponse.result) {
                                throw new Error('Invalid download response');
                            }
                            directDownloadUrl = downloadResponse.result;
                        } catch (downloadError) {
                            console.error(`Failed to fetch download link: ${downloadError.message}`);
                            let fallbackMessage = `❌ Failed to fetch direct download link for *${title}* (${quality}).\n` +
                                                `Try these alternative links:\n`;
                            qualityOptions.forEach((link, index) => {
                                fallbackMessage += `${index + 1}. ${link.quality} (${link.size}): ${link.link}\n`;
                            });
                            return await reply(fallbackMessage);
                        }

                        // Stream download movie to disk
                        const tempMoviePath = path.join('/tmp', `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${quality}.mp4`);
                        const tempThumbnailPath = path.join('/tmp', `${title.replace(/[^a-zA-Z0-9]/g, '_')}_thumbnail.jpg`);

                        // Download movie
                        const movieWriter = fs.createWriteStream(tempMoviePath);
                        const movieResponse = await axios({
                            url: directDownloadUrl,
                            method: 'GET',
                            responseType: 'stream'
                        });
                        movieResponse.data.pipe(movieWriter);
                        await new Promise((resolve, reject) => {
                            movieWriter.on('finish', resolve);
                            movieWriter.on('error', reject);
                        });

                        // Download thumbnail and convert to Base64
                        let thumbnailBase64;
                        try {
                            const thumbnailResponse = await axios({
                                url: thumbnail,
                                method: 'GET',
                                responseType: 'stream'
                            });
                            const thumbnailWriter = fs.createWriteStream(tempThumbnailPath);
                            thumbnailResponse.data.pipe(thumbnailWriter);
                            await new Promise((resolve, reject) => {
                                thumbnailWriter.on('finish', resolve);
                                thumbnailWriter.on('error', reject);
                            });

                            // Convert thumbnail to Base64
                            thumbnailBase64 = fs.readFileSync(tempThumbnailPath).toString('base64');
                        } catch (error) {
                            console.error(`Failed to download or process thumbnail: ${error.message}`);
                            thumbnailBase64 = undefined;
                        }

                        // Send as document with thumbnail preview
                        await conn.sendMessage(from, {
                            document: { url: `file://${tempMoviePath}` },
                            fileName: `${title} (${quality}, ${year}).mp4`,
                            mimetype: 'video/mp4',
                            caption: `*${title}* (${quality}, ${size}, ${year})\n*© ᴘᴏᴡᴇᴀʀᴅ ʙʏ ᴍᴀɴᴊᴜ-ᴍᴅ*`,
                            jpegThumbnail: thumbnailBase64 ? Buffer.from(thumbnailBase64, 'base64') : undefined
                        }, { quoted: mek });

                        await conn.sendMessage(from, { text: '✅ Media Upload Successful ✅', edit: msg.key });

                        // Clean up temporary files
                        [tempMoviePath, tempThumbnailPath].forEach(file => {
                            fs.unlink(file, (err) => {
                                if (err) console.error(`Failed to delete temp file ${file}: ${err}`);
                            });
                        });

                    } catch (error) {
                        console.error(error);
                        await reply(`❌ *An error occurred while processing:* ${error.message || "Error!"}`);
                    }
                });

            } catch (error) {
                console.error(error);
                await reply(`❌ *An error occurred while processing:* ${error.message || "Error!"}`);
            }
        });

    } catch (error) {
        console.error(error);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        await reply(`❌ *An error occurred:* ${error.message || "Error!"}`);
    }
});
