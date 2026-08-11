# 糖前哨 — 獨立網頁版

這是一個完全獨立、不需要 Claude 帳號登入即可使用的靜態網頁 App。所有健康資料只存在
使用者自己的瀏覽器裡（localStorage），不會上傳到任何伺服器。

## 這個資料夾裡有什麼

```
index.html      網頁主檔案
app.bundle.js   打包好的 App 程式（React + 圖表庫都已包在裡面）
manifest.json   PWA 設定檔，讓 iPhone「加入主畫面」時有獨立圖示與全螢幕體驗
sw.js           離線快取（App 外殼可離線開啟，但拍照分析仍需要網路）
icon-*.png      App 圖示
source/         原始 React 原始碼，之後想修改功能可以從這裡改，改完重新打包
```

## 第一步：申請 Anthropic API Key（拍照分析熱量功能需要）

「拍照分析熱量」這個功能，會直接從使用者的手機/瀏覽器呼叫 Anthropic 的 AI
服務，所以每個使用者都需要有自己的 API Key：

1. 前往 https://console.anthropic.com/settings/keys
2. 註冊／登入 Anthropic 帳號，建立一組新的 API Key
3. 建議同時到 Console 的用量設定（Usage limits）設定每月上限，避免超支
4. 把 Key 複製起來，之後在 App 的「個人資料」頁最下方「AI 拍照分析設定」貼上並儲存

沒有設定 Key 的話，其他功能（個人資料、飲食紅綠燈指南、運動建議、手動輸入熱量、
體態紀錄）都可以正常使用，只有「拍照分析」會提示尚未設定金鑰。

Key 只會存在使用者自己裝置的瀏覽器裡，不會被送到除了 Anthropic 官方 API 以外
的任何地方。但也因為它存在瀏覽器裡，理論上使用同一台裝置、同一個瀏覽器的人都看
得到，請避免在公用電腦上長期保存。

## 第二步：把這個資料夾放到網路上

你需要一個地方「主機」這些檔案，讓手機可以透過網址打開。以下兩個都是免費、幾分鐘
可以完成、不需要寫程式的方式：

### 方法 A：Netlify Drop（最簡單）
1. 瀏覽器打開 https://app.netlify.com/drop
2. 直接把這整個資料夾拖曳到網頁上
3. 幾秒後會產生一個網址（例如 `https://xxxx.netlify.app`），這就是你的網頁連結
4. 需要一個免費 Netlify 帳號才能長期保留這個網址（不然是暫時的）

### 方法 B：GitHub Pages
1. 在 https://github.com 建立一個新的 repository（設為 Public）
2. 把這個資料夾裡的所有檔案上傳上去
3. 到 repository 的 Settings → Pages，Source 選擇你剛剛的分支（通常是 main）
4. 幾分鐘後會有一個 `https://你的帳號.github.io/repo名稱/` 網址

兩種方法都可以，選你比較熟悉的即可。

## 第三步：在 iPhone 上「安裝」成 App

1. 用 iPhone 的 **Safari** 打開你上一步拿到的網址（一定要用 Safari，其他瀏覽器
   沒有「加入主畫面」功能）
2. 點下方的「分享」圖示（方框加箭頭）
3. 選擇「加入主畫面」
4. 主畫面就會出現「糖前哨」的 App 圖示，點下去會全螢幕開啟，沒有 Safari 網址列，
   體驗上很接近原生 App

## 之後想修改功能？

`source/` 資料夾裡是完整的 React 原始碼。修改 `source/App.jsx` 之後，需要重新
打包成 `app.bundle.js`：

```bash
cd source
npm install react react-dom recharts lucide-react
npx esbuild entry.jsx --bundle --minify --loader:.jsx=jsx --format=iife \
  --define:process.env.NODE_ENV='"production"' --outfile=../app.bundle.js
```

打包完成後，把新的 `app.bundle.js` 覆蓋原本的檔案，重新上傳到你的主機即可。

## 重要提醒

本 App 提供的飲食、運動、熱量建議僅供健康生活型態參考，不是醫療診斷。拍照熱量估
算為 AI 粗略推測，實際數值可能有落差。如有實際血糖異常、已確診糖尿病或糖尿病前
期、或正在接受飲食相關治療，請務必諮詢醫師或營養師，不要完全依賴本 App 的估算數
字做健康決策。
