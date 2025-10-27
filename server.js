// ============================================================
// 🚀 Downloader Tools Server
// - HTML Downloader
// - Scratch SB3 Downloader
// ============================================================

const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const app = express();

// ------------------------------------------------------------
// 📂 基本設定
// ------------------------------------------------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public")); // publicフォルダ内の静的ファイルを配信

// メインページ
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ============================================================
// 🧱 HTML Downloader 機能
// ============================================================
app.post("/download", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.send("URLを入力してください。");
  }

  try {
    const safeFileName = url.replace(/[^a-z0-9]/gi, "_") + ".html";
    const filePath = path.join(__dirname, safeFileName);

    const response = await axios.get(url, { responseType: "arraybuffer" });
    const html = response.data.toString("utf8");

    fs.writeFileSync(filePath, html, "utf8");

    res.download(filePath, safeFileName, (err) => {
      if (err) console.error("ダウンロードエラー:", err);

      // 一時ファイル削除
      setTimeout(() => {
        fs.unlink(filePath, (err) => {
          if (err) console.error("削除エラー:", err);
        });
      }, 1000);
    });
  } catch (err) {
    console.error("[HTML ERROR]", err.message);
    res.send("HTMLの取得に失敗しました。URLを確認してください。");
  }
});

// ============================================================
// 🧩 Scratch SB3 Downloader 機能
// ============================================================
app.get("/scratch-download/:projectId", async (req, res) => {
  const projectId = req.params.projectId;
  const metaUrl = `https://api.scratch.mit.edu/projects/${projectId}`;
  const tempDir = path.join(__dirname, "temp", projectId);
  const jsonPath = path.join(tempDir, "project.json");
  const sb3Path = path.join(tempDir, "project.sb3");

  try {
    await fs.promises.mkdir(tempDir, { recursive: true });

    // 🔹 Step 1: メタデータ取得
    const metaRes = await axios.get(metaUrl);
    const meta = metaRes.data;
    const token = meta.project_token;

    if (!token) {
      return res
        .status(400)
        .send("このプロジェクトは公開されていないか、取得できません。");
    }

    // 🔹 Step 2: JSONデータ取得
    const projectUrl = `https://projects.scratch.mit.edu/${projectId}?token=${token}`;
    const projectRes = await axios.get(projectUrl);
    const projectJson = projectRes.data;

    // 🔹 Step 3: JSONを保存
    await fs.promises.writeFile(jsonPath, JSON.stringify(projectJson, null, 2));

    // 🔹 Step 4: ZIPを作成してsb3に変換
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
    res
      .status(500)
      .send("Scratchプロジェクトの取得に失敗しました。プロジェクトIDを確認してください。");
  }
});

// ============================================================
// 🚀 サーバー起動
// ============================================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ サーバー起動中: http://localhost:${PORT}`);
  console.log(" - HTML Downloader: / (POST /download)");
  console.log(" - Scratch SB3 Downloader: /scratch-download/:projectId");
});
