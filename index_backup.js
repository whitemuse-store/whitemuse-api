// index.js  (WhiteMuse API / Render)
// 必要: RenderのEnvironmentに REPLICATE_API_TOKEN を設定しておく

import express from "express";
import cors from "cors";

const app = express();

// Render(Free)で落ちないようにタイムアウト気味のリクエストにも耐える想定
app.use(cors());
app.use(express.json({ limit: "25mb" }));

const PORT = process.env.PORT || 10000;
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// ---- util ----
function mustHaveToken() {
  if (!REPLICATE_API_TOKEN || String(REPLICATE_API_TOKEN).trim() === "") {
    const err = new Error("Missing REPLICATE_API_TOKEN in environment variables");
    err.status = 500;
    throw err;
  }
}

async function replicateRequest(path, body) {
  mustHaveToken();

  const res = await fetch(`https://api.replicate.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.detail || json?.error || JSON.stringify(json);
    const err = new Error(`Replicate API error: ${res.status} ${msg}`);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json;
}

async function replicateGetPrediction(predictionId) {
  mustHaveToken();

  const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
    headers: {
      Authorization: `Token ${REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.detail || json?.error || JSON.stringify(json);
    const err = new Error(`Replicate GET error: ${res.status} ${msg}`);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json;
}

async function waitForPrediction(predictionId, { timeoutMs = 120000, intervalMs = 1500 } = {}) {
  const start = Date.now();
  while (true) {
    const p = await replicateGetPrediction(predictionId);

    if (p.status === "succeeded") return p;
    if (p.status === "failed" || p.status === "canceled") {
      const err = new Error(`Prediction ${p.status}`);
      err.status = 500;
      err.payload = p;
      throw err;
    }

    if (Date.now() - start > timeoutMs) {
      const err = new Error("Prediction timeout");
      err.status = 504;
      err.payload = p;
      throw err;
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

// ---- routes ----

// ルートにアクセスされたときの表示（あなたの確認用）
app.get("/", (_req, res) => {
  res.status(200).send("WhiteMuse API is running");
});

// Render側の生存確認
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// ✅ WhiteMuse(フロント)が叩く想定のエンドポイント
// POST /generate
// body:
// {
//   "mode": "text" | "image",
//   "prompt": "...",
//   "input": { ... }  // 任意: Replicateに渡したい追加input
// }
app.post("/generate", async (req, res) => {
  try {
    const { mode, prompt, input } = req.body || {};

    if (!mode) return res.status(400).json({ error: "mode is required (text or image)" });
    if (!prompt || String(prompt).trim() === "") return res.status(400).json({ error: "prompt is required" });

    // ---- ここがモデル指定 ----
    // まず動かすこと優先で「汎用・軽め」なモデルを使う構成にしています
    // ※あとであなたのWhiteMuse仕様に合わせてモデルを差し替え可能
    let model;
    let modelInput;

    if (mode === "text") {
      // LLM（文章生成）
      // 例: meta/llama-3-8b-instruct など
      model = "meta/llama-3-8b-instruct";
      modelInput = {
        prompt,
        max_new_tokens: 450,
        temperature: 0.6,
        ...((input && typeof input === "object") ? input : {}),
      };
    } else if (mode === "image") {
      // 画像生成
      // 例: black-forest-labs/flux-schnell など
      model = "black-forest-labs/flux-schnell";
      modelInput = {
        prompt,
        // 追加で渡したい場合は input に入れてOK
        ...((input && typeof input === "object") ? input : {}),
      };
    } else {
      return res.status(400).json({ error: "mode must be 'text' or 'image'" });
    }

    // Replicate Prediction作成
    const created = await replicateRequest("predictions", {
      version: model, // Replicateは「model:version」形式 or deployment指定もあるが、ここでは簡易指定
      // ↑ この指定が通らない場合があるので、下の fallback を使います（安定化）
      input: modelInput,
    }).catch(async (e) => {
      // ✅ 安定化: "version" にモデル文字列が通らない場合があるので
      // その時は "model" フィールド方式で再トライ（ReplicateのAPI仕様差異吸収）
      // （これで動く確率が上がります）
      return await replicateRequest("predictions", {
        model,
        input: modelInput,
      });
    });

    const predictionId = created.id;
    const done = await waitForPrediction(predictionId);

    // 返す形をフロントが扱いやすいように整形
    // done.output はモデルによって配列/文字列/URLなど色々
    res.json({
      ok: true,
      id: predictionId,
      status: done.status,
      output: done.output ?? null,
      raw: done, // 困ったとき用（あとで消してOK）
    });
  } catch (err) {
    const status = err?.status || 500;
    res.status(status).json({
      ok: false,
      error: err?.message || "Unknown error",
      detail: err?.payload || null,
    });
  }
});

app.listen(PORT, () => {
  console.log(`WhiteMuse API listening on ${PORT}`);
});
