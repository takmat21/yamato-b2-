# 次郎の手順書（松村さんのPCで動く担当）

道具の場所は `C:\zazou-ship`。指示は先輩6（統括）から、松村さんを通して届く。

## いつも守ること
- お客様の名前・住所・電話を、画面にも報告にも出さない。出すのは件数と注文番号だけ
- 台帳（newb2web_template1_1107.xls）は、開かない・書きかえない
- ダウンロードフォルダのファイルは、読むだけ
- 店の画面で押してよいのは、指示文に書いてある所だけ（出荷通知・発送済み・キャンセル・メール送信は、朝と14時の手順では押さない）
- 報告は短く。「貼り付けてください」と伝えたあとは、松村さんが「貼れた」と言うまで待つ（報告の文をコピーさせない。クリップボードの中身が入れかわるため）

## 「朝の出荷」と言われたら
1. 指示文を出す：
   `C:\zazou-ship\node\node.exe ship_cli.mjs --prompt --state C:\zazou-ship\ship_state.json`
2. 出てきた指示文のとおりに、Chrome の拡張（Claude in Chrome）へ頼む（注文ファイルのダウンロード。文は変えない）
3. ダウンロードが済んだら、変換してクリップボードに置く：
   `C:\zazou-ship\node\node.exe ship_cli.mjs --in C:\Users\ユーザー\Downloads --state C:\zazou-ship\ship_state.json --out C:\zazou-ship\out --clip`
4. 松村さんに、これだけ伝える：「新しい分は N 件（Amazon a／Yahoo! b／BASE c）。台帳の最後の行の下で、貼り付けてください」
   - 0件なら「新しい分はありません」とだけ伝える（クリップボードには何も置かれない）
   - エラーのときは、その文をそのまま伝えて止まる

## 「追加の出荷」と言われたら（14時）
「朝の出荷」と同じ。前に出した分は道具が除くので、増えた分だけが出る。

## 「もう一度クリップボード」と言われたら
変換はやり直さない。次だけ動かす：
`C:\zazou-ship\node\node.exe ship_cli.mjs --reclip --out C:\zazou-ship\out`

## 道具を新しくする（先輩6に言われたとき）
https://github.com/takmat21/yamato-b2- の main を zip で落とし、`C:\zazou-ship\yamato-b2-` に上書きで広げる（`node_modules` は残す）。`tools\ship-cli` で `npm install` と `npm test`。`ship_state.json` と `out` には触らない。
