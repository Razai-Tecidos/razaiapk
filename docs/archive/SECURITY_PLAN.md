# Security & Access Control Plan

## Current Status
- **Authentication**: None. The app is currently open.
- **Database Access (RLS)**: All tables (`tissues`, `colors`, `stock_items`, etc.) have "Public Access" policies enabled for both READ and WRITE.
- **API Keys**: The `SUPABASE_ANON_KEY` is exposed in the frontend (standard for Supabase), but without RLS restrictions, anyone with this key can modify the database.

## Risks
1.  **Data Integrity**: Any user (or malicious actor) can delete or modify tissues, colors, and stock.
2.  **Unauthorized Access**: Competitors or unauthorized staff can view sensitive data (stock levels, suppliers if added).
3.  **Audit Trail**: `stock_movements` tracks `user_id`, but currently it is passed as `null` or `undefined` since there is no logged-in user.

## Proposed Solution

### 1. Implement Authentication
- Enable **Supabase Auth** (Email/Password or Magic Link).
- Create a **Login Page** (`/login`).
- Protect internal routes (`/`, `/tecidos`, `/cores`, `/estoque`) with a `RequireAuth` wrapper.
- Keep `/vitrine` public (optional) or protect it as well.

### 2. Role-Based Access Control (RBAC)
Define roles in a `profiles` table:
- **Admin**: Full access.
- **Manager**: Can create tissues/colors, view stock.
- **Cutter**: Can only view stock and report shortages (Write to `stock_movements` / Update `stock_items`).
- **Viewer**: Read-only access to Vitrine.

### 3. Update RLS Policies
Replace "Public Access" policies with:
- **READ**: Public for `vitrine` related tables (if public catalog is desired), or Authenticated only.
- **WRITE**: Only Authenticated users (or specific roles).

### 4. App Distribution
- **Web App**: Hosted on Vercel. Protected by Login.
- **Tauri App (Desktop)**: Can be distributed to internal computers. Still requires Login.
- **Mobile**: Can be accessed via browser or wrapped as PWA.

## Immediate Next Steps
1.  Create `Login.tsx` page.
2.  Set up Auth Context provider.
3.  Update `App.tsx` to route to Login if not authenticated.
4.  (Backend) Update RLS policies to `TO authenticated USING (true)`.
