// ✅ ToolsGo Server.js (x.gd公式API対応)
const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const QRCode = require("qrcode");
require("dotenv").config();

const app = express();
app.use(express.static("public"));

// 🔑 x.gd APIキーを.envから読み取る
const XGD_API_KEY = process.env.XGD_API_KEY;

// ============================================================
// 🌐 HTML Downloader with official x.gd API
// ============================================================
app.get("/download", async (req, res) => {
  let { url } = req.query;
  if (!url) return res.send("URLを入力してください。");

  try {
    // 1️⃣ URLが http:// or https:// で始まらない場合は補完
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    // 2️⃣ x.gd APIを呼び出す
    const apiUrl = `https://xgd.io/V1/shorten?url=${encodeURIComponent(
      url
    )}&key=${XGD_API_KEY}`;

    const shortRes = await axios.get(apiUrl);
    const data = shortRes.data;

    if (data.status !== 200 || !data.shorturl)
      throw new Error(data.message || "x.gd APIエラー");

    const shortUrl = data.shorturl;
    console.log(`🔗 x.gd shortened: ${url} → ${shortUrl}`);

    // 3️⃣ 短縮URL先のHTMLを取得
    const htmlRes = await axios.get(shortUrl, { responseType: "arraybuffer" });
    const htmlContent = htmlRes.data.toString("utf8");

    // 4️⃣ 一時ファイルを生成して保存
    const safeFileName =
      url.replace(/[^a-z0-9]/gi, "_").slice(0, 50) + ".html";
    const filePath = path.join(__dirname, safeFileName);
    fs.writeFileSync(filePath, htmlContent, "utf8");

    // 5️⃣ クライアントへ送信
    res.download(filePath, safeFileName, () => {
      setTimeout(() => fs.unlink(filePath, () => {}), 1500);
    });
  } catch (err) {
    console.error("[HTML ERROR]", err.response?.data || err.message);
    res
      .status(500)
      .send(
        "HTMLの取得に失敗しました。URLまたはx.gd APIキーを確認してください。"
      );
  }
});

// ============================================================
// 🐱 Scratch SB3 Downloader
// ============================================================
app.get("/scratch-download/:projectId", async (req, res) => {
  const projectId = req.params.projectId;
  const metaUrl = `https://api.scratch.mit.edu/projects/${projectId}`;
  const tempDir = path.join(__dirname, "temp", projectId);
  const jsonPath = path.join(tempDir, "project.json");
  const sb3Path = path.join(tempDir, "project.sb3");

  try {
    await fs.promises.mkdir(tempDir, { recursive: true });
    const metaRes = await axios.get(metaUrl);
    const meta = metaRes.data;
    const token = meta.project_token;
    if (!token)
      return res.status(400).send("このプロジェクトは公開されていません。");

    const projectUrl = `https://projects.scratch.mit.edu/${projectId}?token=${token}`;
    const projectRes = await axios.get(projectUrl);
    await fs.promises.writeFile(
      jsonPath,
      JSON.stringify(projectRes.data, null, 2)
    );

    const output = fs.createWriteStream(sb3Path);
    const archive = archiver("zip");
    archive.pipe(output);
    archive.file(jsonPath, { name: "project.json" });
    await archive.finalize();

    output.on("close", async () => {
      res.download(sb3Path, `scratch-project-${projectId}.sb3`, async (err) => {
        if (err) console.error(err);
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      });
    });
  } catch (err) {
    console.error("[Scratch Error]", err.message);
    res.status(500).send("Scratchプロジェクトの取得に失敗しました。");
  }
});

// ============================================================
// 🆕 QRコードメーカー
// ============================================================
app.get("/qrcode", async (req, res) => {
  const { text } = req.query;
  if (!text)
    return res.status(400).send("テキストまたはURLを入力してください。");

  try {
    const filePath = path.join(__dirname, "temp", `qr_${Date.now()}.png`);
    await fs.promises.mkdir(path.join(__dirname, "temp"), { recursive: true });

    await QRCode.toFile(filePath, text, {
      width: 500,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });

    res.download(filePath, "qrcode.png", () => {
      setTimeout(() => fs.unlink(filePath, () => {}), 2000);
    });
  } catch (err) {
    console.error("[QR ERROR]", err.message);
    res.status(500).send("QRコードの生成に失敗しました。");
  }
});

// ============================================================
// 🚀 起動
// ============================================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ ToolsGo server running at: http://localhost:${PORT}`);
});
