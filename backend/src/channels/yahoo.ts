// Yahoo!ショッピング 注文連携API クライアント（スタブ）
//
// 使用予定: 注文検索/取得API（OrderList/OrderInfo）、出荷API（OrderShip）。
//   認証は Yahoo! ID連携（OAuth2.0, refresh_token）。
//   利用には出店者向けAPIの利用申請が必要。
//
// 正規化マッピングは現行ツールの parseYahoo に準拠:
//   oid=OrderId, tel=ShipPhoneNumber, zip=ShipZipCode,
//   addr=ShipPrefecture+ShipCity+ShipAddress1, bldg=ShipAddress2, name=ShipName,
//   deliv=parseISODate(ShipRequestDate), slot=slot(ShipRequestTime),
//   items=[{name:shortenName(Title), qty:qtyNum(QuantityDetail)}],
//   cod=/代引/.test(PayMethodName)?TotalPrice:0, email=BillMailAddress

import { Order } from "../core/types";
import { SalesChannel, ShipmentInfo } from "./types";
import { YahooCreds } from "../config";

export class YahooChannel implements SalesChannel {
  readonly name = "YAHOO" as const;
  constructor(private creds: YahooCreds, private opts: { abbr?: boolean } = {}) {}

  async fetchUnshippedOrders(): Promise<Order[]> {
    throw new Error("Yahoo! API 未設定: fetchUnshippedOrders を実装してください");
  }
  async confirmShipment(order: Order, info: ShipmentInfo): Promise<void> {
    void order; void info;
    throw new Error("Yahoo! API 未設定: confirmShipment(OrderShip) を実装してください");
  }
}
