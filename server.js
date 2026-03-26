import express from "express";
import cors from "cors";
import Replicate from "replicate";

const app = express();

app.use(cors());
app.use(express.json());

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

function normalizeTurkishText(text) {
  return text
    .toLowerCase()
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .trim();
}

function detectKeywords(text) {
  const t = normalizeTurkishText(text);

  const hasAny = (arr) => arr.some((word) => t.includes(word));

  return {
    subject: hasAny(["beni", "ben", "kendim", "selfie"])
      ? "portrait of the same person"
      : hasAny(["erkek", "adam", "yakisikli", "yakışıklı"])
      ? "portrait of a handsome man"
      : hasAny(["kadin", "kadın", "kiz", "kız", "guzel kadin", "güzel kadın"])
      ? "portrait of a beautiful woman"
      : "portrait of a person",

    outfit: hasAny(["siyah takim elbise", "siyah takım elbise"])
      ? "wearing a black tailored suit"
      : hasAny(["takim elbise", "takım elbise"])
      ? "wearing an elegant tailored suit"
      : hasAny(["elbise"])
      ? "wearing an elegant dress"
      : hasAny(["ceket"])
      ? "wearing a stylish jacket"
      : hasAny(["spor", "fitness", "atlet"])
      ? "wearing premium athletic sportswear"
      : "",

    environment: hasAny(["colde", "çölde", "cölde", "çöl", "col", "kum"])
      ? "in a vast desert with golden dunes"
      : hasAny(["sehir", "şehir", "sokak", "gece sehir", "gece şehir"])
      ? "in a modern city at night"
      : hasAny(["ofis", "ofiste"])
      ? "in a luxury modern office"
      : hasAny(["orman", "doga", "doğa"])
      ? "in a cinematic natural environment"
      : hasAny(["studyo", "stüdyo"])
      ? "in a premium photography studio"
      : hasAny(["sahil", "deniz kenari", "deniz kenarı"])
      ? "near the sea in a luxury coastal atmosphere"
      : "",

    action: hasAny(["at ustunde", "at üstünde", "at üzerinde"])
      ? "riding a powerful horse"
      : hasAny(["motor", "motosiklet"])
      ? "next to a premium sport motorcycle"
      : hasAny(["araba", "arabam"])
      ? "next to a luxury sports car"
      : hasAny(["oturuyor", "oturmus", "oturmuş"])
      ? "sitting in a confident pose"
      : hasAny(["ayakta", "standing", "duruyor"])
      ? "standing confidently"
      : "",

    mood: hasAny(["karizmatik", "guclu", "güçlü", "lider"])
      ? "confident, charismatic, powerful presence"
      : hasAny(["romantik", "ask", "aşk"])
      ? "romantic and emotional atmosphere"
      : hasAny(["gizemli"])
      ? "mysterious, dark, cinematic mood"
      : hasAny(["sert"])
      ? "strong, bold and intense energy"
      : hasAny(["mutlu"])
      ? "warm, confident and joyful energy"
      : "",

    lighting: hasAny(["gun batimi", "gün batımı", "golden hour"])
      ? "golden hour cinematic lighting"
      : hasAny(["neon"])
      ? "neon cinematic lighting with purple and blue glow"
      : hasAny(["yumusak isik", "yumuşak ışık"])
      ? "soft beauty lighting"
      : hasAny(["dramatik isik", "dramatik ışık"])
      ? "dramatic editorial lighting"
      : hasAny(["gece"])
      ? "night cinematic lighting"
      : "premium cinematic lighting",

    camera: hasAny(["yakindan", "yakından", "close up"])
      ? "close-up portrait shot"
      : hasAny(["tam boy"])
      ? "full body shot"
      : hasAny(["genis aci", "geniş açı"])
      ? "wide cinematic shot"
      : "professional portrait shot",
  };
}

function stylePrompt(style) {
  const styles = {
    cinematic:
      "cinematic composition, film still quality, dramatic atmosphere, rich contrast, luxury visual storytelling",
    professional:
      "clean professional portrait, corporate luxury aesthetic, polished framing, premium studio quality",
    fashion:
      "high fashion editorial, luxury magazine photography, Vogue-style composition, stylish pose",
    lifestyle:
      "premium lifestyle campaign photography, natural but polished mood, social-ready luxury look",
    adventure:
      "epic adventure campaign aesthetic, dramatic environment, bold storytelling composition",
    portrait:
      "high-end portrait photography, elegant face lighting, premium skin detail, shallow depth of field",
    cyberpunk:
      "cyberpunk luxury aesthetic, futuristic neon city, reflective surfaces, purple and blue glow",
    fantasy:
      "fantasy cinematic world, magical atmosphere, epic visual storytelling, dreamlike premium quality",
  };

  return styles[style] || styles.portrait;
}

function buildSmartPrompt(userPrompt, style) {
  const normalized = normalizeTurkishText(userPrompt);
  const k = detectKeywords(userPrompt);

  const translatedCore = [
    k.subject,
    k.outfit,
    k.environment,
    k.action,
    k.mood,
    k.lighting,
    k.camera,
  ]
    .filter(Boolean)
    .join(", ");

  const quality =
    "ultra realistic, photorealistic, highly detailed, realistic face, realistic eyes, realistic skin texture, sharp focus, premium photography, 8k";

  const composition =
    "well composed, centered subject, clean anatomy, realistic hands, realistic proportions, elegant framing";

  const styleLayer = stylePrompt(style);

  const fallback =
    normalized.length > 0
      ? `inspired by this user request: ${normalized}`
      : "luxury portrait scene";

  return [translatedCore || fallback, styleLayer, quality, composition]
    .filter(Boolean)
    .join(", ");
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

    const finalPrompt = buildSmartPrompt(prompt, style);

    console.log("USER PROMPT:", prompt);
    console.log("FINAL PROMPT:", finalPrompt);

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