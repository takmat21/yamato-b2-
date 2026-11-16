#!/usr/bin/env node
// 出荷アプリ（ship.html）と同じ変換を、ファイルから直接おこなう道具。
// ship.html そのものを読み込んで動かすので、変換の決まりは出荷アプリと同じになる。
//
// 使い方：
//   node ship_cli.mjs --in <注文ファイルのあるフォルダ か ファイル…> --state <state.json> --out <出力フォルダ>
//        [--ship <ship.html の場所>] [--hours 24] [--today] [--date YYYY-MM-DD]
//        [--ledger <台帳.xlsx>] [--dry-run]
//
//   --state   出荷アプリの設定と「処理済み」の記録（出荷アプリの「設定を書き出す」で作る JSON）。
//             変換のあと、処理済みの記録を足して書きもどす。
//   --hours   フォルダを渡したとき、この時間より新しいファイルだけを読む（既定 24）
//   --today   「出荷予定日が基準日より後の注文を外す」を ON にする（--date で基準日）
//   --ledger  台帳（xlsx）の最後の行の下に、新しい分を書き足す（書く前に控えを作る）
//   --clip    新しい分を、エクセルに貼れる形でクリップボードに置く（Windows だけ。出荷アプリの「コピー」と同じ形）
//   --reclip  変換はせず、いちばん新しい貼り付け用のデータを、もう一度クリップボードに置く（--out だけ指定）
//   --prompt  変換はせず、拡張に貼る「注文をまとめてダウンロード」の指示文を出す（--state だけ指定。出荷アプリのボタンと同じ文）
//   --dry-run 何も書きかえない（数だけ出す）
//
// 画面に出すのは件数と注文番号だけ。お客様の名前・住所・電話は出さない。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = { in: [], hours: 24, ship: path.resolve(HERE, "../../ship.html") };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--in") { while (args[i + 1] && !args[i + 1].startsWith("--")) opt.in.push(args[++i]); }
  else if (a === "--state") opt.state = args[++i];
  else if (a === "--out") opt.out = args[++i];
  else if (a === "--ship") opt.ship = args[++i];
  else if (a === "--hours") opt.hours = Number(args[++i]);
  else if (a === "--date") opt.date = args[++i];
  else if (a === "--ledger") opt.ledger = args[++i];
  else if (a === "--today") opt.today = true;
  else if (a === "--dry-run") opt.dry = true;
  else if (a === "--clip") opt.clip = true;
  else if (a === "--reclip") opt.reclip = true;
  else if (a === "--prompt") opt.prompt = true;
  else { console.error("分からない指定：" + a); process.exit(2); }
}
const fail = (msg) => { console.log(JSON.stringify({ ok: false, error: msg }, null, 1)); process.exit(1); };

