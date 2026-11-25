# 好日子行事曆 App v3.0（iOS／Android，Capacitor）

階段二：把網頁 App（v2.1）包成手機 App，改用**手機本機排程通知**，App 關著也會準時提醒。

| 項目 | 內容 |
|---|---|
| App 名稱 | 好日子行事曆 |
| App ID | `tw.edu.nycu.haveagoodday`（上架後不能改，送審前請組內確認） |
| 網頁程式 | `www/`（與網頁版共用同一份；在手機 App 裡自動切換成原生通知） |
| 原生專案 | `android/`（Android Studio 開）、`ios/`（Xcode 開，需 Mac） |
| 外掛 | `@capacitor/local-notifications` |
| 測試版安裝檔 | `have-a-good-day-v3.0-debug.apk`（可直接裝到 Android 手機測試；不能上架） |

## 和網頁版 v2.1 的差別

| | 網頁版 | 手機 App 版 |
|---|---|---|
| 提醒 | 打開 App 時才跳出 | **App 關著也會跳出系統通知** |
| 前一天提醒 | 晚上 6 點以後打開時 | 前一天**晚上 8 點** |
| 出門前提醒 | 開始前 1.5 小時內打開時 | 開始前 **1 小時** |
| 週日預告 | 設定時間以後打開時 | 週日設定的時間 |
| 通知權限 | 不需要 | 第一次打開先用大字說明，再請手機詢問；被關掉時提醒頁顯示大字警示與步驟 |
| 點通知 | — | 預告 → 下週清單；其他 → 日曆那一天 |
| 「放到手機桌面」提示、離線快取 | 有 | 不需要，自動隱藏 |

### 通知怎麼排（`www/app.js`「手機本機通知」一節）

- 每次新增、修改、刪除、「這次不去」、改提醒設定，以及每次打開 App，都會**全部清掉重排**。
- 不用「每週重複」通知，而是展開成**未來 21 天**的每一次，才能正確略過「這次不去」的那一天。
- iOS 同時最多 64 則通知；程式只排最近的 **60 則**。範例行程約 30 則。
- 長輩 3 週以上沒打開 App，第 22 天以後的通知就不會響（之後可加背景更新解決，見「待辦」）。
- **準時**：Android 用 `USE_EXACT_ALARM`（行事曆類 App 專用，安裝即取得，不會跳出設定頁）。萬一不能準時，就改用一般排程（可能晚到），**不會**把長輩帶到英文的系統設定頁。
- 提醒頁的「試試看」按鈕在手機 App 版會 **5 秒後跳出一則真的通知**，家人可用來確認長輩手機收得到。

## 已驗證（2026-11-25，瀏覽器模擬原生外掛）

- 同意權限後排出 31 則通知，編號不重複，時間符合上表。
- 把週四跳舞設為「這次不去」後，週四的 2 則通知消失（31 → 29）。
- 通知權限被關掉時：清掉所有通知、提醒頁顯示警示。
- 點通知會切到正確畫面；網頁版行為不變。

## 已驗證（2026-11-25，Android 16 模擬器實測）

| 測試 | 結果 |
|---|---|
| 第一次打開 | 先出現大字「讓好日子提醒你」說明，按「好，開啟提醒」後才跳出系統詢問 ✅ |
| 允許通知後 | 顯示「提醒開好了！」；系統排入 30 則提醒，第一則是 11/26 18:00（週四跳舞前 1 小時）✅ |
| 準時 | 系統鬧鐘清單顯示 `window=0`（準時，不延後）✅ |
| App 關著時的通知 | 回到手機桌面 5 秒後跳出「明天要跳舞（試試看）／晚上 7 點，在河濱公園」，通知列有紅色日曆小圖示 ✅ |
| 點通知 | 直接打開 App 的日曆，選在 11/26（週四）並列出跳舞 ✅ |

**測試中發現並修好的問題**

1. 外掛預設要求「準時鬧鐘」權限，允許通知後會**直接跳到英文的系統設定頁**「Alarms & reminders」，長輩會卡住。→ 改宣告 `USE_EXACT_ALARM`（自動取得），並在不能準時時改用一般排程。
2. 改用一般排程時，Android 允許延後**最多 1 小時**，「出門前 1 小時」可能變成活動開始才響。→ 同上，改回準時排程。
3. 專案路徑有中文，Android 建置工具在 Windows 上會失敗。→ `tools/build-apk.ps1` 先把專案複製到英文路徑 `%USERPROFILE%\hagd-build` 再建置。

尚未測試：實體手機、重開機後通知是否還在、各家手機的省電模式。

## 建置步驟

### Android（Windows 可）

這台電腦已安裝（2026-11-25）：Android Studio、Microsoft OpenJDK 21、Android SDK（平台 36、建置工具、模擬器 `medium_phone`）。

| 指令（在這個資料夾執行） | 做什麼 |
|---|---|
| `powershell -ExecutionPolicy Bypass -File .\tools\build-apk.ps1` | 建置測試版 APK → `have-a-good-day-v3.0-debug.apk` |
| `powershell -ExecutionPolicy Bypass -File .\tools\run-emulator.ps1` | 開模擬器、安裝並打開 App |
| `powershell -ExecutionPolicy Bypass -File .\tools\install-sdk.ps1` | （換電腦時）安裝 Android SDK |

注意：
- Gradle 8.14 不能用 Android Studio 內附的 Java 25，建置腳本會自動改用 JDK 21。
- 專案路徑有中文會建置失敗，所以腳本會先複製到 `%USERPROFILE%\hagd-build`。若用 Android Studio 開專案，請開那個英文路徑的資料夾。
- 裝到自己的 Android 手機：把 APK 傳到手機點開安裝（需允許「安裝不明來源應用程式」）。
- 上架用：Android Studio 開英文路徑的專案 → Build → Generate Signed App Bundle，產生 `.aab` 上傳到 Play Console 封閉測試。**簽署金鑰要備份**，遺失就不能再更新 App。

### iOS（需要 Mac）

1. Mac 安裝 Xcode 與 CocoaPods。
2. 把整個資料夾複製到 Mac，執行 `npm install`、`npx cap sync ios`、`npx cap open ios`。
3. Xcode 選擇開發團隊（Apple 開發者帳號），接上 iPhone 執行；上架用 Archive → TestFlight。

### 改了網頁程式之後

改 `www/` 裡的檔案後，執行 `npx cap sync` 把檔案複製進 `android/`、`ios/`，再重新建置。

## 待辦

- [x] 安裝 Android Studio，模擬器測試通知
- [ ] 實體手機測試（含重開機後通知是否還在、省電模式）
- [x] App 圖示與啟動畫面換成好日子撕頁日曆（`python tools/make-app-icons.py` 重新產生 Android 各尺寸、自適應圖示、Android 12+ 啟動畫面與 iOS 圖示）
- [ ] 上架 Google Play 時，在 Play Console 聲明 `USE_EXACT_ALARM` 用途為「行事曆 App」
- [ ] 字型打包進 App（目前用 Google Fonts，沒網路時會改用手機內建字型）
- [ ] 朗讀：Android WebView 多半不支援網頁朗讀，改用 TTS 外掛
- [ ] 分享：改用 `@capacitor/share` 呼叫手機分享選單
- [ ] 資料改存 `@capacitor/preferences`，避免系統清理 WebView 資料
- [ ] 通知被關掉時的「前往設定」按鈕（需外掛，目前是文字步驟）
- [ ] 背景定期重排通知，解決 21 天沒打開的問題
