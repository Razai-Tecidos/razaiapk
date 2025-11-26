# Platform Compatibility Audit

_Planned mobile support: Android APK (future)._ This document tracks every feature that relies on desktop-only APIs so we can
plan portable abstractions early.

## Detection Helpers
- `window.__TAURI__` checks sprinkled throughout the app (e.g. `main.tsx`, `lib/db/index.ts`, `lib/pdf/catalog-pdf.ts`, `pages/Exportacoes.tsx`).
  - **Action**: replace ad-hoc checks with a centralized `getRuntime()` helper that can distinguish `web`, `tauri-desktop`, and future `tauri-mobile` / `capacitor` targets.

## Filesystem & Dialog Access
- `lib/export.ts`: dynamic import of `@tauri-apps/plugin-fs` and `@tauri-apps/api/path` to write CSV/JSON exports.
- `lib/db/index.ts`: uses `@tauri-apps/api/fs` + `@tauri-apps/api/path` for backup attachments, preview caching.
- `lib/pdf/catalog-pdf.ts`: saves generated PDFs via Tauri dialog + fs plugins.
- `pages/Exportacoes.tsx`: downloads backups through dialog/fs plugins when available.
- `components/FabricColorPreview.tsx`: optional export of neutralized previews through dialog/fs plugins.
- `pages/Catalog.tsx`: debug helper `OpenFolderButton` imports `@tauri-apps/plugin-opener` to launch directories.

**Mobile impact**: Need alternate implementations based on Capacitor or Web Share API. For pure web/PWA/APK we should
fall back to in-memory Blob download or share sheet.

## Window / Shell APIs
- `main.tsx`: imports `@tauri-apps/api/window` and `@tauri-apps/plugin-opener`, `@tauri-apps/api/shell` to configure drag regions and external links.
  - **Mobile impact**: these modules are desktop-only; on mobile we must noop or replace with Capacitor equivalents.

## Database Layers
- `lib/db/sqlite.ts`: uses `@tauri-apps/plugin-sql` for the SQLite-backed desktop database.
  - Web fallback already handled via IndexedDB (see `lib/db/index.ts`). Need to confirm the abstraction can plug into
    Capacitator/SQLite plugin or fallback to IndexedDB for mobile as well.

## Summary of Required Abstractions
1. **Runtime detection** helper (web, tauri-desktop, tauri-mobile, capacitor, node tests).
2. **Filesystem service** that picks the correct adapter (web downloads, Tauri fs, Capacitor Filesystem, etc.).
3. **Dialog service** (file pickers, save dialogs, folder openers) with mobile-friendly fallbacks (share sheet, manual copy).
4. **Shell/open external links** adapter with safe fallbacks using `window.open`.
5. **Database driver** strategy selection (`IndexedDB`, `SQLite` plugin, restful sync) behind a single interface.

Next steps: introduce a `platform` layer in `app/src/lib/platform/` that exposes typed adapters, then gradually migrate consumers.