if (opt.reclip) { // いちばん新しい .clip.ps1 を動かし直す
  if (!opt.out || !fs.existsSync(opt.out)) fail("--out のフォルダが見つかりません");
  const ps = fs.readdirSync(opt.out).filter((n) => n.endsWith(".clip.ps1")).sort().pop();
  if (!ps) fail("貼り付け用のデータがまだありません");
  if (process.platform !== "win32") fail("Windows ではないので、クリップボードには置けません");
  const { execFileSync } = await import("node:child_process");
  try { execFileSync("powershell.exe", ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-File", path.join(opt.out, ps)], { stdio: "pipe" }); }
  catch (e) { fail("クリップボードに置けませんでした：" + String(e.message).slice(0, 200)); }
  console.log(JSON.stringify({ ok: true, reclip: ps }, null, 1)); process.exit(0);
}
if (!opt.prompt && (!opt.in.length || !opt.out)) { console.error("--in と --out は必ず指定してください"); process.exit(2); }

// ---- 読むファイルを集める ----
function collect() {
  const files = [];
  const cut = Date.now() - opt.hours * 3600 * 1000;
  for (const p of opt.in) {
    if (!fs.existsSync(p)) fail("見つかりません：" + p);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      for (const n of fs.readdirSync(p)) {
        const f = path.join(p, n);
        const s = fs.statSync(f);
        if (!s.isFile() || s.mtimeMs < cut) continue;
        if (!/\.(csv|txt|tsv)$/i.test(n)) continue;
        if (s.size > 20 * 1024 * 1024) continue;
        files.push({ f, m: s.mtimeMs });
      }
    } else files.push({ f: p, m: st.mtimeMs });
  }
  return files.sort((a, b) => a.m - b.m).map((x) => x.f);
}

// ---- 出荷アプリを読み込む ----
const state = opt.state && fs.existsSync(opt.state) && fs.readFileSync(opt.state, "utf8").trim() ? JSON.parse(fs.readFileSync(opt.state, "utf8").replace(/^\ufeff/, "")) : {};
const html = fs.readFileSync(opt.ship, "utf8");
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  url: "https://takmat21.github.io/yamato-b2-/ship.html",
  pretendToBeVisual: true,
  beforeParse(w) {
    for (const k of Object.keys(state)) w.localStorage.setItem(k, String(state[k]));
    w.TextDecoder = TextDecoder; w.TextEncoder = TextEncoder;
    w.Element.prototype.scrollIntoView = function () {};
    w.confirm = () => false; w.alert = () => {};
    w.scrollTo = () => {}; w.open = () => null;
    w.document.execCommand = () => true;
  },
});
const w = dom.window;
const ev = (code) => w.eval(code);
if (typeof ev("typeof doConvert") !== "string" || ev("typeof doConvert") !== "function") fail("ship.html を読み込めませんでした");

if (opt.prompt) { // 出荷アプリの「注文をまとめてダウンロード」と同じ指示文
  const b = w.document.querySelector("#openBtns button");
  if (!b) fail("出荷アプリで、ダウンロードする店が1つも選ばれていません");
  b.click();
  console.log(ev(`$("lastPrompt").value`)); w.close(); process.exit(0);
}

// ---- ファイルを入れる（出荷アプリの読み取りと同じ関数を使う）----
const used = [], skippedFiles = [];
for (const f of collect()) {
  const buf = fs.readFileSync(f);
  w.__u8 = new w.Uint8Array(buf);
  w.__name = path.basename(f);
  const r = ev(`(function(){
    const text=decodeFile(__u8.buffer);const ch=detectChannel(text);let orders=[];const ab=$("optAbbr").checked;
    if(ch==="AMAZON")orders=parseAmazon(text,ab);else if(ch==="YAHOO")orders=parseYahoo(text,ab);else if(ch==="BASE")orders=parseBase(text,ab);
    if(ch==="UNKNOWN"||!orders.length)return JSON.stringify({ch,n:0});
    loaded.push({name:__name,channel:ch,text,orders});return JSON.stringify({ch,n:orders.length});
  })()`);
  const o = JSON.parse(r);
  (o.n ? used : skippedFiles).push({ file: path.basename(f), channel: o.ch, lines: o.n });
}
if (!used.length) fail("注文ファイルが見つかりません（新しい Amazon・Yahoo!・BASE のファイルが無い）");

// 同じ店のファイルが2つ以上あると、同じ注文が重なる。新しいほうだけ使う
const lastByCh = {};
used.forEach((u, i) => { lastByCh[u.channel] = i; });
const dropIdx = used.map((u, i) => (lastByCh[u.channel] === i ? -1 : i)).filter((i) => i >= 0);
if (dropIdx.length) {
  ev(`(function(keep){for(let i=loaded.length-1;i>=0;i--)if(!keep.includes(i))loaded.splice(i,1);})(${JSON.stringify(used.map((u, i) => i).filter((i) => !dropIdx.includes(i)))})`);
}
const usedFinal = used.filter((u, i) => !dropIdx.includes(i));
const olderDropped = used.filter((u, i) => dropIdx.includes(i));

// ---- 変換 ----
if (opt.today) { ev(`$("optToday").checked=true;`); if (opt.date) ev(`$("baseDate").value=${JSON.stringify(opt.date)};`); }
ev("doConvert()");
if (!ev(`$("runMsg").classList.contains("hide")`)) fail("変換できません：" + ev(`$("runMsg").textContent`));

