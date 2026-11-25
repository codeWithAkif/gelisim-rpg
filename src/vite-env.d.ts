/// <reference types="vite/client" />
interface ImportMetaEnv { readonly VITE_APP_VERSION?: string; readonly VITE_NATIVE_VERSION?: string }
interface ImportMeta { readonly env: ImportMetaEnv }
