/**
 * Generate agent profile images using Gemini Imagen API
 * and save them to public/avatars/
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVATARS_DIR = path.join(__dirname, "..", "public", "avatars");
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("GEMINI_API_KEY not set");
  process.exit(1);
}

const agents = [
  {
    filename: "filmmaker.png",
    prompt:
      "A sleek futuristic AI robot avatar portrait for a filmmaker agent. The robot has a cinematic camera lens for one eye, film reels integrated into its head design, and a warm golden/amber color scheme. Digital art style, dark background with subtle film strip patterns, professional profile picture composition, high quality, 512x512.",
  },
  {
    filename: "coder.png",
    prompt:
      "A sleek futuristic AI robot avatar portrait for a software developer agent. The robot has glowing green matrix-style code reflected in its visor, circuit board patterns on its face, and a cool blue/green neon color scheme. Digital art style, dark background with floating code snippets, professional profile picture composition, high quality, 512x512.",
  },
  {
    filename: "trader.png",
    prompt:
      "A sleek futuristic AI robot avatar portrait for a cryptocurrency trading agent. The robot has holographic stock charts displayed in its eyes, golden metallic finish, and candlestick chart patterns etched into its armor. Digital art style, dark background with green and red trading indicators, professional profile picture composition, high quality, 512x512.",
  },
  {
    filename: "auditor.png",
    prompt:
      "A sleek futuristic AI robot avatar portrait for a security auditor agent. The robot has a shield emblem on its forehead, scanning laser eyes in red, and heavy armor plating in silver and dark blue. Digital art style, dark background with shield and lock icons, professional profile picture composition, high quality, 512x512.",
  },
  {
    filename: "clipper.png",
    prompt:
      "A sleek futuristic AI robot avatar portrait for a video editing and clipping agent. The robot has scissor-like appendages, a play button symbol glowing on its chest, and a vibrant purple/magenta color scheme. Digital art style, dark background with video timeline elements, professional profile picture composition, high quality, 512x512.",
  },
];

async function generateImage(agent) {
  console.log(`Generating image for ${agent.filename}...`);

  // Use Gemini's Imagen 4.0 model for image generation
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${API_KEY}`;

  const body = {
    instances: [{ prompt: agent.prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: "1:1",
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Failed for ${agent.filename}: ${res.status} ${errText}`);
    return false;
  }

  const data = await res.json();

  if (!data.predictions || data.predictions.length === 0) {
    console.error(`No predictions returned for ${agent.filename}`);
    return false;
  }

  const imageBytes = data.predictions[0].bytesBase64Encoded;
  const outPath = path.join(AVATARS_DIR, agent.filename);
  fs.writeFileSync(outPath, Buffer.from(imageBytes, "base64"));
  console.log(`Saved ${outPath}`);
  return true;
}

async function main() {
  // Ensure directory exists
  fs.mkdirSync(AVATARS_DIR, { recursive: true });

  let success = 0;
  for (const agent of agents) {
    const ok = await generateImage(agent);
    if (ok) success++;
  }

  console.log(`\nDone: ${success}/${agents.length} images generated.`);
  console.log("\nPublic URLs:");
  for (const agent of agents) {
    console.log(`  https://agentnetwork.world/avatars/${agent.filename}`);
  }
}

main().catch(console.error);
