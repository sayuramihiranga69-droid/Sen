const { cmd } = require("../command");

cmd({
    pattern: "movie",
    desc: "Main menu to trigger other movie plugins",
    category: "downloader",
    react: "🎬",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ කරුණාකර සර්ච් කළ යුතු ෆිල්ම් එකේ නම සඳහන් කරන්න. \n\nEx: .movie Solo Leveling");

        // 1. සයිට් ලිස්ට් එක පෙන්වීම
        let listText = `🎬 *GOJO MOVIE SEARCH ENGINE* 🎬\n\n` +
            `🔍 සෙවුම: *${q}*\n\n` +
            `1. Sinhalasub (.sinhalasub)\n` +
            `2. Cinesubz (.cinesubz)\n` +
            `3. Dinka Sinhalasub (.dinka)\n` +
            `4. SL Anime Club (.anime)\n` +
            `5. Pirate.lk (.pirate)\n` +
            `6. Moviesublk (.moviesub)\n\n` +
            `අදාළ අංකය Reply කරන්න.\n\n${FOOTER}`;

        const listMsg = await conn.sendMessage(from, { text: listText }, { quoted: m });

        // 2. User reply කරනකන් බලා සිටීම (waitForReply function එක කලින් code එකේ තිබ්බ විදිහටම තියෙන්න ඕනෙ)
        const { text: selText } = await waitForReply(conn, from, listMsg.key.id);
        const index = selText.trim();

        // 3. තෝරන අංකය අනුව අදාළ Command එක සකස් කිරීම
        let triggerCommand = "";
        
        switch (index) {
            case '1': triggerCommand = `.sinhalasub ${q}`; break;
            case '2': triggerCommand = `.cinesubz ${q}`; break;
            case '3': triggerCommand = `.dinka ${q}`; break;
            case '4': triggerCommand = `.anime ${q}`; break;
            case '5': triggerCommand = `.pirate ${q}`; break;
            case '6': triggerCommand = `.moviesub ${q}`; break;
            default: return reply("❌ වැරදි අංකයක්. කරුණාකර 1-6 අතර අංකයක් ලබා දෙන්න.");
        }

        // 4. අදාළ command එක bot මගින්ම chat එකට යැවීම (Auto Trigger)
        await conn.sendMessage(from, { text: triggerCommand }, { quoted: m });

    } catch (e) {
        console.error(e);
    }
});
