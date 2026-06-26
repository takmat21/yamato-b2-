// 現行ブラウザツール(index.html)の変換ロジックを移植したもの。
// 変換ルールは handover_prompt.md / README の仕様に準拠。
// 日付は Lambda(UTC) でも正しく動くよう JST 基準で計算する。

import { NCOL, colIdx } from "./b2layout";
import {
  Order,
  Item,
  SenderConfig,
  ShortenRule,
  ConvertOptions,
  SENDER_DEFAULTS,
} from "./types";

const MS_DAY = 86400 * 1000;
const JST_OFFSET = 9 * 3600 * 1000;

/** 現在(または指定)時刻のJST暦日を、UTC0時のDateとして返す */
export function jstToday(now: Date = new Date()): Date {
  const j = new Date(now.getTime() + JST_OFFSET);
  return new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate()));
}

/** YYYY/M/D 形式（UTC基準。dateは常にUTC0時の暦日として扱う） */
export function fmt(d: Date): string {
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/** "2026-06-17" や "2026/6/17" を UTC0時のDateへ。失敗時 null */
export function parseISODate(s: string | null | undefined): Date | null {
  const m = (s || "").match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}

/** 出荷予定日 = お届け予定日 − 2日。本日より前なら本日に繰り上げ。お届け無しは本日。 */
export function shipFrom(deliv: Date | null, today: Date = jstToday()): Date {
  const floor = today;
  if (!deliv) return floor;
  const d = new Date(deliv.getTime() - 2 * MS_DAY);
  return d < floor ? floor : d;
}

/** 配達時間帯コード（B2形式） */
export function slot(text: string | null | undefined): string {
  const t = text || "";
  if (/08:00|0812/.test(t)) return "0812";
  if (/14:00|1416/.test(t)) return "1416";
  if (/16:00|1618/.test(t)) return "1618";
  if (/18:00|1820/.test(t)) return "1820";
  if (/19:00|1921/.test(t)) return "1921";
  if (/^812$/.test(t.trim())) return "0812";
  const n = t.trim();
  if (/^\d{4}$/.test(n)) return n;
  return "";
}

const BOILER = ["ZAZOO","冷凍マウス","国産","真空個別包装","真空","個別包装","爬虫類","猛禽類","の 餌","の餌","餌","マウス","L1=","L2=","L3=","L4=","L5=","ステンレス弁当箱 小容量480ml STLB0","(有毛)","（有毛）"];

/** 商品名の短縮（定型語除去・スペック除去・略号化・ユーザー置換ルール適用） */
export function shortenName(name: string, abbr = true, custom: ShortenRule[] = []): string {
  let s = name || "";
  for (const [from, to] of custom) { if (from) s = s.split(from).join(to); }
  for (const w of BOILER) s = s.split(w).join(" ");
  s = s.replace(/\d+(\.\d+)?\s*[gG]\s*[~～]\s*\d+(\.\d+)?\s*[gG]/g, " "); // 27g～33g
  s = s.replace(/\d+(\.\d+)?\s*[~～]\s*\d+(\.\d+)?\s*[gG]/g, " ");         // 27～33g
  s = s.replace(/[~～]\s*\d+(\.\d+)?\s*[gG]/g, " ");                       // ～33g
  s = s.replace(/\d+(\.\d+)?\s*[gG]\s*[~～]?/g, " ");                      // 33g～ / 33g
  s = s.replace(/約?\s*\d+(\.\d+)?\s*(cm|ｃｍ)/g, " ");
  s = s.replace(/\d+\s*匹/g, " ");
  if (abbr) { s = s.split("アダルト").join("A").split("ピンク").join("P"); }
  s = s.replace(/[　 ]+/g, " ").trim();
  return s;
}

/** 数量文字列から数値を抽出（"L1=2" → 2、無ければ1） */
export function qtyNum(s: unknown): number {
  const m = String(s == null ? "" : s).replace(/^L\d+=/, "").match(/\d+/);
  return m ? parseInt(m[0], 10) : 1;
}

/** 電話番号の正規化（+81/＋81/先頭81 → 0、アポストロフィ・空白除去） */
export function normPhone(s: unknown): string {
  let p = String(s == null ? "" : s).trim().replace(/^['’]/, "").replace(/[ 　]/g, "");
  p = p.replace(/^(\+|＋)?81(?=\d)/, "0").replace(/[＋+]/g, "");
  return p;
}

/** 住所のスペース処理：詰める。前後が両方数字のときだけハイフンに置換 */
export function stripSpaces(s: string, strip = true): string {
  if (!strip || !s) return s;
  const isDigit = (c: string) => /[0-9０-９]/.test(c || "");
  let out = "", i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === " " || ch === "　" || ch === "\t") {
      let j = i;
      while (j < s.length && (s[j] === " " || s[j] === "　" || s[j] === "\t")) j++;
      const prev = out[out.length - 1] || "", next = s[j] || "";
      if (isDigit(prev) && isDigit(next)) out += "-";
      i = j;
    } else { out += ch; i++; }
  }
  return out;
}

function setC(row: string[], letter: string, v: unknown): void {
  row[colIdx(letter)] = v == null ? "" : String(v);
}

/** 1注文 → 95列の1行 */
export function buildRow(o: Order, sender: SenderConfig = SENDER_DEFAULTS, today: Date = jstToday(), strip = true, blankBill = true): string[] {
  const r = new Array(NCOL).fill("");
  setC(r, "A", o.oid);
  setC(r, "B", o.cod ? 2 : 0);
  setC(r, "C", 1);
  const f = o.deliv ? fmt(o.deliv) : "最短日";
  setC(r, "E", fmt(shipFrom(o.deliv, today)));
  setC(r, "F", f);
  setC(r, "G", o.slot);
  setC(r, "I", normPhone(o.tel));
  setC(r, "K", o.zip);
  setC(r, "L", stripSpaces(o.addr, strip));
  setC(r, "M", stripSpaces(o.bldg, strip));
  setC(r, "P", o.name);
  setC(r, "T", sender.tel); setC(r, "V", sender.zip); setC(r, "W", sender.addr); setC(r, "Y", sender.name);

  const its = o.items || [];
  const total = its.reduce((s, it) => s + (it.qty || 1), 0);
  let n1 = "";
  if (its.length === 1) n1 = its[0].name || "";
  else if (its.length >= 2) n1 = its.map((it) => (it.name || "") + (it.qty || 1)).join("");
  setC(r, "AB", n1);
  if (its.length >= 1) setC(r, "AD", String(total));

  setC(r, "AF", "ナマモノ");
  if (o.cod) setC(r, "AH", o.cod);
  // 請求先を空欄で出力すると、B2取込時に既定の請求先が自動使用され「請求先が存在しません」エラーを回避できる。
  if (!blankBill) { setC(r, "AN", sender.bill); setC(r, "AO", sender.cls); setC(r, "AP", sender.freight); }

  if (o.ch === "AMAZON") {
    // Amazonは Amazon/ヤマト側が配送通知を行う。直送メール拒否のお客様が多いため送らない。
    setC(r, "AV", "0"); setC(r, "AZ", "0");
  } else {
    setC(r, "AV", "1"); setC(r, "AW", o.email);
    setC(r, "AY", "お届け予定"); setC(r, "AZ", "1"); setC(r, "BA", o.email); setC(r, "BB", "お届け完了");
  }
  return r;
}

function norm(s: string | null | undefined): string {
  return (s || "").replace(/[\s　]/g, "");
}

/** 同一宛先の注文を1伝票に統合（品名は合算、代引額は合算） */
export function mergeOrders(list: Order[], today: Date = jstToday()): Order[] {
  const used = new Array(list.length).fill(false);
  const res: Order[] = [];
  for (let i = 0; i < list.length; i++) {
    if (used[i]) continue;
    const base: Order = { ...list[i] };
    let items: Item[] = (list[i].items || []).map((x) => ({ ...x }));
    const ords = [list[i].oid];
    for (let j = i + 1; j < list.length; j++) {
      if (used[j]) continue;
      const a = list[i], b = list[j];
      const same =
        norm(a.zip) === norm(b.zip) && norm(a.addr) === norm(b.addr) && norm(a.bldg) === norm(b.bldg) &&
        norm(a.name) === norm(b.name) && norm(a.tel) === norm(b.tel) &&
        fmt(a.deliv || today) === fmt(b.deliv || today);
      if (same) {
        used[j] = true;
        (b.items || []).forEach((x) => items.push({ ...x }));
        ords.push(b.oid);
        if (b.cod) base.cod = (base.cod || 0) + b.cod;
      }
    }
    const agg: Item[] = [];
    items.forEach((it) => {
      const f = agg.find((a) => a.name === it.name);
      if (f) f.qty += it.qty || 1; else agg.push({ ...it });
    });
    base.items = agg;
    base._orders = ords;
    used[i] = true;
    res.push(base);
  }
  return res;
}

/** 注文配列 → 95列の行配列（統合オプション対応） */
export function ordersToRows(orders: Order[], sender: SenderConfig = SENDER_DEFAULTS, opts: ConvertOptions = {}): string[][] {
  const today = opts.today ? jstToday(opts.today) : jstToday();
  const strip = opts.strip !== false;
  const blankBill = opts.blankBill !== false;
  const merged = opts.merge === false ? orders : mergeOrders(orders, today);
  return merged.map((o) => buildRow(o, sender, today, strip, blankBill));
}
