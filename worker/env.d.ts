// Worker secrets：线上由 `wrangler secret put` 配置，本地 dev 由 .dev.vars 提供。
// wrangler types 不会生成 secret 字段，这里并入 Env（与 worker-configuration.d.ts 的同名全局接口声明合并）。
interface Env {
  AUTH_PASSWORD: string
  AUTH_SECRET: string
  TURNSTILE_SECRET: string
}
