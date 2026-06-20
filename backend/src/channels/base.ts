// BASE API クライアント（スタブ）
//
// 使用予定: 注文取得API（/1/orders）、注文編集API（出荷ステータス更新）。
//   認証は BASE OAuth2.0（refresh_token）。BASE Developers でアプリ登録が必要。
//
// 正規化マッピングは現行ツールの parseBase に準拠:
//   配送先優先（空なら請求先で代替）。住所2が番地(数字・ハイフンのみ)なら住所へ結合、
//   建物名なら建物へ。cod=/代引/.test(支払い方法)?合計金額:0。

import { Order } from "../core/types";
import { SalesChannel, ShipmentInfo } from "./types";
import { BaseCreds } from "../config";

export class BaseChannel implements SalesChannel {
  readonly name = "BASE" as const;
  constructor(private creds: BaseCreds, private opts: { abbr?: boolean } = {}) {}

  async fetchUnshippedOrders(): Promise<Order[]> {
    throw new Error("BASE API 未設定: fetchUnshippedOrders を実装してください");
  }
  async confirmShipment(order: Order, info: ShipmentInfo): Promise<void> {
    void order; void info;
    throw new Error("BASE API 未設定: confirmShipment を実装してください");
  }
}
