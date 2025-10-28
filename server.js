// ============================================================
// 🚀 ToolsGo Server - Full Enhanced Version (URL auto-format + unified UI)
// ============================================================

const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const QRCode = require("qrcode");

const app = express();
app.use(express.static("public"));

// ============================================================
// 🌐 HTML Downloader (GET)
// ============================================================
app.get("/download", async (req, res) => {
  let { url } = req.query;
  if (!url) return res.send("URLを入力してください。");

  // ✅ 自動で https:// を補完
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  try {
    const safeFileName = url.replace(/[^a-z0-9]/gi, "_") + ".html";
    const filePath = path.join(__dirname, safeFileName);
    const response = await axios.get(url, { responseType: "arraybuffer" });
    fs.writeFileSync(filePath, response.data.toString("utf8"), "utf8");

    res.download(filePath, safeFileName, () => {
      setTimeout(() => fs.unlink(filePath, () => {}), 1000);
    });
  } catch (err) {
    console.error("[HTML ERROR]", err.message);
    res.send("HTMLの取得に失敗しました。URLを確認してください。");
  }
});

// ============================================================
// 🐱 Scratch SB3 Downloader (GET)
// ============================================================
app.get("/scratch-download/:projectId", async (req, res) => {
  let input = req.params.projectId;

  // ✅ URLだった場合はID部分を抽出
  const match = input.match(/projects\/(\d+)/);
  const projectId = match ? match[1] : input.replace(/\D/g, "");

  if (!projectId) return res.send("プロジェクトIDまたはURLを入力してください。");

  const metaUrl = `https://api.scratch.mit.edu/projects/${projectId}`;
  const tempDir = path.join(__dirname, "temp", projectId);
  const jsonPath = path.join(tempDir, "project.json");
  const sb3Path = path.join(tempDir, "project.sb3");

  try {
    await fs.promises.mkdir(tempDir, { recursive: true });
    const metaRes = await axios.get(metaUrl);
    const meta = metaRes.data;
    const token = meta.project_token;
    if (!token) return res.status(400).send("このプロジェクトは公開されていません。");

    const projectUrl = `https://projects.scratch.mit.edu/${projectId}?token=${token}`;
    const projectRes = await axios.get(projectUrl);
    await fs.promises.writeFile(jsonPath, JSON.stringify(projectRes.data, null, 2));

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
// 📱 QRコードメーカー (GET)
// ============================================================
app.get("/qrcode", async (req, res) => {
  let { text } = req.query;
  if (!text) return res.status(400).send("テキストまたはURLを入力してください。");

  // ✅ https:// 自動補完（ただしリンクらしい時のみ）
  if (/^[\w.-]+\.[a-z]{2,}/i.test(text) && !/^https?:\/\//i.test(text)) {
    text = "https://" + text;
  }

  try {
    const tempDir = path.join(__dirname, "temp");
    await fs.promises.mkdir(tempDir, { recursive: true });
    const filePath = path.join(tempDir, `qr_${Date.now()}.png`);

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
// 🚀 サーバー起動
// ============================================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ ToolsGo running at: http://localhost:${PORT}`);
});
