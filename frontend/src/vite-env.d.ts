/// <reference types="vite/client" />

declare interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_SENTINEL_API_KEY?: string
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv
}
