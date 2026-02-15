const express = require('express');
const Replicate = require('replicate');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');

const app = express();
app.use(express.json({ limit: '100mb' }));

// おばあちゃんが設定した「r8_R0a...」の鍵を、完璧に掃除して使います
const repToken = (process.env.REPLICATE_API_TOKEN || "").trim();
const gemKey = (process.env.GEMINI_API_KEY || "").trim();

const replicate = new Replicate({ auth: repToken });
const genAI = new GoogleGenerativeAI(gemKey);

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

app.post('/api/process', async (req, res) => {
  try {
    const { image_url, bg_type } = req.body;
    let editedImage;

    // 【2026年最新】住所エラー（422）が出ない、公式推奨の呼び出し方に直しました
    const model = bg_type === 'white' ? "lucataco/remove-bg" : "logerzz/background-remover";
    
    editedImage = await replicate.run(model, { input: { image: image_url, background_prompt: bg_type } });

    const genModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await genModel.generateContent([
      "ブランド鑑定士として分析し、詳細を日本語で出力してください。",
      { inlineData: { mimeType: "image/jpeg", data: image_url.split(',')[1] } }
    ]);

    res.json({ ok: true, edited_image: editedImage, description: result.response.text() });
  } catch (error) {
    res.status(500).json({ ok: false, error: "AI実行エラー: " + error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`WhiteMuse 最終起動`));