const rows = JSON.parse(ev("JSON.stringify(rows)"));
const metaOids = JSON.parse(ev("JSON.stringify(metaOids)"));
const metaChan = JSON.parse(ev("JSON.stringify(metaChan)"));
const hist = JSON.parse(ev("JSON.stringify(loadHistory())"));
const keep = rows.map((r, i) => i).filter((i) => !(metaOids[i] || []).some((o) => hist[o]));
const newRows = keep.map((i) => rows[i]);
const newOids = []; keep.forEach((i) => (metaOids[i] || []).forEach((o) => { if (o && !newOids.includes(o)) newOids.push(o); }));
const byCh = {}; keep.forEach((i) => { byCh[metaChan[i]] = (byCh[metaChan[i]] || 0) + 1; });

const stamp = (() => { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; })();
const result = {
  ok: true, dryRun: !!opt.dry,
  files: usedFinal, olderFilesNotUsed: olderDropped, filesNotOrders: skippedFiles.length,
  labels: rows.length, alreadyDone: rows.length - keep.length, newLabels: keep.length, newByStore: byCh,
  newOrderIds: newOids,
};

if (!opt.dry && keep.length) {
  fs.mkdirSync(opt.out, { recursive: true });
  const cell = (c) => String(c == null ? "" : c).replace(/[\r\n\t]+/g, " ");
  const tsv = newRows.map((r) => r.map(cell).join("\t")).join("\r\n") + "\r\n";
  const tsvPath = path.join(opt.out, `b2_new_${stamp}.tsv`);
  fs.writeFileSync(tsvPath, "﻿" + tsv, "utf8");
  // B2クラウド取り込み用（Shift_JIS の CSV。出荷アプリの「CSVをダウンロード」と同じ作り）
  w.__rows = newRows;
  const sj = ev(`(function(){const csv=__rows.map(r=>r.map(csvCell).join(",")).join("\\r\\n");return JSON.stringify(Encoding.convert(Encoding.stringToCode(csv),{to:"SJIS",from:"UNICODE"}));})()`);
  const csvPath = path.join(opt.out, `yamato_b2_${stamp}.csv`);
  fs.writeFileSync(csvPath, Buffer.from(JSON.parse(sj)));
  result.tsv = tsvPath; result.csv = csvPath;

  if (opt.ledger) result.ledger = await appendLedger(opt.ledger, newRows);
  if (opt.clip) result.clipboard = await toClipboard(newRows, tsv, path.join(opt.out, `b2_new_${stamp}`));

  // 処理済みに記録して、state を書きもどす
  w.__oids = newOids;
  ev("addToHistory(__oids)");
  if (opt.state) {
    const out = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); out[k] = w.localStorage.getItem(k); }
    if (fs.existsSync(opt.state)) fs.copyFileSync(opt.state, opt.state + ".bak");
    fs.writeFileSync(opt.state, JSON.stringify(out, null, 1), "utf8");
  }
}
console.log(JSON.stringify(result, null, 1));
w.close();

