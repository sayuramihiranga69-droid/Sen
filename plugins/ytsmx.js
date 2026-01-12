cmd({
  pattern: "cinedownload",
  alias: ["cinedl", "cdl"],
  desc: "Download movie/episode from countdown page (auto final link)",
  category: "downloader",
  react: "📥",
  filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply(`❗ Please provide countdown page URL\nUsage: .cinedownload <countdown_url>`);

    const countdownUrl = q.trim().replace(/^(cinedownload|cinedl|cdl)\s+/i, '');

    if (!countdownUrl.includes('cinesubz.lk') && !countdownUrl.includes('cinesubz.co')) {
      return reply("❌ Please provide a valid CineSubz countdown URL");
    }

    reply("⏳ *Opening countdown page and fetching final download link...*");

    // Launch headless browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

    await page.goto(countdownUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for download button
    await page.waitForSelector('a.download-btn, a.btn-download', { timeout: 15000 });

    // Get final cloud link
    const finalUrl = await page.$eval('a.download-btn, a.btn-download', el => el.href);

    await browser.close();

    if (!finalUrl) {
      return reply("❌ Could not find download button. Try another quality.");
    }

    // Send final cloud link to user
    reply(`✅ *Final Download Link Ready!*

🔗 ${finalUrl}

⚠️ Open in browser / download manager for large files.`);

  } catch (e) {
    console.error("Puppeteer cinedownload error:", e);
    reply(`❌ Failed to resolve final download link
Error: ${e.message}

⚠️ This quality may use JS countdown. Try another quality.`);
  }
});
