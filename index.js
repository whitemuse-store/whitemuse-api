import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// 動作確認用
app.get("/", (req, res) => {
  res.send("WhiteMuse API is running");
});

// ★ 文章生成エンドポイント
app.post("/generate", async (req, res) => {
  try {
    const { brand, model, color, material, condition } = req.body;

    // 仮の文章（まずは動くことを最優先）
    const text = `
【${brand} ${model}】

カラー：${color}
素材：${material}
状態：${condition}

上品で洗練された印象の一品です。
日常使いから特別なシーンまで幅広くご使用いただけます。
    `.trim();

    res.json({ text });
  } catch (err) {
    res.status(500).json({ error: "generate failed" });
  }
});

app.listen(PORT, () => {
  console.log(`WhiteMuse API listening on ${PORT}`);
});
