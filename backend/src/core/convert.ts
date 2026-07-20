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
  // 重量表記(例:32g / 27g～33g / 2〜3g / ２〜３ｇ / 3kg)を除去。
  // 波ダッシュ〜(U+301C)・全角チルダ～・各種ハイフン・全角数字/ｇ・kg に対応。
  {
    const D = "[0-9０-９]", G = "[kｋ]?[gGｇＧ]", T = "[-‐‑–—―ー－~～〜]", DOT = "(?:[.．][0-9０-９]+)?";
    s = s.replace(new RegExp(D + "+" + DOT + "\\s*" + G + "\\s*" + T + "\\s*" + D + "+" + DOT + "\\s*" + G, "g"), " "); // 27g～33g
    s = s.replace(new RegExp(D + "+" + DOT + "\\s*" + T + "\\s*" + D + "+" + DOT + "\\s*" + G, "g"), " ");             // 27～33g
    s = s.replace(new RegExp(T + "\\s*" + D + "+" + DOT + "\\s*" + G, "g"), " ");                                     // ～33g
    s = s.replace(new RegExp(D + "+" + DOT + "\\s*" + G + "\\s*" + T + "?", "g"), " ");                               // 33g～ / 33g
  }
  s = s.replace(/約?\s*[0-9０-９]+([.．][0-9０-９]+)?\s*(cm|ｃｍ|CM|Cm|mm|ｍｍ)/g, " ");
  s = s.replace(/[0-9０-９]+\s*匹/g, " ");
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

/** 建物名の先頭にある番地(例:6-15-1)を住所側へ繰り上げる。
 *  B2の「マンション・ビル名」は全角16字までで、Amazon等が番地を建物欄に入れてくると超過するため。
 *  数字＋ハイフンが続く形(最低1ハイフン)のみ対象。単独数字や英字始まりの建物名は動かさない。 */
export function liftBanchi(addr: string, bldg: string): [string, string] {
  if (!bldg) return [addr, bldg];
  const m = bldg.match(/^\s*([0-9０-９]+(?:\s*[-‐‑–—―ー－ｰ]\s*[0-9０-９]+)+)\s*/);
  if (m) return [(addr || "") + m[1].replace(/\s+/g, ""), bldg.slice(m[0].length)];
  return [addr, bldg];
}

/** 全角=1,半角=0.5 で文字幅を数える（B2は建物名・町番地とも全角16字） */
function zenLen(s: string): number {
  let n = 0;
  for (const c of s || "") n += c.charCodeAt(0) > 0xff ? 1 : 0.5;
  return n;
}
/** 住所を 都道府県／市区郡町村／町・番地 にざっくり分割 */
function splitAddr(s: string): { pref: string; city: string; town: string } {
  s = s || "";
  const pm = s.match(/^(東京都|北海道|京都府|大阪府|.{2,3}県)/);
  const pref = pm ? pm[1] : "";
  const rest = s.slice(pref.length);
  const cm = rest.match(/^(.+?郡.+?[町村]|.+?市.+?区|.+?[市区町村])/);
  const city = cm ? cm[1] : "";
  return { pref, city, town: rest.slice(city.length) };
}
/** 先頭から全角maxZen以内に収まる最大の文字列 */
function takeZen(s: string, maxZen: number): string {
  let n = 0, i = 0;
  for (; i < s.length; i++) { const w = s.charCodeAt(i) > 0xff ? 1 : 0.5; if (n + w > maxZen) break; n += w; }
  return s.slice(0, i);
}
/** 建物名が全角16字を超える分を「町・番地」側(空きがある範囲)へ送り、両方を16字以内に収める(データは消さない) */
export function fitAddrBldg(addr: string, bldg: string): [string, string] {
  if (zenLen(bldg) <= 16) return [addr, bldg];
  const { pref, city, town } = splitAddr(addr);
  const space = 16 - zenLen(town);
  if (space <= 0) return [addr, bldg];
  const move = takeZen(bldg, space);
  if (!move) return [addr, bldg];
  return [pref + city + town + move, bldg.slice(move.length)];
}

