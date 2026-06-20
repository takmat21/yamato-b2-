// ローカル実行用エントリ（dryRunで動作確認）。
//   npm run local
// 認証情報が無くてもチャネルはスキップされ、サマリだけ出力されます。

import { run } from "./handlers/fulfillment";

run()
  .then((s) => {
    console.log(JSON.stringify(s, null, 2));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
