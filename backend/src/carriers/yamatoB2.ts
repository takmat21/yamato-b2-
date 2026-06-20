// ヤマト B2クラウドAPI クライアント（スタブ）
//
// ※ 具体的なエンドポイント・リクエスト仕様は「契約後にヤマトから提供される仕様書」に従う。
//    ここでは送り状発行の入出力インターフェースだけを定義しておく。
//
// 想定:
//   - 「画面なしAPI」で送り状データを送信 → 伝票番号(追跡番号)を受領。
//   - 入力は B2 の95列レイアウト相当（buildRow の結果を流用可能）。
//   - 必要に応じてラベルPDFのダウンロードURL/データも受領。
//
// 参考: https://business.kuronekoyamato.co.jp/service/lineup/b2api/index.html

import { Order } from "../core/types";
import { buildRow } from "../core/convert";
import { SenderConfig } from "../core/types";
import { YamatoB2Creds } from "../config";

export interface IssueResult {
  trackingNumber: string; // 伝票番号
  labelUrl?: string; // ラベルPDF等（提供される場合）
}

export class YamatoB2Client {
  constructor(private creds: YamatoB2Creds) {}

  /** 1注文の送り状を発行し、伝票番号を返す */
  async issueLabel(order: Order, sender: SenderConfig): Promise<IssueResult> {
    // buildRow で95列の行を作り、ヤマトの仕様に合わせて送信する想定。
    const row = buildRow(order, sender);
    void row; void this.creds;
    throw new Error("ヤマトB2クラウドAPI 未設定: issueLabel を実装してください（契約後に仕様書に従う）");
  }
}
