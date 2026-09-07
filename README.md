# 一起撐下去 · 家人習慣打卡

單檔 PWA，後端是綁在 Google Sheet 上的 Apps Script。沒有伺服器、沒有登入、沒有資料庫。

- Sheet：https://docs.google.com/spreadsheets/d/1g6_K47X3cDP8yh-Ef30XrP85fo16n5mZnAY9u0ciWKQ/edit
- 照片資料夾：https://drive.google.com/drive/folders/1x7Gvp-lOITZZJSL7m6b4DBSaQYRBXUF5

## 檔案

| 檔案 | 用途 |
|---|---|
| `Code.gs` | Apps Script 後端，貼進 Sheet 的擴充功能 |
| `index.html` | 整個前端，最上面有一個 `API` 常數要填 |
| `manifest.json`、`icon-*.png` | PWA 設定與 icon |
| `test.js` | 前端週次與目標邏輯的檢查，`node test.js` |

## 資料模型（三個分頁，全部只新增不修改）

| 分頁 | 欄位 | 說明 |
|---|---|---|
| `members` | id、name、tag、initial | 家人名單，手動填。tag 是「弟弟」「姊姊」這種副標，initial 是頭像那一個字 |
| `goals` | ts、member、from_week、habit、target、rule | 目標歷史。某週生效的目標 ＝ `from_week <= 該週` 的最後一筆。調低會寫成下週一，調高寫成本週一 |
| `checkins` | ts、member、week、type、minutes、note、photo_url | type 有 `done`、`rest`、`unrest`。休息週就是一筆 `rest`，取消就是 `unrest`，同週最後一筆為準 |

週次鍵值是「該週週一的日期」，台北時間、週一起算。

## 部署步驟

1. 打開 Sheet →「擴充功能」→「Apps Script」，把 `Code.gs` 全部貼上，存檔。
2. 在編輯器上方選 `setup` 函式，按「執行」。第一次會要求授權 Sheet 與 Drive，同意。跑完 Sheet 會多出三個分頁。
3. 到 `members` 分頁填家人：id 用短英文（例如 `a`、`b`、`c`），name、tag、initial 填中文。
4. 順手執行一次 `selfTest`，執行紀錄顯示 `selfTest OK` 代表週次與目標邏輯正常。
5. 「部署」→「新增部署作業」→ 類型選「網頁應用程式」→ 執行身分「我」→ 存取權「任何人」→ 部署。複製那個以 `/exec` 結尾的網址。
6. 打開 `index.html`，把網址貼進最上面的 `const API = ''`。
7. 把 `index.html`、`manifest.json`、三張 `icon-*.png` 推到一個 GitHub repo，Settings → Pages → 來源選 main 分支根目錄。等一兩分鐘拿到網址。
8. iPhone 用 Safari 打開網址 →「分享」→「加入主畫面」。Android 用 Chrome，選單裡有「安裝應用程式」。

之後改 `Code.gs` 要記得「部署」→「管理部署作業」→ 編輯 → 版本選「新版本」，否則 `/exec` 還是跑舊的。

## 要知道的事

- `/exec` 網址本身就是密碼，知道網址就能寫入。家庭用夠了，不要貼到公開的地方。
- 如果部署對話框裡沒有「任何人」這個選項，或家人看不到照片，代表這個 Google 帳號是 Workspace 網域、管理員關掉了對外分享。Sheet、Script、Drive 資料夾都要改放到個人 Gmail 底下。
- 每次請求大約 1 到 3 秒，附照片會再久一點。前端已把照片縮到最長邊 1280、JPEG 0.8。
- 送出失敗的打卡會存在手機的 localStorage，下次打開 app 自動補送。
- 新增家人：直接在 `members` 分頁加一列，不用改程式。
- 沒做的事：離線快取（service worker）、登入、刪除或編輯紀錄。要改資料直接改 Sheet。
