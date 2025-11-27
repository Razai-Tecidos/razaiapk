# Razai Tools & Mobile - AI Coding Instructions

## Project Overview
This workspace contains a hybrid application suite for **Razai Tecidos**:
1.  **Razai Tools (Desktop/Web):** A React + Vite + Tauri v2 application for inventory and color management (admin).
2.  **RazaiToolsMobile (Mobile):** A React Native (Expo) mobile application for collaborators (stock management).

## Architecture & Core Concepts

### Razai Tools (Desktop/Web)
-   **Frontend:** React, TypeScript, Vite, Mantine UI.
-   **Desktop Engine:** Tauri v2 (Rust).
-   **Authentication:** Supabase Auth with role-based access (admin/collaborator).
-   **Database:** Hybrid approach.
    -   **Local:** IndexedDB (`idb`) for offline-first capability and performance.
    -   **Cloud:** Supabase (PostgreSQL) for synchronization and backup.
-   **Key Directories:**
    -   `app/src/lib/`: **Core business logic.** Keep logic out of components.
        -   `platform/`: **CRITICAL.** Abstraction layer for Web vs. Desktop (Tauri) differences. Always use this for file system, dialogs, or shell interactions.
        -   `recolor/` & `color/`: Complex image processing and color science logic.
        -   `workers/`: Web Workers for heavy computations (image processing).
        -   `db/`: Database abstraction (IndexedDB/Supabase sync).
        -   `supabase.ts`: Supabase client configuration.
        -   `stock-api.ts`: Stock movements API (IN/OUT/ADJUST).
    -   `app/src/design-system/`: Centralized UI tokens and component overrides.
    -   `app/src/pages/`: Page components.
        -   `Login.tsx`: Supports **username** or email login.
        -   `MobileStock.tsx`: Mobile-friendly stock page for `/mobile` route.
    -   `app/src/components/ProtectedRoute.tsx`: Role-based route protection.

### RazaiToolsMobile
-   **Framework:** React Native with Expo.
-   **Navigation:** React Navigation (`@react-navigation/native`).
-   **State:** Context API (`context/AuthContext.tsx`).
-   **Authentication:** Supabase Auth with username support.
-   **Key Features:**
    -   `screens/HomeScreen.tsx`: Main screen with "Modo Cortador" (Cutter Mode) for stock alerts.
    -   `screens/LoginScreen.tsx`: Login with **username** (not email).
    -   `context/AuthContext.tsx`: Auth provider with username-to-email lookup.

## Authentication System

### User Roles
-   **admin**: Full access to Razai Tools (web/desktop).
-   **collaborator**: Access to `/mobile` route (web) or RazaiToolsMobile app.

### Login Flow
1.  User enters **username** (e.g., `piaui`) or email.
2.  If username (no `@`), lookup in `profiles` table → convert to `username@razai.local`.
3.  Authenticate with Supabase Auth.
4.  Fetch role from `profiles` table for route protection.

### Supabase Tables
-   `auth.users`: Supabase managed users.
-   `profiles`: Custom table with `id` (FK to auth.users), `username`, `display_name`, `role`.

### Creating a New Collaborator
```sql
-- 1. Create user in Supabase Dashboard (Authentication > Users > Add user)
--    Email: username@razai.local, Password: xxxx, Auto Confirm: ✓

-- 2. Add profile
INSERT INTO profiles (id, username, display_name, role)
SELECT id, 'username', 'Display Name', 'collaborator'
FROM auth.users WHERE email = 'username@razai.local';
```

## Development Workflows

### Razai Tools (Root `package.json`)
-   **Web Dev:** `npm run dev` (Runs Vite at http://localhost:5173).
-   **Desktop Dev:** `npm run dev:tauri` (Runs Tauri + Vite).
-   **Build Web:** `npm run build`.
-   **Build Desktop:** `npm run build:tauri`.
-   **Test:** `npm run test` (Vitest).
-   **Typecheck:** `npm run typecheck`.

### Mobile (in `RazaiToolsMobile/` directory)
-   **Dev/Test:** `npx expo start` (scan QR with Expo Go app).
-   **Build APK:** `eas build --platform android --profile preview`.
-   **Build Production:** `eas build --platform android --profile production`.

## Coding Conventions

1.  **Platform Agnosticism:**
    -   When writing code in `app/`, **NEVER** import `@tauri-apps/*` directly in UI components.
    -   Use `app/src/lib/platform` abstractions to ensure the app works in both Web and Desktop modes.

2.  **Authentication:**
    -   Use `supabase.auth.signInWithPassword()` directly (not context).
    -   For logout: `await supabase.auth.signOut(); window.location.href = '/login';`
    -   Fetch user role from `profiles` table, not `user_metadata`.

3.  **State Management:**
    -   Prefer React Context for UI state.
    -   Use `lib/db` for persistent data.
    -   Handle data synchronization via `lib/cloud-sync.ts`.

4.  **Styling:**
    -   Use **Mantine** components and hooks (`@mantine/core`, `@mantine/hooks`).
    -   Follow tokens in `app/src/design-system/tokens.ts`.

5.  **Testing:**
    -   Write unit tests for logic in `lib/` using Vitest.
    -   Mock platform dependencies when testing `lib/` functions.

## Critical Files
-   `app/src/main.tsx`: Router configuration with role-based routes.
-   `app/src/components/ProtectedRoute.tsx`: Auth guard with role checking.
-   `app/src/lib/platform/index.ts`: The gateway for platform-specific operations.
-   `app/src/lib/supabase.ts`: Supabase client configuration.
-   `src-tauri/tauri.conf.json`: Tauri configuration (permissions, windows, bundle).
-   `app/vite.config.ts`: Vite build configuration.
-   `RazaiToolsMobile/context/AuthContext.tsx`: Mobile auth with username support.
-   `RazaiToolsMobile/eas.json`: EAS Build configuration.

## Routes (Web)
| Route | Allowed Roles | Component |
|-------|---------------|-----------|
| `/login` | public | Login.tsx |
| `/` | admin | Home.tsx (dashboard) |
| `/mobile` | collaborator, admin | MobileStock.tsx |
| `/vitrine/*` | public | Showcase pages |
| `/tecidos`, `/cores`, etc. | admin | Admin pages |

## Common Tasks
-   **Adding a new dependency:** Run `npm install` in `app/` for frontend libs, or `src-tauri/` for Rust crates.
-   **Database Migration:** SQL files are in `supabase/migrations/` or root `*.sql` files.
-   **New Collaborator:** Create user in Supabase Dashboard + add profile (see Authentication section).
