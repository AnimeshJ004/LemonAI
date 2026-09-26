import { generateImageFiles } from "bimg";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

(async () => {
  try {
    const files = await generateImageFiles("A red apple on a desk, photorealistic");
    console.log("Success! Got files:", files.length);
    console.log("First file size:", files[0].data.length);
  } catch(e) {
    console.error("Error:", e.message);
  }
})();
