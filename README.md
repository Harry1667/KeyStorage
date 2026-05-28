# KeyStorage

端到端加密 API Key 儲存網站 — 很多網站的 Key 只顯示一次，忘了就沒了。KeyStorage 讓你安全儲存所有金鑰，點擊即可複製或顯示，客戶端加密後才傳輸，伺服器不見明文。

## 功能
- API Key 新增 / 查看 / 複製 / 刪除
- 客戶端加密（伺服器零知識，只儲存密文）
- 一鍵複製到剪貼簿
- 密碼保護存取

## 架構
| 層 | 技術 |
|----|------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS v4 |
| 後端 | PHP（`api.php`）|
| 資料庫 | MySQL（`schema.sql`）|

## 快速開始
```bash
# 前端開發
cd 02-web
npm install
npm run dev

# 後端（需 PHP + MySQL 環境）
# 1. 建立資料庫（執行 schema.sql）
# 2. 複製 config.php 並填入 DB 連線設定
# 3. 將 api.php、config.php 部署至 PHP 伺服器
```

---

## English

An end-to-end encrypted API-key vault. Many services show an API key only once — lose it and you're done. KeyStorage lets you stash every key safely; the browser encrypts before transmission, and the server only ever sees ciphertext.

### Features
- Add / view / copy / delete API keys
- Client-side encryption (zero-knowledge server, ciphertext only)
- One-click copy to clipboard
- Password-protected access

### Architecture
| Layer | Tech |
|-------|------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4 |
| Backend | PHP (`api.php`) |
| Database | MySQL (`schema.sql`) |

### Quick start
```bash
# Frontend dev
cd 02-web
npm install
npm run dev

# Backend (requires PHP + MySQL)
# 1. Create the database (run schema.sql)
# 2. Copy config.php and fill in DB credentials
# 3. Deploy api.php and config.php to a PHP server
```
