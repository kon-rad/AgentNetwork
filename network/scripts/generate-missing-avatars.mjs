/**
 * Generate profile images for agents missing avatars,
 * save to public/avatars/, and update Supabase records.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVATARS_DIR = path.join(__dirname, "..", "public", "avatars");
const API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env vars: GEMINI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Unique agents that need images — each gets a distinct avatar
const agentsToGenerate = [
  {
    filename: "test-agent-alpha.png",
    ids: [
      "637f7a57-986e-498d-9ca4-513e03adb720",
      "test-agent-alpha-d17c2f18",
    ],
    prompt:
      "A futuristic AI robot avatar portrait for a security testing agent called Alpha. Sleek white and electric blue armor, Greek letter Alpha symbol glowing on forehead, digital scanning eyes with HUD overlay, minimalist cyber aesthetic. Dark background with faint binary code, professional profile picture, square composition, high quality.",
  },
  {
    filename: "test-agent-beta.png",
    ids: [
      "7a190103-8fc6-48e3-b111-53ddfa695b20",
      "test-agent-beta-48dbf962",
    ],
    prompt:
      "A futuristic AI robot avatar portrait for a DeFi trading test agent called Beta. Dark metallic body with orange and amber accents, Greek letter Beta glowing on chest plate, analytical compound eyes, sleek angular design. Dark background with subtle trading chart lines, professional profile picture, square composition, high quality.",
  },
  {
    filename: "coderkon.png",
    ids: [
      "49556e88-2a8f-4ced-93bb-acf4e76acadc",
      "2a01a1bd-340c-4750-8ef4-2a5e0934f395",
      "8ac5bf73-f595-4967-ab2b-cda21443e413",
    ],
    prompt:
      "A futuristic AI robot avatar portrait for a coder agent. Compact robot with a hoodie-like hood over its head, glowing cyan terminal screen as a face visor showing code, mechanical keyboard-key fingers, matte black and teal color scheme. Dark background with floating code brackets and semicolons, professional profile picture, square composition, high quality.",
  },
  {
    filename: "traderkon.png",
    ids: ["d8604f06-452c-4be7-abe1-4e611d9f4ed8"],
    prompt:
      "A futuristic AI robot avatar portrait for a crypto trader agent. Sharp angular robot with a Wall Street vibe, wearing a digital tie, holographic price tickers scrolling across its visor, chrome and dark green color scheme with red and green LED indicators on shoulders. Dark background with candlestick chart shadows, professional profile picture, square composition, high quality.",
  },
  {
    filename: "content-agent.png",
    ids: ["0ab76e43-faab-4c8a-9421-f5faaee39767"],
    prompt:
      "A futuristic AI robot avatar portrait for a viral content creator agent. Expressive robot with a ring light halo behind its head, one eye is a camera lens, colorful RGB lighting accents in pink, cyan, and yellow, dynamic energetic pose. Dark background with social media icons and notification bells faintly visible, professional profile picture, square composition, high quality.",
  },
];

async function generateImage(agent) {
  console.log(`Generating ${agent.filename}...`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${API_KEY}`;

  const body = {
    instances: [{ prompt: agent.prompt }],
    parameters: { sampleCount: 1, aspectRatio: "1:1" },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`  Failed: ${res.status} ${errText}`);
    return false;
  }

  const data = await res.json();
  if (!data.predictions || data.predictions.length === 0) {
    console.error(`  No predictions returned`);
    return false;
  }

  const imageBytes = data.predictions[0].bytesBase64Encoded;
  const outPath = path.join(AVATARS_DIR, agent.filename);
  fs.writeFileSync(outPath, Buffer.from(imageBytes, "base64"));
  console.log(`  Saved ${outPath}`);
  return true;
}

async function updateAgentAvatar(agentId, avatarUrl) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/agents?id=eq.${agentId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ avatar_url: avatarUrl }),
    }
  );
  if (!res.ok) {
    console.error(`  Failed to update ${agentId}: ${res.status}`);
    return false;
  }
  return true;
}

async function main() {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });

  for (const agent of agentsToGenerate) {
    const ok = await generateImage(agent);
    if (!ok) continue;

    const avatarPath = `/avatars/${agent.filename}`;
    for (const id of agent.ids) {
      const updated = await updateAgentAvatar(id, avatarPath);
      console.log(`  Updated agent ${id} -> ${avatarPath}: ${updated ? "OK" : "FAILED"}`);
    }
  }

  console.log("\nDone! Public URLs:");
  for (const agent of agentsToGenerate) {
    console.log(`  https://agentnetwork.world/avatars/${agent.filename}`);
  }
}

main().catch(console.error);
