// Amazon SP-API クライアント（スタブ）
//
// ※ 実装は SP-API の認証情報取得後に行う。ここでは呼び出し箇所と
//    使用するオペレーションを明示しておく。
//
// 使用予定オペレーション:
//   - 受注取得 : Orders API  GET /orders/v0/orders?MarketplaceIds=...&OrderStatuses=Unshipped
//                            GET /orders/v0/orders/{orderId}/orderItems
//                            GET /orders/v0/orders/{orderId}/address  (要 PII ロール)
//   - 出荷通知 : Orders API  POST /orders/v0/orders/{orderId}/shipmentConfirmation  (confirmShipment)
//                 carrierCode に「Yamato」、trackingNumber に伝票番号を指定。
//   - 認証     : LWA (Login with Amazon) で refresh_token → access_token を取得し
//                x-amz-access-token ヘッダに付与（SigV4はLWAのみ運用なら不要）。
//
// ドキュメント:
//   https://developer-docs.amazon.com/sp-api/docs/orders-api
//   https://developer-docs.amazon.com/sp-api/reference/confirmshipment

import { Order } from "../core/types";
import { shortenName, slot, parseISODate, qtyNum } from "../core/convert";
import { SalesChannel, ShipmentInfo } from "./types";
import { AmazonCreds } from "../config";

export class AmazonChannel implements SalesChannel {
  readonly name = "AMAZON" as const;
  constructor(private creds: AmazonCreds, private opts: { abbr?: boolean } = {}) {}

  // TODO: refresh_token → access_token（LWA）。15分前後キャッシュする。
  private async getAccessToken(): Promise<string> {
    throw new Error("Amazon SP-API 未設定: LWAトークン取得を実装してください");
  }

  async fetchUnshippedOrders(): Promise<Order[]> {
    // TODO: getOrders(OrderStatuses=Unshipped) → 各注文の orderItems / address を取得し、
    //       下記の正規化マッピングで Order[] を組み立てる。
    //
    // 正規化マッピング（現行ツールと同じ項目対応）:
    //   oid   = AmazonOrderId
    //   tel   = 配送先電話番号
    //   zip   = 配送先郵便番号
    //   addr  = 都道府県 + 市区町村 + AddressLine1
    //   bldg  = AddressLine2 + AddressLine3
    //   name  = 受取人名
    //   deliv = parseISODate(配送希望日)  // 無ければ null
    //   slot  = slot(配送希望時間帯)
    //   items = [{ name: shortenName(商品名, abbr), qty: qtyNum(数量) }]
    //   cod   = COD なら代引額 / それ以外 0
    //   email = 購入者メール
    void shortenName; void slot; void parseISODate; void qtyNum; // 移植時に使用
    throw new Error("Amazon SP-API 未設定: fetchUnshippedOrders を実装してください");
  }

  async confirmShipment(order: Order, info: ShipmentInfo): Promise<void> {
    // TODO: POST shipmentConfirmation
    //   packageDetail: { packageReferenceId, carrierCode: "Yamato",
    //                    trackingNumber: info.trackingNumber, shipDate: ISO8601 }
    void order; void info;
    throw new Error("Amazon SP-API 未設定: confirmShipment を実装してください");
  }
}
