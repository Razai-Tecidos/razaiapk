# Razai Tools & Mobile - AI Coding Instructions

## Project Overview
This workspace contains a hybrid application suite for **Razai Tecidos**:
1.  **Razai Tools (Desktop/Web):** A React + Vite + Tauri v2 application for inventory, color management, and catalog generation (admin).
2.  **RazaiToolsMobile (Mobile):** A React Native (Expo) mobile application for collaborators (stock management).

## Architecture & Core Concepts

### Razai Tools (Desktop/Web)
-   **Frontend:** React, TypeScript, Vite, Mantine UI.
-   **Desktop Engine:** Tauri v2 (Rust) with SQLite plugin.
-   **Authentication:** Supabase Auth with role-based access (admin/collaborator).
-   **Database:** Hybrid approach.
    -   **Local (Web):** IndexedDB (`idb`) for offline-first capability.
    -   **Local (Desktop):** SQLite (`@tauri-apps/plugin-sql`) for performance and file system access.
    -   **Cloud:** Supabase (PostgreSQL) for synchronization and backup.
-   **Key Directories:**
    -   `app/src/lib/`: **Core business logic.** Keep logic out of components.
        -   `platform/`: **CRITICAL.** Abstraction layer for Web vs. Desktop (Tauri) differences. Always use this for file system, dialogs, or shell interactions.
        -   `db/`: Database abstraction. Switches between `idb` and `sqlite` based on environment.
        -   `cloud-sync.ts`: Logic for syncing local DB with Supabase Storage/DB.
        -   `recolor/` & `color/`: Complex image processing and color science logic.
        -   `workers/`: Web Workers for heavy computations (image processing, backups).
    -   `app/src/design-system/`: Centralized UI tokens and component overrides (Mantine).
    -   `app/src/pages/`: Page components.
    -   `src-tauri/`: Rust backend configuration and plugins.

### RazaiToolsMobile
-   **Framework:** React Native with Expo.
-   **Navigation:** React Navigation (Native Stack + Bottom Tabs).
-   **State:** React Context (`AuthContext`) + TanStack Query (React Query) with Async Storage persistence.
-   **Authentication:** Supabase Auth with username support.
-   **Key Features:**
    -   `screens/HomeScreen.tsx`: Main screen with "Modo Cortador" (Cutter Mode).
    -   `screens/StockOutFlowScreen.tsx`: Stock outflow management.
    -   `context/AuthContext.tsx`: Auth provider with username-to-email lookup logic.
    -   `lib/queryClient.ts`: Configures TanStack Query with `AsyncStorage` persistence.

## Authentication System

### User Roles
-   **admin**: Full access to Razai Tools (web/desktop).
-   **collaborator**: Access to `/mobile` route (web) or RazaiToolsMobile app.

### Login Flow
1.  User enters **username** (e.g., `piaui`) or email.
2.  If username (no `@`), lookup in `profiles` table to verify existence.
3.  Construct email as `username@razai.local`.
4.  Authenticate with Supabase Auth (`signInWithPassword`).
5.  Fetch role from `profiles` table for route protection.

### Supabase Tables
-   `auth.users`: Supabase managed users.
-   `profiles`: Custom table with `id` (FK to auth.users), `username`, `display_name`, `role`.
-   `backups_manifest`: Tracks the latest cloud backup hash and version.

## Development Workflows

### Razai Tools (Root `package.json`)
-   **Web Dev:** `npm run dev` (Runs Vite at http://localhost:5173).
-   **Desktop Dev:** `npm run dev:tauri` (Runs Tauri + Vite).
-   **Build Web:** `npm run build`.
-   **Build Desktop:** `npm run build:tauri`.
-   **Test:** `npm run test` (Vitest).
-   **Typecheck:** `npm run typecheck`.

### Mobile (in `RazaiToolsMobile/` directory)
-   **Dev:** `npx expo start` (scan QR with Expo Go app).
-   **Build APK:** `eas build --platform android --profile preview`.
-   **Build Production:** `eas build --platform android --profile production`.

## Coding Conventions

1.  **Platform Agnosticism (Razai Tools):**
    -   **NEVER** import `@tauri-apps/*` directly in UI components.
    -   Use `app/src/lib/platform` abstractions to ensure the app works in both Web and Desktop modes.
    -   Use `app/src/lib/db` for data access; do not call `idb` or `sqlite` directly in components.

2.  **Authentication:**
    -   Use `supabase.auth.signInWithPassword()` directly (not context) in Web.
    -   Use `AuthContext` in Mobile.
    -   Fetch user role from `profiles` table, not `user_metadata`.

3.  **State Management:**
    -   **Web:** React Context for UI state, `lib/db` for persistent data.
    -   **Mobile:** TanStack Query for data fetching/caching, Context for Auth.

4.  **Styling:**
    -   **Web:** Use **Mantine** components and hooks (`@mantine/core`, `@mantine/hooks`). Follow tokens in `app/src/design-system/tokens.ts`.
    -   **Mobile:** Use standard React Native styles (`StyleSheet.create`) or inline styles for simple cases. Use `Ionicons` for icons.

5.  **Testing:**
    -   Write unit tests for logic in `lib/` using Vitest.
    -   Mock platform dependencies when testing `lib/` functions.

## Critical Files
-   `app/src/main.tsx`: Router configuration with role-based routes.
-   `app/src/lib/platform/index.ts`: The gateway for platform-specific operations.
-   `app/src/lib/db/index.ts`: Database abstraction layer.
-   `app/src/lib/cloud-sync.ts`: Cloud synchronization logic.
-   `RazaiToolsMobile/context/AuthContext.tsx`: Mobile auth logic.
-   `RazaiToolsMobile/app.json`: Expo configuration.

## Cloud Sync & Backups
-   **Strategy:** Hybrid. Local-first with cloud backup/sync via Supabase Storage.
-   **Manifest:** `backups_manifest` table tracks the latest backup.
-   **Format:** Full JSON export (v4) with integrity check.
-   **Auto-Import:** On startup, checks if local DB is empty or if cloud manifest is newer.
