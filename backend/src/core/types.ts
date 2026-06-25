// 共通の型定義

export type Channel = "AMAZON" | "YAHOO" | "BASE";

/** 1商品明細 */
export interface Item {
  name: string; // 表示用商品名（短縮前/後どちらでも、buildRow前に短縮しておく）
  qty: number;
}

/** 正規化済みの注文（各チャネルのクライアントがこの形に変換して返す） */
export interface Order {
  ch: Channel;
  oid: string; // 注文ID（冪等性キーにも使用）
  tel: string;
  zip: string;
  addr: string; // 都道府県＋市区町村＋番地
  bldg: string; // 建物名
  name: string; // 受取人名
  deliv: Date | null; // お届け希望日（無ければ null=最短日）
  slot: string; // 配達時間帯コード（B2形式 例 0812）
  items: Item[];
  cod: number; // 代引額（0=代引でない）
  email: string;
  _orders?: string[]; // 統合された注文IDの一覧
}

/** ご依頼主（出荷元）固定値 */
export interface SenderConfig {
  name: string;
  tel: string;
  zip: string;
  addr: string;
  bill: string; // 請求先顧客コード
  cls: string; // 請求先分類コード
  freight: string; // 運賃管理番号
}

/** 商品名短縮の置換ルール [元の語, 短縮語] */
export type ShortenRule = [string, string];

/** 変換オプション */
export interface ConvertOptions {
  abbr?: boolean; // 略号化（アダルト→A 等）既定 true
  merge?: boolean; // 同一宛先統合 既定 true
  strip?: boolean; // 住所スペース詰め 既定 true
  customShorten?: ShortenRule[];
  /** 「本日」を固定したい場合（テスト用）。未指定なら現在のJST日付 */
  today?: Date;
}

// 個人情報（氏名・電話・住所・請求先顧客コード）はソースに持たせない。
// 実運用では環境変数 SENDER_NAME / SENDER_TEL / SENDER_ZIP / SENDER_ADDR / SENDER_BILL で必ず指定すること。
export const SENDER_DEFAULTS: SenderConfig = {
  name: "",
  tel: "",
  zip: "",
  addr: "",
  bill: "",
  cls: "001",
  freight: "01",
};
