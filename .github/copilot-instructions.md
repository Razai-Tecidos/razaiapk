# Razai Tools & Mobile - AI Coding Instructions

## Project Overview
This workspace contains a hybrid application suite for **Razai Tecidos**:
1.  **Razai Tools (Desktop/Web):** A React + Vite + Tauri v2 application for inventory and color management.
2.  **RazaiToolsMobile (Mobile):** A React Native (Expo) mobile application.

## Architecture & Core Concepts

### Razai Tools (Desktop/Web)
-   **Frontend:** React, TypeScript, Vite, Mantine UI.
-   **Desktop Engine:** Tauri v2 (Rust).
-   **Database:** Hybrid approach.
    -   **Local:** IndexedDB (`idb`) for offline-first capability and performance.
    -   **Cloud:** Supabase (PostgreSQL) for synchronization and backup.
-   **Key Directories:**
    -   `app/src/lib/`: **Core business logic.** Keep logic out of components.
        -   `platform/`: **CRITICAL.** Abstraction layer for Web vs. Desktop (Tauri) differences. Always use this for file system, dialogs, or shell interactions.
        -   `recolor/` & `color/`: Complex image processing and color science logic.
        -   `workers/`: Web Workers for heavy computations (image processing).
        -   `db/`: Database abstraction (IndexedDB/Supabase sync).
    -   `app/src/design-system/`: Centralized UI tokens and component overrides.

### RazaiToolsMobile
-   **Framework:** React Native with Expo.
-   **Navigation:** React Navigation (likely, check `App.tsx`).
-   **State:** Context API (`context/`).

## Development Workflows

### Razai Tools (Root `package.json`)
-   **Web Dev:** `npm run dev` (Runs Vite).
-   **Desktop Dev:** `npm run dev:tauri` (Runs Tauri + Vite).
-   **Build Web:** `npm run build`.
-   **Build Desktop:** `npm run build:tauri`.
-   **Test:** `npm run test` (Vitest).
-   **Typecheck:** `npm run typecheck`.

### Mobile
-   **Run:** `npx expo start` (in `RazaiToolsMobile` directory).
-   **Build:** `eas build` (via Expo Application Services).

## Coding Conventions

1.  **Platform Agnosticism:**
    -   When writing code in `app/`, **NEVER** import `@tauri-apps/*` directly in UI components.
    -   Use `app/src/lib/platform` abstractions to ensure the app works in both Web and Desktop modes.

2.  **State Management:**
    -   Prefer React Context for UI state.
    -   Use `lib/db` for persistent data.
    -   Handle data synchronization via `lib/cloud-sync.ts`.

3.  **Styling:**
    -   Use **Mantine** components and hooks (`@mantine/core`, `@mantine/hooks`).
    -   Follow tokens in `app/src/design-system/tokens.ts`.

4.  **Testing:**
    -   Write unit tests for logic in `lib/` using Vitest.
    -   Mock platform dependencies when testing `lib/` functions.

## Critical Files
-   `app/src/lib/platform/index.ts`: The gateway for platform-specific operations.
-   `app/src/lib/supabase.ts`: Supabase client configuration.
-   `src-tauri/tauri.conf.json`: Tauri configuration (permissions, windows, bundle).
-   `app/vite.config.ts`: Vite build configuration.

## Common Tasks
-   **Adding a new dependency:** Run `npm install` in `app/` for frontend libs, or `src-tauri/` for Rust crates.
-   **Database Migration:** SQL files are in `supabase/migrations/` or root `*.sql` files.
