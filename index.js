import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// Render 用（PORT必須）
const PORT = process.env.PORT || 3000;

// 疎通確認用（ブラウザで開くと OK が出る）
app.get("/", (req, res) => {
  res.send("WhiteMuse API is running");
});

// 画像生成（Replicate）
app.post("/generate-image", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!process.env.REPLICATE_API_TOKEN) {
      return res.status(500).json({ error: "REPLICATE_API_TOKEN not set" });
    }

    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        version: "ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
        input: {
          prompt,
          width: 1024,
          height: 1024,
          guidance_scale: 7.5
        }
      })
    });

    const data = await response.json();
    res.json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`WhiteMuse API listening on port ${PORT}`);
});
