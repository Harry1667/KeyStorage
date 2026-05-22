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
