# 森平衡社群發布系統

這個資料夾是「審稿後發布」的發布系統骨架。

目前安全預設：

- 每天 11:00 由 Codex automation 產出草稿。
- 草稿需要人工審稿。
- 草稿狀態不是 `approved` 時，發布腳本會阻擋。
- `.env.example` 只放欄位，不放真實 token。
- `config/accounts.json` 預設所有 API 帳號都是 `enabled: false`。

## 第一階段流程

1. 每天 11:00 等 Codex 產出草稿。
2. 審稿後，如果要發布，將草稿存成 JSON，並把 `status` 改為 `approved`。
3. 先 dry-run：

```powershell
& "C:\Users\IanLi\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "C:\Users\IanLi\Documents\senbalance\social-publisher\scripts\publish.js" --dry-run --draft "C:\Users\IanLi\Documents\senbalance\social-publisher\drafts\example-draft.json"
```

4. 確認內容與平台後，再進入 API 設定。

## API 發布限制

- Facebook Page: 可用 Pages API 發布粉專貼文。
- Threads: 可用 Threads API 發布文字內容。
- Instagram: Instagram Content Publishing API 不支援純文字貼文，通常需要圖片、影片或 Reels 容器。這個骨架先阻擋 Instagram 實際發布，避免誤以為文字可直接發。
- Facebook 個人帳號：第一版列為手動發布。

## 切到 API 發布前要做

1. 複製 `.env.example` 為 `.env`。
2. 填入官方 API 取得的 access token 和帳號 ID。
3. 在 `config/accounts.json` 只把已測試成功的平台改成 `enabled: true`。
4. 保持 `DRY_RUN=true` 先測試。
5. 測試成功後才將 `DRY_RUN=false`。

