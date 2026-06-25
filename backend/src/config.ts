// 設定・秘密情報の読み込み。
// 本番では AWS Secrets Manager / SSM Parameter Store から取得することを推奨。
// 認証情報は絶対にリポジトリへコミットしないこと。

import { SenderConfig, SENDER_DEFAULTS } from "./core/types";

export interface AmazonCreds {
  lwaClientId: string;
  lwaClientSecret: string;
  refreshToken: string;
  marketplaceId: string; // 日本: A1VC38T7YXB528
  endpoint: string; // 例: https://sellingpartnerapi-fe.amazon.com
}

export interface YahooCreds {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  sellerId: string;
}

export interface BaseCreds {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface YamatoB2Creds {
  // 契約後にヤマトから提供される接続情報を設定する
  apiBase: string;
  customerCode: string;
  apiKey: string;
}

export interface AppConfig {
  sender: SenderConfig;
  amazon?: AmazonCreds;
  yahoo?: YahooCreds;
  base?: BaseCreds;
  yamato?: YamatoB2Creds;
  dryRun: boolean; // true: 実際の伝票発行・出荷通知を行わずログのみ
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length ? v : undefined;
}

export function loadConfig(): AppConfig {
  const sender: SenderConfig = {
    name: env("SENDER_NAME") || SENDER_DEFAULTS.name,
    tel: env("SENDER_TEL") || SENDER_DEFAULTS.tel,
    zip: env("SENDER_ZIP") || SENDER_DEFAULTS.zip,
    addr: env("SENDER_ADDR") || SENDER_DEFAULTS.addr,
    bill: env("SENDER_BILL") || SENDER_DEFAULTS.bill,
    cls: env("SENDER_CLASS") || SENDER_DEFAULTS.cls,
    freight: env("SENDER_FREIGHT") || SENDER_DEFAULTS.freight,
  };

  const amazon: AmazonCreds | undefined = env("SPAPI_REFRESH_TOKEN")
    ? {
        lwaClientId: env("LWA_CLIENT_ID")!,
        lwaClientSecret: env("LWA_CLIENT_SECRET")!,
        refreshToken: env("SPAPI_REFRESH_TOKEN")!,
        marketplaceId: env("SPAPI_MARKETPLACE_ID") || "A1VC38T7YXB528",
        endpoint: env("SPAPI_ENDPOINT") || "https://sellingpartnerapi-fe.amazon.com",
      }
    : undefined;

  const yamato: YamatoB2Creds | undefined = env("YAMATO_API_KEY")
    ? {
        apiBase: env("YAMATO_API_BASE")!,
        customerCode: env("YAMATO_CUSTOMER_CODE")!,
        apiKey: env("YAMATO_API_KEY")!,
      }
    : undefined;

  return {
    sender,
    amazon,
    yamato,
    dryRun: (env("DRY_RUN") || "true").toLowerCase() !== "false",
  };
}
