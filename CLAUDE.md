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

source/App.jsx        主要畫面與狀態管理（分頁、表單、既有的 Tab 元件）
source/entry.jsx       進入點，掛載 App 到 #root，最上面 import 了 storage-shim.js
source/storage-shim.js 把 Claude.ai artifact 專用的 window.storage API
                        用瀏覽器原生 localStorage 模擬出來，讓這個獨立版本能正常運作
source/package.json    npm 依賴與 build／test 指令

source/lib/health.js   ★健康領域邏輯與參考值（BMI／體脂／骨骼肌率／腰圍分區、
                        BMR 與每日熱量、喝水量、風險評分、食物資料庫、CONTENT_REVIEW）
                        這個檔案是用 tools/extract-health.mjs 從舊版 App.jsx 機械抽取的，
                        逐字元相同。要改裡面的數值請直接改這裡，不要手打複製到別處
source/lib/goals.js    達標判定、成長階段、花園累計。含 FIELDS（資料欄位名）
source/lib/storage.js  所有 storage 存取、保留期規則、備份與還原
source/lib/useGarden.js 把達標判定與每日摘要包成 React hook 供 App.jsx 使用

source/components/Sprout.jsx      樹苗／樹（六階段 × 四活力，同一組葉片幾何）
source/components/Garden.jsx      花園場景（完成的樹）
source/components/Rings.jsx       三環與圖例
source/components/GrowthPanel.jsx 主畫面的樹苗／花園切換卡
source/components/ActivityPanel.jsx 活動力畫面（三環＋本週格子）
source/components/DietDiary.jsx   以天為單位的飲食日記

source/tools/          一次性的改版工具與測試（見下）
```

## 重新打包指令（改完 source/ 之後一定要跑，app.bundle.js 才會更新）
```bash
cd source
npm install
npm run build
```
`npm run build` 就是原本那條 esbuild 指令，已經寫進 package.json。esbuild 版本鎖在
0.28.2（devDependencies），這樣每次打包的產出才可重現 —— 否則沒辦法用「重打包後檔案
有沒有變」來判斷是不是忘記打包了。

改動邏輯後跑測試：
```bash
cd source
npm test
```

本機實際跑起來看（不需要額外安裝任何東西）：
```bash
node source/tools/serve.mjs 4173
```
然後開 <http://localhost:4173/>。確認沒問題再 commit + push，GitHub Pages 會自動
重新部署。

## source/tools/ 裡是什麼
- `test-goals.mjs` — 達標／成長／花園規則的測試（`npm test` 跑的就是這個）
- `serve.mjs` — 本機靜態伺服器
- `extract-health.mjs` — 從舊版 App.jsx 抽出 lib/health.js。已經跑過，保留是為了
  留下「這些數值是機械搬移、不是手打」的證據
- `wire-modules.mjs`、`patch-*.mjs` — 這次改版的一次性修改腳本，保留當作變更紀錄，
  **不要重跑**（它們的替換目標已經不在了，重跑只會失敗）

## 樹苗養成與花園（2026-09 改版新增）
- **達標的定義**：一天要三項**全部**達成才算 —— 熱量控制達標、運動 30 分鐘、
  喝水 2000cc。缺一項整天就不計入。門檻與常數定義在 `lib/goals.js`
- **熱量達標有下限**：攝取量要在目標的 50%～100% 之間。只設上限的話，忘記記錄
  飲食（攝取 0）會被判定成「沒超過目標」而算達標，整個花園就沒有意義了
- **成長階段**：由**累計**達標天數推進（不是連續），一棵樹 30 個達標日，
  分六階：種子 0／冒芽 1／小苗 3／幼苗 7／小樹 14／開花 30。斷一天不歸零，
  只是那天不往前走
- **花園**：每完成一棵樹就永久種進花園。花園狀態完全由每日摘要推算出來，
  沒有第二份資料會漂移
- **每日摘要**（`daily-summary`）：一天一筆、四個欄位，**永久保留不裁切**。
  因為飲食／喝水／運動紀錄分別只留 30／60／90 天，達標歷史必須比它們活得久
- **回填**：首次啟動時會從既有紀錄回推，但最多只能回推 30 天（判斷熱量達標要靠
  飲食紀錄）。更早的沒有資料可還原
- **樹苗不會枯死**：沒達標只是葉子下垂、顏色轉灰，不會退階也不會死。顏色是綠轉
  灰而不是綠轉褐 —— 褐色＝枯萎＝失敗，這是給狀況不好的日子也會打開的 App

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
- **資料欄位名不能猜。** 讀錯欄位不會報錯，只會回傳 0，然後某個判定就永遠不成立。
  這已經真的發生過一次：運動時間存的是 `durationMin`，但判定邏輯讀 `minutes`，
  結果運動這項永遠無法達標，而測試因為用了同樣錯的名字所以全過。三個欄位名集中在
  `lib/goals.js` 的 `FIELDS`，測試裡有直接斷言。新增讀取紀錄的程式碼一律用 `FIELDS`
- **`lib/health.js` 是健康數值的唯一來源。** 不要把裡面的常數或公式複製到別的檔案 ——
  兩份副本遲早會各自漂移，而漂移的那份不會報錯，只會給出錯的健康建議
- **飲食紀錄的照片會過期，文字不會。** 滿 30 天（`PHOTO_DAYS`）只刪照片、保留文字，
  這樣日記才有長期歷史。照片一張約 20KB，一年三餐就會超過瀏覽器 localStorage 的
  容量上限；文字一天約 300 bytes，十年才 1MB。**不要改成連文字一起刪**
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
- **Apple Watch／Apple 健康連動做不到，不要再評估。** HealthKit 只開放給原生 iOS
  App，網頁沒有這個 API。要做到必須整個改寫成原生 App（Mac＋Xcode＋開發者帳號年費），
  而且三項裡只有運動分鐘能自動，不值得
- **手機主動跳的推播提醒也做不到。** 純前端靜態網站沒有後端可以推送。提醒的實際做法
  是「傍晚打開 App 時，若還差一項就顯示」，搭配補登前一天（`canBackfill`）

## 部署方式
GitHub Pages：repo 設定為 Public，Settings → Pages → Build and deployment →
Source 選「Deploy from a branch」→ Branch 選 main、資料夾選 `/ (root)`。
上傳/push 新的 `app.bundle.js` 等檔案後，GitHub Pages 會在幾分鐘內自動重新部署。

## 使用者背景（互動時可以注意的地方）
使用者不是工程背景，之前在這個專案的開發過程中，Shortcuts、GitHub 網頁上傳、
Service Worker 快取等技術性步驟都需要很詳細、逐步的圖解式說明才能順利完成。
說明時盡量白話、步驟化，避免預設對方熟悉開發者工具或術語。
