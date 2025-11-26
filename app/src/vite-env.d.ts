/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SUPABASE_UPLOAD_TOKEN?: string
  readonly VITE_SUPABASE_BUCKET?: string
  readonly VITE_SUPABASE_AUTO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
