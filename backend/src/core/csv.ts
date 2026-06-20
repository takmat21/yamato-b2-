// 95列の行配列 → CSV文字列／Shift-JISバッファ
import iconv from "iconv-lite";
import { B2_HEADERS } from "./b2layout";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function buildCSV(rows: string[][], header = false): string {
  const lines: string[] = [];
  if (header) lines.push(B2_HEADERS.map(csvCell).join(","));
  rows.forEach((r) => lines.push(r.map(csvCell).join(",")));
  return lines.join("\r\n");
}

/** B2クラウドが取り込めるShift-JISのCSVバイト列 */
export function buildCSVShiftJIS(rows: string[][], header = false): Buffer {
  return iconv.encode(buildCSV(rows, header), "Shift_JIS");
}
