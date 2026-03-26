import express from "express";
import cors from "cors";
import Replicate from "replicate";

const app = express();
app.use(cors());
app.use(express.json());

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

function buildGeneratePrompt(userPrompt, style) {
  const STYLE_MODIFIERS = {
    cinematic:
      "cinematic lighting, film grain, anamorphic lens, movie production quality, dramatic shadows",
    professional:
      "studio lighting, clean neutral background, professional photography, sharp focus",
    fashion:
      "high fashion editorial, Vogue magazine style, dramatic lighting, luxury aesthetic, artistic direction",
    lifestyle:
      "lifestyle photography, natural golden hour light, authentic candid moment, warm tones",
    adventure:
      "epic landscape photography, golden hour, adventure lifestyle, vast scenery",
    portrait:
      "portrait photography, shallow depth of field, bokeh background, soft studio light",
    cyberpunk:
      "cyberpunk neon aesthetic, rain-soaked streets, futuristic city, blade runner atmosphere, neon lights",
    fantasy:
      "fantasy epic scene, magical atmosphere, otherworldly light, dramatic clouds",
  };

  const qualityTag =
    "ultra realistic, photorealistic, 8K, highly detailed, sharp focus, professional photography";
  const styleTag = style && STYLE_MODIFIERS[style] ? STYLE_MODIFIERS[style] : "";
  return [userPrompt, styleTag, qualityTag].filter(Boolean).join(", ");
}

async function outputToUrl(output) {
  if (!output) return "";
  if (typeof output === "string") return output;

  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "url" in first) {
      const urlProp = first.url;
      if (typeof urlProp === "function") return await urlProp();
      if (typeof urlProp === "string") return urlProp;
    }
  }

  if (output && typeof output === "object" && "url" in output) {
    const urlProp = output.url;
    if (typeof urlProp === "function") return await urlProp();
    if (typeof urlProp === "string") return urlProp;
  }

  return "";
}

app.get("/", (_req, res) => {
  res.send("simple-api çalışıyor");
});

app.get("/api/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/generate", async (req, res) => {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return res.status(500).json({ error: "REPLICATE_API_TOKEN eksik" });
    }

    const { prompt, aspect_ratio, style, quality } = req.body || {};

    if (!prompt?.trim()) {
      return res.status(400).json({ error: "Prompt boş" });
    }

    const finalPrompt = buildGeneratePrompt(prompt, style);
    const validRatios = ["1:1", "9:16", "16:9", "4:5", "3:4", "3:2", "2:3"];
    const aspectRatio = validRatios.includes(aspect_ratio ?? "")
      ? aspect_ratio
      : "1:1";

    const model =
      quality === "high"
        ? "black-forest-labs/flux-1.1-pro"
        : "black-forest-labs/flux-schnell";

    const output = await replicate.run(model, {
      input: {
        prompt: finalPrompt,
        aspect_ratio: aspectRatio,
        output_format: "jpg",
        output_quality: 90,
        ...(quality === "fast" ? { num_inference_steps: 4 } : {}),
      },
    });

    const imageUrl = await outputToUrl(output);

    if (!imageUrl) {
      return res.status(500).json({ error: "Görsel üretildi ama URL alınamadı" });
    }

    res.json({ imageUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    res.status(500).json({ error: message });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on ${port}`);
});