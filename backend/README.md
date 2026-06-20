# バックエンド雛形（全自動出荷）

ヤマト B2クラウドAPI × Amazon SP-API（＋将来 Yahoo!/BASE）で、
**受注取得 → 伝票発行 → 出荷通知** を全自動化するサーバーレス・バックエンドの雛形です。

> ⚠️ 現状は**雛形（スケルトン）**です。各API（Amazon SP-API / ヤマトB2クラウドAPI）の
> 認証情報・仕様書が揃ってから、`channels/` と `carriers/` のスタブを実装します。
> **共通の変換ロジック（`core/`）は現行ツールから移植済みで、テストも通ります。**

## 構成

```
backend/
├── template.yaml            … AWS SAM（Lambda + EventBridge + DynamoDB）
├── package.json / tsconfig.json
├── src/
│   ├── handlers/fulfillment.ts … オーケストレーション（①〜④）
│   ├── core/                   … 変換ロジック（移植済み・テスト有）
│   │   ├── types.ts  b2layout.ts  convert.ts  csv.ts
│   ├── channels/               … 受注チャネル（SP-API等）※実装待ちスタブ
│   │   ├── amazon.ts  yahoo.ts  base.ts  types.ts
│   ├── carriers/yamatoB2.ts    … ヤマトB2クラウドAPI ※実装待ちスタブ
│   ├── store/idempotency.ts    … 二重出荷防止（DynamoDB想定）
│   ├── config.ts               … 設定/秘密情報の読込
│   └── local.ts                … ローカルdryRun実行
└── tests/convert.test.ts       … 変換ロジックの受け入れテスト
```

## 移植済みの変換ルール（`core/convert.ts`）

現行 `index.html` と同一仕様：
- 出荷予定日 = お届け予定日 − 2日（本日より前は本日に繰り上げ／お届け無しは本日）
- 品名の短縮（定型語・スペック除去、略号化、ユーザー置換ルール）
- 住所スペース整形（数字どうしはハイフン）
- 電話番号 +81 → 0 正規化
- 同一宛先の伝票統合（数量合算・代引合算）
- **Amazonはお届けメール利用区分=0（送らない）／その他は1**

## 開発

```bash
cd backend
npm install
npm test         # 変換ロジックのテスト（認証情報不要）
npm run typecheck
npm run local    # dryRunで実行（未設定チャネルはスキップ）
```

## デプロイ（API準備後）

```bash
npm run build
sam build && sam deploy --guided   # 初回。DryRun=true のまま検証を推奨
```

- 認証情報は **AWS Secrets Manager / SSM Parameter Store** に保存し、`template.yaml` から参照する。
- 検証が済んだら `DryRun=false` にして本番稼働。
- スケジュールは `template.yaml` の `ScheduleExpression`（既定: 15分ごと）で調整。

## 次の実装ステップ（認証情報入手後）

1. `channels/amazon.ts`：LWAトークン取得、`getOrders`/`orderItems`/`address`、`confirmShipment`
2. `carriers/yamatoB2.ts`：契約後の仕様書に従い `issueLabel` を実装
3. `store/idempotency.ts`：`DynamoStore` を有効化（雛形をコメントで同梱）
4. `handlers/fulfillment.ts`：dryRunで通し検証 → 半自動 → 全自動へ
5. Yahoo!/BASE チャネルを順次実装