/** 政令指定都市の 区一覧。元データで「市」が抜けている(例:福岡県博多区…)場合に市名を補完する */
const SEIREI_CITIES: Record<string, Record<string, string[]>> = {
  "北海道": { "札幌市": ["中央区","北区","東区","白石区","豊平区","南区","西区","厚別区","手稲区","清田区"] },
  "宮城県": { "仙台市": ["青葉区","宮城野区","若林区","太白区","泉区"] },
  "埼玉県": { "さいたま市": ["西区","北区","大宮区","見沼区","中央区","桜区","浦和区","南区","緑区","岩槻区"] },
  "千葉県": { "千葉市": ["中央区","花見川区","稲毛区","若葉区","緑区","美浜区"] },
  "神奈川県": { "横浜市": ["鶴見区","神奈川区","西区","中区","南区","保土ケ谷区","磯子区","金沢区","港北区","戸塚区","港南区","旭区","緑区","瀬谷区","栄区","泉区","青葉区","都筑区"], "川崎市": ["川崎区","幸区","中原区","高津区","多摩区","宮前区","麻生区"], "相模原市": ["緑区","中央区","南区"] },
  "新潟県": { "新潟市": ["北区","東区","中央区","江南区","秋葉区","南区","西区","西蒲区"] },
  "静岡県": { "静岡市": ["葵区","駿河区","清水区"], "浜松市": ["中央区","浜名区","天竜区"] },
  "愛知県": { "名古屋市": ["千種区","東区","北区","西区","中村区","中区","昭和区","瑞穂区","熱田区","中川区","港区","南区","守山区","緑区","名東区","天白区"] },
  "京都府": { "京都市": ["北区","上京区","左京区","中京区","東山区","下京区","南区","右京区","伏見区","山科区","西京区"] },
  "大阪府": { "大阪市": ["都島区","福島区","此花区","西区","港区","大正区","天王寺区","浪速区","西淀川区","東淀川区","東成区","生野区","旭区","城東区","阿倍野区","住吉区","東住吉区","西成区","淀川区","鶴見区","住之江区","平野区","北区","中央区"], "堺市": ["堺区","中区","東区","西区","南区","北区","美原区"] },
  "兵庫県": { "神戸市": ["東灘区","灘区","兵庫区","長田区","須磨区","垂水区","北区","中央区","西区"] },
  "岡山県": { "岡山市": ["北区","中区","東区","南区"] },
  "広島県": { "広島市": ["中区","東区","南区","西区","安佐南区","安佐北区","安芸区","佐伯区"] },
  "福岡県": { "福岡市": ["東区","博多区","中央区","南区","西区","城南区","早良区"], "北九州市": ["門司区","若松区","戸畑区","小倉北区","小倉南区","八幡東区","八幡西区"] },
  "熊本県": { "熊本市": ["中央区","東区","西区","南区","北区"] },
};
const WARD2CITY: Record<string, Record<string, string | null>> = (() => {
  const m: Record<string, Record<string, string | null>> = {};
  for (const p in SEIREI_CITIES) {
    m[p] = {};
    for (const c in SEIREI_CITIES[p]) for (const w of SEIREI_CITIES[p][c]) m[p][w] = (w in m[p]) ? null : c;
  }
  return m;
})();
function prefOf(addr: string): string { const m = (addr || "").match(/^(東京都|北海道|京都府|大阪府|.{2,3}県)/); return m ? m[1] : ""; }
/** Amazon等で都道府県がローマ字(例:Kyoto-fu)の場合に日本語へ変換 */
const ROMAJI_PREF: Record<string, string> = { hokkaido: "北海道", aomori: "青森県", iwate: "岩手県", miyagi: "宮城県", akita: "秋田県", yamagata: "山形県", fukushima: "福島県", ibaraki: "茨城県", tochigi: "栃木県", gunma: "群馬県", gumma: "群馬県", saitama: "埼玉県", chiba: "千葉県", tokyo: "東京都", kanagawa: "神奈川県", niigata: "新潟県", toyama: "富山県", ishikawa: "石川県", fukui: "福井県", yamanashi: "山梨県", nagano: "長野県", gifu: "岐阜県", shizuoka: "静岡県", aichi: "愛知県", mie: "三重県", shiga: "滋賀県", kyoto: "京都府", osaka: "大阪府", hyogo: "兵庫県", hyougo: "兵庫県", nara: "奈良県", wakayama: "和歌山県", tottori: "鳥取県", shimane: "島根県", okayama: "岡山県", hiroshima: "広島県", yamaguchi: "山口県", tokushima: "徳島県", kagawa: "香川県", ehime: "愛媛県", kochi: "高知県", kouchi: "高知県", fukuoka: "福岡県", saga: "佐賀県", nagasaki: "長崎県", kumamoto: "熊本県", oita: "大分県", ooita: "大分県", miyazaki: "宮崎県", kagoshima: "鹿児島県", okinawa: "沖縄県" };
export function romajiPref(addr: string): string {
  if (!addr) return addr;
  const m = addr.match(/^([A-Za-z]+)(-(?:to|fu|ken|do))?/i);
  if (!m) return addr;
  const base = m[1].toLowerCase();
  return ROMAJI_PREF[base] ? ROMAJI_PREF[base] + addr.slice(m[0].length) : addr;
}
/** 市区町村名の重複を除去（例:川崎市川崎市宮前区→川崎市宮前区）。
 *  ship-cityとship-address-1の両方に市名が入る場合の対策 */
