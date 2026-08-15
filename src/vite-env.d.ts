/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the OMS Core admin API. Defaults to http://localhost:8080 if unset. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
