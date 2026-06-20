// 冪等性ストア：処理済み注文を記録し、二重の伝票発行/出荷通知を防ぐ。
// 本番は DynamoDB（テーブル: processed_orders, PK: orderKey）を推奨。
// ここではインターフェースとメモリ実装（テスト/ローカル用）を提供する。

export interface ProcessedStore {
  isProcessed(orderKey: string): Promise<boolean>;
  markProcessed(orderKey: string, data: Record<string, unknown>): Promise<void>;
}

/** チャネル＋注文IDから一意なキーを作る */
export function orderKey(channel: string, orderId: string): string {
  return `${channel}#${orderId}`;
}

/** ローカル/テスト用のインメモリ実装 */
export class MemoryStore implements ProcessedStore {
  private set = new Map<string, Record<string, unknown>>();
  async isProcessed(k: string): Promise<boolean> { return this.set.has(k); }
  async markProcessed(k: string, data: Record<string, unknown>): Promise<void> { this.set.set(k, data); }
}

// 本番用の DynamoDB 実装（雛形）:
//
// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
// import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
//
// export class DynamoStore implements ProcessedStore {
//   private doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
//   constructor(private table = process.env.PROCESSED_TABLE!) {}
//   async isProcessed(k: string) {
//     const r = await this.doc.send(new GetCommand({ TableName: this.table, Key: { orderKey: k } }));
//     return !!r.Item;
//   }
//   async markProcessed(k: string, data: Record<string, unknown>) {
//     await this.doc.send(new PutCommand({ TableName: this.table,
//       Item: { orderKey: k, ...data, processedAt: new Date().toISOString() } }));
//   }
// }
