// 全自動出荷オーケストレーション（Lambdaエントリ）
//   ① 受注取得 → ② ヤマトB2APIで伝票発行 → ③ 出荷通知 → ④ 処理済み記録（冪等性）
//
// EventBridge Scheduler から定期起動する想定。
// 認証情報が未設定のチャネルは自動スキップ（dryRun時はログのみ）。

import { loadConfig } from "../config";
import { Order } from "../core/types";
import { mergeOrders, jstToday } from "../core/convert";
import { SalesChannel } from "../channels/types";
import { AmazonChannel } from "../channels/amazon";
import { YamatoB2Client } from "../carriers/yamatoB2";
import { MemoryStore, ProcessedStore, orderKey } from "../store/idempotency";

export interface RunSummary {
  channel: string;
  fetched: number;
  shipments: number;
  skipped: number;
  errors: string[];
}

export async function run(store: ProcessedStore = new MemoryStore()): Promise<RunSummary[]> {
  const cfg = loadConfig();
  const summaries: RunSummary[] = [];
  const today = jstToday();

  const channels: SalesChannel[] = [];
  if (cfg.amazon) channels.push(new AmazonChannel(cfg.amazon));
  // if (cfg.yahoo) channels.push(new YahooChannel(cfg.yahoo));
  // if (cfg.base)  channels.push(new BaseChannel(cfg.base));

  const yamato = cfg.yamato ? new YamatoB2Client(cfg.yamato) : null;

  for (const ch of channels) {
    const sum: RunSummary = { channel: ch.name, fetched: 0, shipments: 0, skipped: 0, errors: [] };
    try {
      const orders = await ch.fetchUnshippedOrders();
      sum.fetched = orders.length;

      // 処理済みを除外
      const byId = new Map<string, Order>();
      const fresh: Order[] = [];
      for (const o of orders) {
        if (await store.isProcessed(orderKey(ch.name, o.oid))) { sum.skipped++; continue; }
        byId.set(o.oid, o);
        fresh.push(o);
      }

      // 同一宛先を統合（同一チャネル内）
      const merged = mergeOrders(fresh, today);

      for (const m of merged) {
        const oids = m._orders || [m.oid];
        try {
          if (cfg.dryRun || !yamato) {
            console.log(`[dryRun] 伝票発行スキップ ${ch.name} ${oids.join(",")} -> ${m.name} / ${m.addr}`);
          } else {
            const res = await yamato.issueLabel(m, cfg.sender);
            const info = { trackingNumber: res.trackingNumber, shipDate: today };
            for (const oid of oids) {
              const ord = byId.get(oid) || m;
              await ch.confirmShipment(ord, info);
            }
            sum.shipments++;
            for (const oid of oids) {
              await store.markProcessed(orderKey(ch.name, oid), { trackingNumber: res.trackingNumber });
            }
          }
        } catch (e) {
          sum.errors.push(`order ${oids.join(",")}: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      sum.errors.push((e as Error).message);
    }
    summaries.push(sum);
  }
  return summaries;
}

/** Lambda ハンドラ */
export async function handler(): Promise<{ statusCode: number; body: string }> {
  const summaries = await run();
  console.log("run summary:", JSON.stringify(summaries));
  return { statusCode: 200, body: JSON.stringify(summaries) };
}
