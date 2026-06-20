import { Order } from "../core/types";

/** 出荷通知に必要な情報 */
export interface ShipmentInfo {
  trackingNumber: string; // ヤマトの伝票番号（追跡番号）
  shipDate: Date;
}

/** 受注チャネル（モール）の共通インターフェース */
export interface SalesChannel {
  readonly name: "AMAZON" | "YAHOO" | "BASE";
  /** 未出荷の注文を取得して Order[] に正規化して返す */
  fetchUnshippedOrders(): Promise<Order[]>;
  /** 出荷通知（運送会社＝ヤマト＋追跡番号）を送る */
  confirmShipment(order: Order, info: ShipmentInfo): Promise<void>;
}