export function dedupeCity(addr: string): string {
  if (!addr) return addr;
  let s = addr, prev: string;
  do { prev = s; s = s.replace(/([^0-9０-９\s]{1,8}?[市区郡町村])\1/, "$1"); } while (s !== prev);
  return s;
}
/** 都道府県の直後がいきなり政令市の区(市名抜け)なら市名を補う。曖昧な区名はそのまま */
export function completeCity(addr: string): string {
  if (!addr) return addr;
  const pref = prefOf(addr); if (!pref) return addr;
  const wm = WARD2CITY[pref]; if (!wm) return addr;
  const rest = addr.slice(pref.length);
  for (const w in wm) if (rest.startsWith(w)) return wm[w] ? pref + wm[w] + rest : addr;
  return addr;
}

/** 住所と建物名を正しく振り分け直す。
 *  ・町・番地が空で建物名側に住所が入っている→住所へ戻す
 *  ・建物名が空で住所に建物名(カタカナ)が混在→番地の後の最初のカタカナ以降を建物名へ分離 */
export function extractBuilding(addr: string, bldg: string): [string, string] {
  let { pref, city, town } = splitAddr(addr);
  if (!town && bldg) { town = bldg; bldg = ""; }
  if (!bldg) {
    let seenDigit = false;
    for (let i = 0; i < town.length; i++) {
      const ch = town[i], cp = ch.codePointAt(0)!;
      if (/[0-9０-９]/.test(ch)) seenDigit = true;
      else if (seenDigit && ((cp >= 0x30A1 && cp <= 0x30FF) || cp === 0x30FC)) {
        bldg = town.slice(i).trim(); town = town.slice(0, i).replace(/\s+$/, ""); break;
      }
    }
  }
  return [pref + city + town, bldg];
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
  let [laddr, lbldg] = liftBanchi(completeCity(dedupeCity(romajiPref(o.addr))), o.bldg); // ローマ字都道府県→日本語＋市名重複除去＋政令市の市名補完＋建物名先頭の番地を住所へ繰り上げ
  [laddr, lbldg] = extractBuilding(laddr, lbldg); // 住所と建物名を正しく振り分け直す
  laddr = stripSpaces(laddr, strip); lbldg = stripSpaces(lbldg, strip);
  [laddr, lbldg] = fitAddrBldg(laddr, lbldg); // 建物名16字超は町・番地側へ送り収める
  setC(r, "L", laddr);
  setC(r, "M", lbldg);
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
  if (!blankBill) { setC(r, "AN", sender.bill); setC(r, "AO", sender.cls); }
  setC(r, "AP", sender.freight || "01"); // 運賃管理番号は必須。常に文字列で出力（既定01）

  if (o.ch === "AMAZON") {
    // Amazonは Amazon/ヤマト側が配送通知を行うため送らない（利用区分=0）。
    // ただしお届け予定メールのアドレス欄(AW)には記録としてアドレスを入れておく。
    setC(r, "AV", "0"); setC(r, "AW", o.email); setC(r, "AZ", "0");
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
