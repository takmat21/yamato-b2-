import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shipFrom,
  fmt,
  parseISODate,
  normPhone,
  stripSpaces,
  shortenName,
  buildRow,
  mergeOrders,
} from "../src/core/convert";
import { colIdx } from "../src/core/b2layout";
import { Order, SENDER_DEFAULTS } from "../src/core/types";

const TODAY = new Date(Date.UTC(2026, 5, 15)); // 2026/6/15
const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));

test("出荷予定日: お届け−2日、本日繰り上げ", () => {
  assert.equal(fmt(shipFrom(d(2026, 6, 17), TODAY)), "2026/6/15");
  assert.equal(fmt(shipFrom(d(2026, 6, 16), TODAY)), "2026/6/15"); // 6/14は過去→本日
  assert.equal(fmt(shipFrom(d(2026, 6, 20), TODAY)), "2026/6/18");
  assert.equal(fmt(shipFrom(null, TODAY)), "2026/6/15");
});

test("電話番号の +81 正規化", () => {
  assert.equal(normPhone("+818092466631"), "08092466631");
  assert.equal(normPhone("+81 80-9246-6631"), "080-9246-6631");
  assert.equal(normPhone("'09012345678"), "09012345678");
});

test("住所スペース処理（数字どうしはハイフン）", () => {
  assert.equal(stripSpaces("レオパレスストリーム  106"), "レオパレスストリーム106");
  assert.equal(stripSpaces("レオパレス2  202号室"), "レオパレス2-202号室");
});

test("商品名の短縮（定型語除去・略号化・ユーザールール）", () => {
  assert.equal(shortenName("ZAZOO 冷凍マウス アダルト 10匹", true), "A");
  assert.equal(shortenName("ホッパー 5匹", true, [["ホッパー", "H"]]), "H");
});

test("buildRow: Amazonはメール利用区分0、その他は1", () => {
  const base: Order = {
    ch: "AMAZON", oid: "111-1", tel: "+819011112222", zip: "100-0001",
    addr: "東京都千代田区", bldg: "", name: "山田太郎", deliv: d(2026, 6, 17),
    slot: "0812", items: [{ name: "A", qty: 2 }], cod: 0, email: "x@example.com",
  };
  const amz = buildRow(base, SENDER_DEFAULTS, TODAY);
  assert.equal(amz[colIdx("AV")], "0");
  assert.equal(amz[colIdx("AZ")], "0");
  assert.equal(amz[colIdx("AW")], "x@example.com"); // 利用区分0でもアドレスは記録
  assert.equal(amz[colIdx("I")], "09011112222");
  assert.equal(amz[colIdx("E")], "2026/6/15");
  assert.equal(amz[colIdx("AB")], "A");
  assert.equal(amz[colIdx("AD")], "2");

  const yh = buildRow({ ...base, ch: "YAHOO" }, SENDER_DEFAULTS, TODAY);
  assert.equal(yh[colIdx("AV")], "1");
  assert.equal(yh[colIdx("AW")], "x@example.com");
  assert.equal(yh[colIdx("BB")], "お届け完了");
});

test("mergeOrders: 同一宛先を1伝票・数量合算", () => {
  const o1: Order = {
    ch: "BASE", oid: "A", tel: "0901", zip: "100-0001", addr: "東京都港区1", bldg: "",
    name: "佐藤", deliv: d(2026, 6, 18), slot: "", items: [{ name: "A", qty: 1 }], cod: 1000, email: "",
  };
  const o2: Order = { ...o1, oid: "B", items: [{ name: "A", qty: 2 }], cod: 500 };
  const merged = mergeOrders([o1, o2], TODAY);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].items[0].qty, 3);
  assert.equal(merged[0].cod, 1500);
  assert.deepEqual(merged[0]._orders, ["A", "B"]);
});

test("parseISODate", () => {
  assert.equal(fmt(parseISODate("2026-06-17")!), "2026/6/17");
  assert.equal(parseISODate("不明"), null);
});
