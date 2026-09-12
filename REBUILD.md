# 重新產出這個 App —— 一頁就夠

這一頁是給「換一台電腦、或很久以後回來」的自己看的。
只要照著做，在任何地方都能把 `app.bundle.js` 重新產出來。

---

## 一、需要什麼

只有一樣：**Node.js**（版本 20 以上，目前用 24）。
沒有的話到 <https://nodejs.org> 下載安裝，或在 Windows 上：

```bash
winget install OpenJS.NodeJS.LTS
```

裝完把終端機關掉重開，`node -v` 有印出版本就成功了。

---

## 二、把程式抓下來

```bash
git clone https://github.com/fyj5867/Foodie-control.git
```

---

## 三、產出檔案（就這一行）

```bash
cd Foodie-control/source && npm run rebuild
```

這一行會依序做完：裝套件（第一次才需要）→ 跑完所有測試 → 打包 →
告訴你 `app.bundle.js` 有沒有變、多大。

**測試沒過就不會打包。** 這是刻意的：`app.bundle.js` 是實際被部署出去的檔案，
從一份規則已經不成立的程式碼打包出來，比打包失敗更糟。

想在本機看實際畫面：

```bash
node tools/serve.mjs 4173
```

然後開 <http://localhost:4173/>。

---

## 四、要上線

`app.bundle.js` 等檔案 push 到 `main` 之後，GitHub Pages 幾分鐘內會自動更新
<https://fyj5867.github.io/Foodie-control/>。

```bash
git add -A && git commit -m "說明改了什麼" && git push
```

**改完程式一定要重新打包再 push。** 只 push 原始碼不會改變網站上的東西 ——
網站載入的是 `app.bundle.js`，那是打包產物。

**手機上看不到更新**：改動後要把 `sw.js` 裡的 `CACHE_NAME` 換一個新版本號
（例如 `healthy-care-v28` → `v29`），否則舊的離線快取會一直給舊畫面。
換完之後手機上把 App 完全關掉再重開。

---

## 五、想繼續改功能的話

把整個資料夾丟給 Claude Code，然後說要改什麼。**先請它讀 `CLAUDE.md`** ——
那份是這個專案的規則書，裡面記著每一個踩過的坑和「為什麼是這樣做」，
包括好幾個不會報錯、只有測試抓得到的問題。

如果只能講一句話給接手的人，是這句：

> **絕對不要改 localStorage 的鍵名。**
> `profile`、`body-records`、`food-log`、`water-log`、`exercise-log`、
> `daily-summary`、`food-calories`、`health-reports`、`workout-links`、
> `clinic-visits`、`exam-plans` —— 這些是找到手機上既有資料的唯一途徑。
> 改了不是換個名字，是把所有紀錄變成孤兒。

同一條規則也適用於**一筆紀錄裡的欄位名**。實際的例子：睡眠的輸入欄位在 2026-09
改成「時／分」兩格，但存進 `body-records` 的仍然是原本那個小數 `sleepHours` ——
換掉它會讓每一夜已經記過的資料讀不出來。**換輸入方式可以，換儲存格式不行**，
兩者之間的換算集中在 `source/lib/sleep.js`。

其他幾條同等級的：

- **健康數值只有一個來源**：`source/lib/health.js`。不要把常數或公式複製到別處，
  兩份副本遲早各自漂移，而漂移的那份不會報錯，只會給出錯的健康建議。
- **AI 不寫醫療文字。** 模型只負責「看照片、回傳數字或標籤」；每一句使用者會讀到
  的健康說明都寫在程式裡，並且被測試檢查（不診斷、不預測數字會怎麼變、
  疾病只寫成族群層級的關聯）。
- **資料欄位名不能猜。** 讀錯欄位不會報錯，只會回傳 0，然後某個判定永遠不成立。
  這已經真的發生過一次。
- **版面要用 320px 寬測**，不是 375px。iPhone 開了「顯示縮放」之後回報的就是 320。

---

## 六、資料夾裡有什麼

```
index.html        網頁外殼，載入 app.bundle.js
app.bundle.js     打包產物 —— 不要手改，它是編譯出來的
manifest.json     PWA 設定（加入主畫面的圖示與名稱）
sw.js             離線快取；改版時記得換 CACHE_NAME
icon-*.png        App 圖示

source/App.jsx    主畫面與狀態
source/lib/       規則與資料處理（健康數值、達標、健檢報告、飲食標籤、
                  就醫與排定的檢查、行事曆 .ics、睡眠時分換算…）
source/components/ 畫面元件
source/tools/     測試與工具（見下）

CLAUDE.md         規則書：每個決定的理由、每個踩過的坑
README.md         給使用者看的：怎麼設定 API Key、怎麼加到主畫面
```

`source/tools/` 裡剩下的都是還會用到的：

| 檔案 | 做什麼 |
| --- | --- |
| `build-all.mjs` | `npm run rebuild` 跑的就是它 |
| `serve.mjs` | 本機起一個靜態伺服器看畫面 |
| `check-imports.mjs` | 找出「用了但忘記 import」的名字（esbuild 抓不到這種） |
| `test-*.mjs` | 所有規則的測試，`npm test` 會全部跑過 |
| `gen-sprout.mjs` ＋ `health-forest-stages.json` | 從設計稿產生植物的圖 |
| `import-quotes.mjs` | 從真乘心語的 .docx 重新匯入句子 |
| `preview-sprout.jsx` / `preview-analysis.jsx` | 一次看全部狀態，用來判斷畫面好不好 |

一次性的改版腳本（`patch-*.mjs`、`wire-modules.mjs`、`extract-health.mjs`）
已經刪掉了 —— 它們的替換目標早就不存在，重跑只會失敗，而「當時改了什麼」
git 記錄裡就有。
