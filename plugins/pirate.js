const { cmd } = require("../command");
const axios = require("axios");
const { makeThumbnail } = require("../lib/functions"); // assume thumbnail helper exists

cmd({
    pattern: "movie",
    desc: "Search and get movie download links",
    category: "movie",
    use: ".movie <movie name>",
    react: "🎬",
    filename: __filename
}, async (conn, mek, msg, { from, args, reply }) => {
    try {
        if(!args[0]) return reply("Please provide a movie name!");
        const query = args.join(" ");

        // 1️⃣ Search movie
        const searchRes = await axios.get(`https://ty-opal-eta.vercel.app/movie/pirate/search?text=${encodeURIComponent(query)}`);
        const movies = searchRes.data.result.data;
        if(!movies || movies.length === 0) return reply("No results found.");

        // 2️⃣ Build search list
        let listText = "🎬 *Search Results*\n\n";
        movies.forEach((m,i)=>{
            listText += `*${i+1}.* ${m.title} | ${m.year}\nIMDB: ${m.imdb || "N/A"}\n\n`;
        });
        listText += "Reply with the number of the movie.";
        await reply(listText);

        // 3️⃣ Wait for user's number reply
        conn.ev.on("messages.upsert", async ({ messages }) => {
            const m = messages[0];
            if(!m.message || !m.message.conversation) return;
            const num = parseInt(m.message.conversation);
            if(isNaN(num) || num < 1 || num > movies.length) return;
            
            const selected = movies[num-1];

            // 4️⃣ Fetch movie details
            const detailRes = await axios.get(`https://ty-opal-eta.vercel.app/movie/pirate/movie?url=${encodeURIComponent(selected.link)}`);
            const details = detailRes.data.result.data;

            // 5️⃣ Poster thumbnail
            const poster = details.image || "";
            const thumb = await makeThumbnail(poster);

            // 6️⃣ Filter links: Mega / GDrive / Sub
            const links = { Mega: {}, GDrive: {}, Sub: {} };
            details.dl_links.forEach(dl => {
                const url = dl.link;
                const lower = dl.quality.toLowerCase();
                const qualityMatch = dl.quality.match(/\d{3,4}p/i);
                const quality = qualityMatch ? qualityMatch[0].toUpperCase() : dl.quality;

                if(lower.includes("mega")) links.Mega[quality] = url;
                else if(lower.includes("gdrive")) links.GDrive[quality] = url;
                else if(lower.includes("sub") || lower.includes("srt")) links.Sub[quality] = url;
            });

            // 7️⃣ Build download message
            let dlText = `🎬 *${details.title}* Sinhala Subtitles\n\n`;
            dlText += `⭐ TMDB: ${details.tmdb || "N/A"}\n📅 Release: ${details.date || "N/A"}\n⏱ Duration: ${details.runtime || "N/A"}\n🎭 Genre: ${details.category.join(", ")}\n🎬 Director: ${details.director || "N/A"}\n\n`;
            dlText += `⬇️ *Download Links Organized*\n\n`;

            for(const q of ["480P","720P","1080P"]){
                dlText += `*${q}*\n`;
                dlText += `• Mega: ${links.Mega[q] || "❌ Not available"}\n`;
                dlText += `• GDrive: ${links.GDrive[q] || "❌ Not available"}\n`;
                dlText += `• Sub: ${links.Sub[q] || "❌ Not available"}\n\n`;
            }

            // 8️⃣ Send message with thumbnail
            await conn.sendMessage(from, {
                image: { url: poster },
                caption: dlText
            });
        });

    } catch(e) {
        console.log(e);
        reply("Error fetching movie info.");
    }
});