// ---- エクセルに貼れる形でクリップボードに置く（出荷アプリの copyToClipboard と同じ HTML 表）----
// コードは文字列の書式（先頭の0を残す）、E・F 列は日付の書式にする。
function clipHtml(rws) {
  const esc = (s) => String(s).replace(/[\r\n]+/g, " ").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const head = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">'
    + '<head><meta charset="utf-8">'
    + '<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>'
    + '<x:Name>B2</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>'
    + '</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->'
    + '</head><body>';
  const DATE = new Set([4, 5]);
  let h = head + "<!--StartFragment--><table>";
  rws.forEach((r) => { h += "<tr>" + r.map((c, ci) => `<td style="mso-number-format:'${DATE.has(ci) ? "yyyy\\/m\\/d" : "\\@"}';white-space:nowrap;border:none">${esc(c == null ? "" : c) || "&nbsp;"}</td>`).join("") + "</tr>"; });
  return h + "</table><!--EndFragment--></body></html>";
}
async function toClipboard(rws, tsv, base) {
  const html = clipHtml(rws);
  // Windows の「HTML Format」は、先頭に位置（UTF-8 のバイト数）を書いた見出しが要る
  const pad = (n) => String(n).padStart(10, "0");
  const hdr = (a, b, c, d) => `Version:0.9\r\nStartHTML:${pad(a)}\r\nEndHTML:${pad(b)}\r\nStartFragment:${pad(c)}\r\nEndFragment:${pad(d)}\r\n`;
  const hl = Buffer.byteLength(hdr(0, 0, 0, 0));
  const body = Buffer.from(html, "utf8");
  const sf = hl + Buffer.byteLength(html.slice(0, html.indexOf("<!--StartFragment-->") + 20));
  const ef = hl + Buffer.byteLength(html.slice(0, html.indexOf("<!--EndFragment-->")));
  const cf = Buffer.concat([Buffer.from(hdr(hl, hl + body.length, sf, ef), "ascii"), body]);
  const cfPath = base + ".cfhtml", txtPath = base + ".cliptext.txt", ps1 = base + ".clip.ps1";
  fs.writeFileSync(cfPath, cf);
  fs.writeFileSync(txtPath, tsv, "utf8");
  if (process.platform !== "win32") return { done: false, note: "Windows ではないので、クリップボードには置いていない", file: cfPath };
  fs.writeFileSync(ps1, [
    "Add-Type -AssemblyName System.Windows.Forms",
    `$b=[System.IO.File]::ReadAllBytes('${cfPath.replace(/'/g, "''")}')`,
    "$ms=New-Object System.IO.MemoryStream(,$b)",
    `$t=[System.IO.File]::ReadAllText('${txtPath.replace(/'/g, "''")}',[System.Text.Encoding]::UTF8)`,
    "$d=New-Object System.Windows.Forms.DataObject",
    "$d.SetData('HTML Format',$ms)",
    "$d.SetData([System.Windows.Forms.DataFormats]::UnicodeText,$t)",
    "[System.Windows.Forms.Clipboard]::SetDataObject($d,$true)",
  ].join("\r\n"), "utf8");
  const { execFileSync } = await import("node:child_process");
  try { execFileSync("powershell.exe", ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-File", ps1], { stdio: "pipe" }); return { done: true, rows: rws.length }; }
  catch (e) { return { done: false, note: "クリップボードに置けませんでした：" + String(e.message).slice(0, 200), file: cfPath }; }
}

// ---- 台帳（xlsx）の最後の行の下に書き足す ----
async function appendLedger(file, rws) {
  if (!fs.existsSync(file)) fail("台帳が見つかりません：" + file);
  if (!/\.xlsx$/i.test(file)) fail("台帳に直接書けるのは .xlsx だけです（.xls は、エクセルで「名前を付けて保存」で .xlsx にしてから）。それまでは --clip で貼り付けてください");
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.readFile(file); } catch (e) { fail("台帳を開けません（エクセルで開いたままなら、閉じてからやり直してください）：" + e.message); }
  const ws = wb.worksheets[0];
  let last = 0;
  ws.eachRow({ includeEmpty: false }, (row, n) => { if (row.values.some((v) => v != null && String(v).trim() !== "")) last = n; });
  const bak = file.replace(/\.xlsx$/i, "") + `_控え_${stamp}.xlsx`;
  fs.copyFileSync(file, bak);
  const DATE_COLS = new Set([5, 6]); // E=出荷予定日, F=お届け予定日（出荷アプリの貼り付けと同じ扱い）
  rws.forEach((r, i) => {
    const row = ws.getRow(last + 1 + i);
    r.forEach((c, ci) => {
      const cellRef = row.getCell(ci + 1);
      const s = String(c == null ? "" : c);
      const m = DATE_COLS.has(ci + 1) && s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
      if (m) { cellRef.value = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); cellRef.numFmt = "yyyy/m/d"; }
      else if (s !== "") { cellRef.value = s; cellRef.numFmt = "@"; }
    });
    row.commit();
  });
  try { await wb.xlsx.writeFile(file); } catch (e) { fail("台帳に書けません（エクセルで開いたままなら、閉じてからやり直してください）：" + e.message); }
  return { file, backup: bak, firstRow: last + 1, rows: rws.length };
}
