// 作り物の注文ファイル（実在しない名前・住所）で、道具が出荷アプリと同じ結果になるかを見る。
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(HERE, "out"); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(path.join(out, "dl"), { recursive: true });
const T = "\t";
const amzH = ["order-id","buyer-phone-number","ship-postal-code","ship-state","ship-city","ship-address-1","ship-address-2","ship-address-3","recipient-name","scheduled-delivery-start-date","scheduled-delivery-end-date","product-name","quantity-purchased","payment-method","cod-collectible-amount","buyer-email"];
const amz = [amzH.join(T),
  ["111-1111111-1111111","+819011112222","100-0001","東京都","千代田区","千代田1-1","テストビル 101","","試験 太郎","","","ZAZOO 冷凍マウス アダルトL 10匹 27〜32g","1","Other","","a@example.com"].join(T),
  ["222-2222222-2222222","090-3333-4444","530-0001","大阪府","大阪市北区","梅田2-2-2","","","見本 花子","","","ZAZOO 冷凍マウス ホッパー 10匹 10.1〜15g","2","Other","","b@example.com"].join(T)].join("\r\n");
fs.writeFileSync(path.join(out, "dl", "amazon_test.txt"), amz, "utf8");
const yhH = ["OrderId","ShipPhoneNumber","ShipZipCode","ShipPrefecture","ShipCity","ShipAddress1","ShipAddress2","ShipName","ShipRequestDate","ShipRequestTime","Title","QuantityDetail","PayMethodName","TotalPrice","BillMailAddress"];
const yh = [yhH.join(","), ["10009999","08055556666","460-0001","愛知県","名古屋市中区","三の丸3-3","","架空 次郎","","","ZAZOO 冷凍マウス ピンクS 50匹","1","クレジットカード決済","3000","c@example.com"].join(",")].join("\r\n");
fs.writeFileSync(path.join(out, "dl", "yahoo_test.csv"), yh, "utf8");
fs.writeFileSync(path.join(out, "dl", "memo.txt"), "これは注文ファイルではありません", "utf8");
const state = path.join(out, "state.json");
fs.writeFileSync(state, JSON.stringify({ yamatoB2_sender_v1: JSON.stringify({ name: "テスト出荷元", tel: "0748000000", zip: "529-1600", addr: "滋賀県蒲生郡日野町テスト1", bill: "0748000000", cls: "", freight: "01" }) }), "utf8");
const run = (extra = []) => { try { return JSON.parse(execFileSync("node", [path.join(HERE, "..", "ship_cli.mjs"), "--in", path.join(out, "dl"), "--state", state, "--out", path.join(out, "res"), ...extra], { encoding: "utf8" })); } catch (e) { return JSON.parse(e.stdout); } };

// 台帳の作り物（見出し1行＋前の日の1行）
const { default: ExcelJS } = await import("exceljs");
const ledger = path.join(out, "ledger.xlsx");
{ const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Sheet1"); ws.addRow(["お客様管理番号", "送り状種類", "クール区分", "伝票番号", "出荷予定日"]); ws.addRow(["OLD-1", "0", "2", "", "2026/11/16"]); await wb.xlsx.writeFile(ledger); }

const d = run(["--dry-run"]);
assert.equal(d.ok, true); assert.equal(d.newLabels, 3); assert.equal(d.filesNotOrders, 1); assert.ok(!fs.existsSync(path.join(out, "res")));
const r1 = run(["--ledger", ledger]);
assert.equal(r1.ok, true); assert.equal(r1.newLabels, 3); assert.deepEqual(r1.newByStore, { AMAZON: 2, YAHOO: 1 });
assert.equal(r1.ledger.firstRow, 3); assert.equal(r1.ledger.rows, 3); assert.ok(fs.existsSync(r1.ledger.backup));
const tsv = fs.readFileSync(r1.tsv, "utf8").replace(/^﻿/, "").trim().split("\r\n").map((l) => l.split("\t"));
assert.equal(tsv.length, 3); assert.equal(tsv[0].length, 95);
assert.ok(tsv.some((r) => r.includes("09011112222")), "電話番号の +81 が 0 に直っている");
{ const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(ledger); const ws = wb.worksheets[0]; assert.equal(ws.getRow(2).getCell(1).value, "OLD-1"); assert.ok(ws.getRow(3).values.length > 5); assert.equal(ws.actualRowCount, 5); }
// 2回目：同じファイルでは、もう足さない（二重に足さない）
const r2 = run(["--ledger", ledger]);
assert.equal(r2.newLabels, 0); assert.equal(r2.alreadyDone, 3);
{ const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(ledger); assert.equal(wb.worksheets[0].actualRowCount, 5); }
console.log("OK: テスト通過（新しい3件を台帳の3行目から書き足し、2回目は0件）");
