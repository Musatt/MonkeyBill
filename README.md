# 猴子分帳本

給朋友群組用的分帳網頁 App。React + Vite，部署在 GitHub Pages，資料存在 **Firebase Realtime Database**（2026-09 從 Supabase 搬過來）。

線上版：https://musatt.github.io/MonkeyBill/

## 開發

```bash
npm install
npm run dev      # http://localhost:5174
npm test         # 程式碼檢查＋所有回歸測試
npm run build    # 產出 dist/
```

**本機開發預設不會連正式資料庫。** `npm run dev` 時用的是 `src/lib/db/mock.js`——資料存在瀏覽器的 localStorage，
而且刻意模仿 Firebase 的行為（一樣會吃掉空陣列、開兩個分頁一樣會即時同步），所以你在本機怎麼亂點都不會動到大家的帳。

要在本機接上真的 Firebase（測時序、測安全規則），建一個 `.env.local`，測完刪掉：

```
VITE_USE_REAL_DB=1
```

## 部署

- **網頁**：推到 `main` 就會由 `.github/workflows/deploy.yml` 自動測試、build、部署到 GitHub Pages。
- **安全規則**（`database.rules.json`）：**不會自動部署**。改了之後要在電腦上（PowerShell 7）跑：

```
cd C:\Claude\apps\monkey-ledger; firebase deploy --only database
```

## 資料庫

整本帳放在 Firebase 的 `/ledger` 底下，**一筆一個路徑**：

```
/ledger/users/{id}
/ledger/groups/{id}
/ledger/projects/{id}
/ledger/expenses/{id}
```

- **即時同步**：瀏覽器跟資料庫保持一條連線，別人一改就推過來。第一次打開下載全部，之後只傳改動的那一筆。
- **寫入只送動到的那幾筆**（多路徑更新）。兩個人同時記不同的帳，資料結構本身保證不會互相蓋掉。
- **安全規則只准一筆一筆寫**，不准一次覆寫整個 `/ledger` 或整個分類——一次錯誤的寫入最多弄壞它點名的那幾筆，不會整本帳消失。
  但規則沒有驗證「你是誰」：網址跟金鑰本來就在網頁原始碼裡，懂技術的人還是能讀、能逐筆改。
- **Firebase 會自動刪掉空陣列、空物件和 null 欄位**（例如沒人被停用時的 `inactiveMemberIds`）。
  所以讀進來一律先經過 `lib/schema.js` 的 `hydrate()` 把形狀補回來，後面的程式可以放心假設欄位都在。
  `fbShape.test.mjs` 用真的「存進去再讀出來」模擬驗證過，每個人的餘額一分不差。

免費方案（Spark）額度：同時 100 條連線、1 GB 儲存、每月 10 GB 下載。**不會因為沒人用而休眠。**

## 架構

```
src/
  constants.js          Firebase 連線設定、分類、幣別、通用密碼
  styles.css            全部樣式
  App.jsx               路由、各種 action、畫面組裝
  lib/
    db/index.js         選資料庫：本機開發用 mock.js，正式網站用 firebase.js
    db/firebase.js      訂閱整本帳、連線狀態、多路徑寫入
    db/mock.js          本機假資料庫（localStorage，行為模仿 Firebase）
    fbShape.js          寫入前清理、模擬 Firebase 儲存、差異→多路徑更新
    merge.js            比對改前改後，算出動到哪幾筆
    useStore.js         訂閱 / 樂觀更新 / 存檔狀態 / 離線排隊
    schema.js           資料格式版本、v1→v2 遷移、hydrate() 補形狀
    names.js            暱稱規則（全系統唯一）
    permissions.js      誰能做什麼（含虛擬成員）
    money.js            分帳核心運算 ★改這裡一定要跑 npm test
    calc.js             金額欄位的算式（自己寫的解析器，不用 eval）
    useRouter.js        hash 路由（GitHub Pages 靜態主機用 hash 才不會 404）
    format.js           日期、金額格式、同步狀態文字
  components/           各畫面
scripts/
  migrate-to-firebase.mjs   一次性搬家工具（搬完可刪）
  rulesCheck.mjs            在本機用安全規則的條件檢查資料
database.rules.json     Firebase 安全規則
```

## 資料模型（v2）

- `users`：全域帳號。`{ id, name(暱稱＝帳號，全系統唯一), passwordHash(SHA-256 或 null), phone, bankCode, bankAccount, otherPayment, disabled, virtual, ownerGroupId }`
  - `virtual: true` 是**虛擬成員**：只屬於 `ownerGroupId` 那個群組、不能登入、不出現在登入頁
- `groups`：`{ id, name, description, memberIds[], adminIds[], inactiveMemberIds[] }`
- `projects`：`{ id, groupId, name, description, date, memberIds[], baseCurrency, settlementDecimals, settlementMode, collectorId, createdBy }`
- `expenses`（三種 `itemType`：支出／收入／轉帳），另有 `createdBy`（決定誰能刪這筆）

### 停用有兩層

- **全域停用**（後臺管理）：不能登入，不出現在任何選單
- **群組內停用**（群組管理者）：只在該群組消失

兩者都只影響「選人清單」。**歷史紀錄與結算餘額一律照算**，被停用的人仍會出現在結算頁。

### 權限

| | 一般成員 | 群組管理者 | 後臺管理 |
|---|---|---|---|
| 新增／編輯項目 | ✔ | ✔ | ✔ |
| 刪除項目 | 只有自己建的 | 任何一筆 | 任何一筆 |
| 建立專案、改專案設定 | ✔ | ✔ | ✔ |
| 刪除專案／群組 | ✘ | ✔ | ✔ |
| 管理成員與管理者、建虛擬成員 | ✘ | ✔ | ✔ |
| 刪除自己群組的虛擬成員（沒有帳目時） | ✘ | ✔ | ✔ |
| 正式帳號 ⇄ 虛擬成員 | ✘ | 只能虛擬→正式 | 雙向 |
| 停用／刪除正式帳號 | ✘ | ✘ | ✔ |

### 登入

暱稱就是帳號，密碼可留空。密碼存 SHA-256 雜湊而不是明文——資料庫是公開可讀的。
但驗證在瀏覽器端，**擋的是手滑點到別人的身分，不是真正的存取控制**。
登入畫面輸入保留字「後臺管理」＋通用密碼（`constants.js` 的 `MASTER_PASSWORD`）進入後臺。

## 幾個刻意的設計

- **每筆項目的分攤金額無條件進位到「專案的結算單位」**（不是固定的小數兩位）。
  若分攤算到 201.34、結算卻叫人付 202，付完會多出 0.66 的溢繳，下次打開結算頁又被進位成 1 元，還會冒出假轉帳。
- **付款人拿回的錢，合計必須剛好等於分攤金額的合計**，否則 `sum(balances) !== 0`。
  所以除了金額最大的付款人以外各自進位，由他吸收尾差。
- **結算**依專案的 `settlementDecimals` 無條件進位，金額最大的收款人吸收尾差。
- **結算方式預設「指定一人全收發」**，沒指定收發款人時自動用代墊最多的人。
- **資料庫是空的就顯示空畫面，絕對不自動寫入範例資料。**（舊版曾經因為讀取失敗被誤判成空資料庫，差點把範例資料蓋掉所有人的帳。）
