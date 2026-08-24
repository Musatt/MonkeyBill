# 猴子分帳本

給朋友群組用的分帳網頁 App。React + Vite，部署在 GitHub Pages，資料存在 Supabase。

線上版：https://musatt.github.io/MonkeyBill/

## 開發

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 分帳運算的回歸測試
npm run build    # 產出 dist/
```

**本機開發預設不會連正式資料庫。** `src/devMockSupabase.js` 會攔截 Supabase 的請求，改用 localStorage，
所以你在本機怎麼亂點都不會動到大家的帳。要在本機連正式資料庫時，建一個 `.env.local`：

```
VITE_USE_REAL_DB=1
```

## 部署

推到 `main` 就會由 `.github/workflows/deploy.yml` 自動測試、build、部署。

**第一次要先做一次設定**：GitHub repo → Settings → Pages → Source 選 **GitHub Actions**
（原本是 Deploy from a branch）。改完之後根目錄那個手工編譯的 `index.html` 就沒有作用了，可以刪掉。

## Supabase 免費方案會休眠

免費專案「7 天內資料庫查詢過少」就會被暫停，暫停後 App 會顯示「連不上雲端資料」，
要有人到 Supabase 後台按 Resume project 才會恢復（資料不會不見，一年內都可恢復）。

只有真正的 API／資料庫請求算活動，登入後台點來點去不算。
所以  每天固定戳兩次，讓計時器永遠不會走到 7 天。

要注意 GitHub 會停用「repo 閒置超過 60 天」的排程工作流程（會寄信通知），
屆時到 Actions 頁面按啟用、或隨便推一個 commit 即可恢復。
保活失敗時工作流程會紅燈並寄信，那通常代表專案真的被暫停了。



```
src/
  constants.js          Supabase 連線資訊、分類、幣別、萬能密碼
  styles.css            全部樣式
  App.jsx               路由、各種 action、畫面組裝
  lib/
    supabase.js         REST 讀寫。讀取失敗一定 throw，不會被誤判成空資料庫
    merge.js            逐筆合併：只覆寫自己動過的那幾筆
    useStore.js         載入 / 樂觀更新 / 合併寫入 / 存檔狀態 / 背景輪詢
    useRouter.js        hash 路由（GitHub Pages 靜態主機用 hash 才不會 404）
    money.js            分帳核心運算 ★改這裡一定要跑 npm test
    money.test.mjs      回歸測試
    format.js           日期、金額格式、成員查名
    localPrefs.js       這台裝置記住的身份與已解鎖群組
    seed.js             全新資料庫時的範例資料
  components/           各畫面
```

## 資料模型

雲端只有一張表 `app_data`，整個 App 的資料是 `id = 'main'` 那一列的 `data` JSON：

```sql
create table app_data (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
```

- `groups`：`{ id, name, description, password, members: [{id, name, phone, bankCode, bankAccount, otherPayment, deleted}] }`
- `projects`：`{ id, groupId, name, description, date, memberIds, baseCurrency, settlementDecimals, settlementMode, collectorId }`
- `expenses`（其實是「項目」，三種 `itemType`）：
  - `expense` 支出：`payers: [{memberId, amount}]`, `splitType`(equal/ratio/custom), `splitMemberIds`, `splitWeights`, `splitAmounts`
  - `collection` 收入：欄位同上，語意相反（payers 是收款人）
  - `transfer` 轉帳：`fromMemberId`, `toMemberId`（不分攤）
  - 共同欄位：`category, note, amount, currency, exchangeRate, baseAmount, date, time, lastEditedBy, lastEditedAt`

成員是**軟刪除**（`deleted: true`）：從名單消失但歷史紀錄完整保留，之後用同樣的名字可以復原成同一個人。

## 幾個刻意的設計

- **每筆項目的分攤金額無條件進位到「專案的結算單位」**（不是固定的小數兩位）。
  整數結算的專案，每個人的分攤就是整數，餘額全程都是整數。
  這很重要：若分攤算到 201.34、結算卻叫人付 202，付完會多出 0.66 的溢繳，
  下次打開結算頁那 0.66 又被進位成整整 1 元，還會冒出叫別人付錢給他的假轉帳。
- **付款人拿回的錢，合計必須剛好等於分攤金額的合計**，否則 `sum(balances) !== 0`。
  所以除了金額最大的付款人以外各自進位，由他吸收尾差
  （若每人各自進位，多人共同付款時合計最多會差 n×0.5）。
- **結算**依專案的 `settlementDecimals` 無條件進位，金額最大的收款人吸收尾差。
- **專案內所有主幣別金額都用 `settlementDecimals` 顯示**，一筆一筆加起來才會等於總額。
- **同步不是即時的**：開啟時讀一次、每 20 秒背景讀一次、切回分頁時讀一次。
  寫入是「先讀雲端 → 套上自己的修改 → 寫回」，兩個人同時記帳不會互相蓋掉。
- **萬能密碼 `0000`** 可以解開任何群組密碼、解除保護、刪除群組。
  這組密碼跟群組密碼都是明文放在前端與雲端的，群組鎖只是避免手滑點進去，不是真的存取控制。
