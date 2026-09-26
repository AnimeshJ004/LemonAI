import fs from "fs";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

(async () => {
  const bingCookie = process.env.BING_IMAGE_COOKIE;
  // A known Bing DALL-E 3 image URL structure:
  // We need a real URL to test. Let's use bimg to get links first.
  const { generateImagesLinks } = await import("bimg");
  console.log("Getting links...");
  const links = await generateImagesLinks("A golden retriever holding a sign that says 'HELLO'");
  console.log("Links:", links);
  if (links.length > 0) {
    const finalUrl = links[0];
    console.log("Fetching", finalUrl);
    const imgRes = await fetch(finalUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.bing.com/images/create/",
        "Cookie": `_U=${bingCookie}`
      }
    });
    console.log("Fetch status:", imgRes.status);
    const arrayBuffer = await imgRes.arrayBuffer();
    fs.writeFileSync("C:/Users/Animesh/Documents/A-Company/LemonAI/scratch/test.jpg", Buffer.from(arrayBuffer));
    console.log("Wrote test.jpg, size:", arrayBuffer.byteLength);
  }
})();
