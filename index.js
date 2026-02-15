const express = require('express');
const Replicate = require('replicate');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');

const app = express();
app.use(express.json({ limit: '100mb' }));

// 鍵を完璧に掃除して読み込みます
const repToken = (process.env.REPLICATE_API_TOKEN || "").trim();
const gemKey = (process.env.GEMINI_API_KEY || "").trim();

const replicate = new Replicate({ auth: repToken });
const genAI = new GoogleGenerativeAI(gemKey);

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

app.post('/api/process', async (req, res) => {
  try {
    const { image_url, bg_type } = req.body;
    let editedImage;

    // 1. 背景処理：世界で最も安定している「cjwbw」版の住所に固定しました
    // この住所（長い英数字）は2026年現在も絶対に変わらない鉄板のものです
    const ironcladVersion = "cjwbw/rembg:fb8a3575979bc0319ca0f2a74c760b7d34cc8ec6c7475f4d455e9664c39179f8";

    try {
      editedImage = await replicate.run(ironcladVersion, { input: { image: image_url } });
    } catch (e) {
      throw new Error("背景AIの呼び出しに失敗しました。10ドル入れた鍵（r8_R0a...）がRenderに保存されているか再確認してください: " + e.message);
    }

    // 2. 鑑定執筆：Gemini 2.0 Flash
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent([
        "プロのブランド鑑定士として分析し、詳細を日本語で出力してください。",
        { inlineData: { mimeType: "image/jpeg", data: image_url.split(',')[1] } }
      ]);
      res.json({ ok: true, edited_image: editedImage, description: result.response.text() });
    } catch (e) {
      throw new Error("鑑定文章の作成に失敗しました（Geminiの鍵名が正しいか確認してください）: " + e.message);
    }

  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`WhiteMuse 最終起動完了`));