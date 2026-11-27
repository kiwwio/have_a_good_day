# 好日子行事曆 v3.1（網頁 App＋手機 App）

目前網址：https://kiwwio.github.io/have_a_good_day/

給長輩用的大字行事曆，可加到手機桌面、沒網路也能打開。

> ⚠️ **不要改這個網址**（不要改 GitHub 帳號名稱或儲存庫名稱、不要改成私人）。長輩手機桌面上的圖示和行程都綁在這個網址上，網址一變，圖示會失效、行程會全部不見。

**v3.1 新增**：「提醒」頁的「備份行程」可以把行程傳到 LINE 給家人保存，換手機時用「還原行程」貼回來；打開時會請手機保留資料，減少被系統清理的機會。

- **網頁版**：本資料夾最外層的檔案，由 GitHub Pages 發布到上面的網址。
- **手機 App（Android／iOS）**：`app/` 資料夾，用 Capacitor 把同一份網頁程式包成 App，改用手機本機通知（App 關著也會準時提醒）。建置與測試方法見 [`app/README.md`](app/README.md)。

> 網頁程式有兩份：最外層（網站用）與 `app/www/`（手機 App 用），內容相同。改了網頁程式要兩邊一起更新。

## 檔案

| 檔案 | 用途 |
|---|---|
| `index.html` | App 主畫面 |
| `style.css` | 樣式（配色、字級、版面） |
| `app.js` | 程式（行程、提醒、分享、安裝提示） |
| `manifest.webmanifest` | 安裝到手機桌面的設定（名稱、圖示、顏色） |
| `sw.js` | 離線快取。**改版時要把裡面的 `VERSION` 改掉**，長輩手機上的舊版才會更新 |
| `install.html` | 「放到手機桌面」圖解（安卓／iPhone） |
| `icons/` | App 圖示 |
| `app/` | 手機 App 專案（Capacitor：`android/`、`ios/`、`www/`、建置腳本 `tools/`） |

## 在自己電腦上試

需要用網址打開（直接雙擊 `index.html` 時，離線功能不會啟動）：

```powershell
python -m http.server 8766
```

然後用瀏覽器打開 http://localhost:8766

## 部署到 GitHub Pages（免費，取得固定網址）

不需要寫指令，用網頁操作即可：

1. 登入 GitHub，按右上角「＋」→「New repository」。
2. Repository name 填 `have_a_good_day`（網址會用到，建議英文），選 **Public**，按「Create repository」。
3. 在新的儲存庫頁面按「uploading an existing file」，把本資料夾**裡面的所有檔案和 `icons` 資料夾**拖進去（不要拖整個外層資料夾），按「Commit changes」。
4. 到儲存庫的「Settings」→ 左側「Pages」→ Source 選「Deploy from a branch」→ Branch 選 `main`、資料夾選 `/ (root)` → 「Save」。
5. 等 1～2 分鐘，頁面上方會出現網址，格式是 `https://你的帳號.github.io/have_a_good_day/`。

**注意**：Public 儲存庫的程式碼任何人都看得到。程式裡沒有個人資料（長輩的行程只存在各自手機裡），可以公開。

## 之後改版

1. 修改檔案（網頁程式記得同步到 `app/www/`）。
2. 把 `sw.js` 的 `VERSION` 和 `app.js` 的 `APP_VERSION` 改成新版號（例如 `v3.2`）。
3. 依專案版次規則另存一份新資料夾（例如 `好日子行事曆_app_v3.2`），再用 git 提交、打版本標籤並推送。
4. 長輩下次打開 App 時會在背景下載新版，再下一次打開就是新版。
