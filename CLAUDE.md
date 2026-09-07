# 糖前哨 App — 專案說明（給 Claude Code 的交接筆記）

## 這是什麼
一個第二型糖尿病預防用的生活型態管理網頁 App（PWA），繁體中文介面，給個人使用，
部署在 GitHub Pages。技術上是純前端 React App（無後端伺服器），所有資料存在使用者
瀏覽器的 localStorage，AI 拍照熱量分析則是瀏覽器直接呼叫 Google Gemini 或
Anthropic Claude 的 API（使用者自己在畫面上填 API Key，Key 只存本機瀏覽器）。

## 檔案結構
```
index.html          網頁殼層，載入 app.bundle.js，含 PWA meta tags
app.bundle.js        打包後的最終產出檔案 —— 不要手動編輯，這是編譯出來的
manifest.json        PWA 設定檔（App 圖示、名稱等）
sw.js                Service Worker，離線快取用（network-first 策略）
icon-*.png / icon.svg  App 圖示
source/App.jsx        ★主要開發檔案，幾乎所有功能都寫在這一個檔案裡（單檔 React App）
source/entry.jsx       進入點，掛載 App 到 #root，最上面 import 了 storage-shim.js
source/storage-shim.js 把 Claude.ai artifact 專用的 window.storage API
                        用瀏覽器原生 localStorage 模擬出來，讓這個獨立版本能正常運作
source/package.json    npm 依賴設定（react, react-dom, recharts, lucide-react）
```

## 重新打包指令（改完 source/App.jsx 之後一定要跑這個，app.bundle.js 才會更新）
```bash
cd source
npm install react react-dom recharts lucide-react
npx esbuild entry.jsx --bundle --minify --loader:.jsx=jsx --format=iife \
  --define:process.env.NODE_ENV='"production"' --outfile=../app.bundle.js
```
建議改完後開一個瀏覽器分頁本機測試（例如 `npx serve .` 在專案根目錄），確認沒問題
再 commit + push，GitHub Pages 會自動重新部署。

## 核心功能（目前已完成，供你了解全貌）
- **個人資料**：年齡/性別/身高/體重/主要病徵；平時活動量改成「強度/中度/輕度」三種
  勾選＋每週分鐘數，App 依 WHO/ADA 準則自動換算成 sedentary/light/active 供內部計算用
- **飲食建議**：紅綠燈飲食指南；AI 拍照熱量分析（Gemini 免費／Anthropic 付費可切換）；
  手動輸入；飲食紀錄（最近7天，可直接編輯已存的熱量數字，含照片縮圖）；官方食品營養
  成分資料庫查詢連結
- **今日熱量目標**：優先用「體態紀錄」裡最新一筆的基礎代謝率(BMR)計算，沒有的話用
  年齡/性別/身高/體重公式估算；使用者也可以手動輸入自訂目標覆寫系統計算值；有展開
  區塊說明計算方式
- **喝水量**：依體重/性別/活動量估算目標；一鍵快速記錄常見份量；歷史紀錄以「每日
  總量」保存（不是每次點擊都存一筆）；可愛水滴角色依達成率變換表情；有趨勢圖
- **運動建議**：每週運動計畫模板；運動紀錄與達成率（依強度分類為有氧/阻力/柔軟度，
  跟每週150分鐘目標比較，給出建議文字）；運動項目含快走以外的多種選項
- **體態紀錄**：體重/BMI/腰圍/體脂肪/內臟脂肪/骨骼肌率/體年齡/BMR；BMI、體脂肪率、
  骨骼肌率、腰圍的趨勢圖都有依衛福部/醫療常見標準做顏色分區背景（一眼看出好壞）；
  歷史紀錄預設只顯示最新3天，超過會有「展開全部歷史紀錄」按鈕依月份分組顯示
- **資料備份**：匯出/匯入 JSON，匯出優先跳出手機分享選單（可存 Google Drive/iCloud），
  裝置不支援分享 API 時自動退回直接下載

## 重要架構決策（改的時候要注意）
- **不要**把資料存取改回 `window.storage` 直接呼叫官方 Claude.ai 環境的版本；這個獨立
  版本靠 `storage-shim.js` 模擬同樣的 get/set/delete/list 介面存進 localStorage，維持
  這層抽象可以讓程式碼其餘部分不用大改
- 所有 `setXxxForm({...form, field: value})` 這種直接展開更新的 pattern，如果同一個表單
  裡有 checkbox/chip 點擊跟文字輸入同時存在，容易觸發 React 批次更新的競態問題（已經修過
  一次真實案例：exerciseForm 的 chip 選擇被緊接著的文字輸入蓋掉）。新增表單欄位時優先用
  `setForm((f) => ({...f, field: value}))` 函式型寫法，比較安全
- AI 拍照分析的 prompt 裡有特別要求：如果照片拍到包裝食品的營養標示文字，要優先讀取
  標示上的數字，而不是純外觀估算；也要求 AI 誠實回報 confidence，不要灌水
- 健康相關的參考數值（BMI/體脂肪/骨骼肌率/腰圍分區、飲水量公式、熱量計算公式）都盡量
  引用衛福部/國健署等官方或準官方來源，並記錄在 `CONTENT_REVIEW` 這個常數裡（含
  `lastReviewed` 校對日期與 `sources` 來源清單），之後調整這類數值記得一併更新它
- 曾經有一個「網址參數自動記錄」的功能（給 iOS 捷徑/Apple 健康自動化用）因為有資料
  被意外覆蓋的風險而被移除了；除非使用者明確要求，不要重新加類似「打開頁面就自動
  寫入資料」的機制

## 部署方式
GitHub Pages：repo 設定為 Public，Settings → Pages → Build and deployment →
Source 選「Deploy from a branch」→ Branch 選 main、資料夾選 `/ (root)`。
上傳/push 新的 `app.bundle.js` 等檔案後，GitHub Pages 會在幾分鐘內自動重新部署。

## 使用者背景（互動時可以注意的地方）
使用者不是工程背景，之前在這個專案的開發過程中，Shortcuts、GitHub 網頁上傳、
Service Worker 快取等技術性步驟都需要很詳細、逐步的圖解式說明才能順利完成。
說明時盡量白話、步驟化，避免預設對方熟悉開發者工具或術語。
