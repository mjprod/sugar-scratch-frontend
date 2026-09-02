/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_STUB_OAUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
