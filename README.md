# CampusCycle

A student marketplace where college communities buy, sell, donate, and borrow items from each other. Built with React, TypeScript, Vite, and Supabase.

## Features

- **Buy / Sell / Donate / Borrow** – Four listing types with type-specific pricing and borrowing terms
- **Request workflow** – Structured request → accept → handover → completion lifecycle with GiST exclusion constraints preventing overlapping borrow periods
- **Archive & restore** – Owners archive completed listings (preserving transaction history) and restore them later
- **Admin moderation** – Reports dashboard, listing moderation, account status management, category management, and transaction overview
- **Row-Level Security** – Every table protected by Supabase RLS policies; workflow RPCs run as `SECURITY DEFINER` with full state validation
- **URL-synced discovery** – Explore page with search, filters, pagination, and shareable URLs
- **Notifications** – In-app notifications for every workflow transition, with actor-aware routing
- **Wishlist & reporting** – Save items and report fraud, harassment, or misleading listings

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Routing | React Router v7 |
| State | TanStack Query v5, Zustand, React Hook Form v7 + Zod |
| Backend | Supabase (Auth, PostgreSQL, Storage, RLS) |
| Icons | Lucide React |
| Toasts | React Hot Toast |

## Prerequisites

- **Node.js 18+** – [Download](https://nodejs.org/)
- **Supabase account** – [Sign up free](https://supabase.com/)
- **Git** (optional) – for version control

## Setup

### 1. Install dependencies

```bash
cd campuscycle
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Create a new project
3. Note your **Project URL** and **anon/publishable key** from Project Settings → API

### 3. Configure environment

Copy `.env.example` to `.env` and fill in your credentials:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...your-anon-key
```

> **Important:** Only the anon/publishable key belongs in frontend code. Never put the service-role key here.

### 4. Run database migrations

Open the **SQL Editor** in your Supabase dashboard and execute each migration file in order:

1. `supabase/migrations/20261017000000_initial_schema.sql` – Core tables, types, RLS, RPCs, triggers, storage bucket
2. `supabase/migrations/20261017001000_workflow_security_and_catalog.sql` – Workflow guards, public profiles, search RPC, seed categories
3. `supabase/migrations/20261017002000_profile_workflow_and_admin_access.sql` – Deactivation, active-account policies, request FKs
4. `supabase/migrations/20261017003000_lifecycle_notifications_rls_hardening.sql` – Archive/restore, participant access, notification routing, storage hardening
5. `supabase/migrations/20261017003100_security_fixes.sql` – Security fixes for migration 030 (race conditions, FK corrections, actor validation)

**Alternative (Supabase CLI):**

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

### 5. Set up the storage bucket

The initial migration creates a public `listing-images` bucket automatically. If it doesn't exist:

1. Go to Storage in Supabase dashboard
2. Create bucket named `listing-images`
3. Set to **Public**
4. Allow MIME types: `image/jpeg`, `image/png`, `image/webp`
5. Max file size: 5 MB

### 6. Seed test data

Run in the SQL Editor:

```sql
-- Add a college (required – listings reference colleges)
INSERT INTO public.colleges (name, location)
VALUES ('Your University', 'Your City, India');
```

### 7. Create an admin user

After a user signs up through the app, promote them to admin:

```sql
INSERT INTO private.user_roles (user_id, role)
VALUES ('<user-uuid-from-auth.users>', 'admin');
```

> Admin roles live in `private.user_roles` and are never exposed to the client. The `is_admin()` function checks this table via `SECURITY DEFINER`.

## Development

```bash
npm run dev       # Start dev server at http://localhost:5173
npm run build     # Type-check and build for production
npm run lint      # Run Oxlint
npm run preview   # Preview production build locally
```

## Project Structure

```
campuscycle/
├── src/
│   ├── components/       # Reusable UI (layout, listings, primitives)
│   ├── hooks/            # TanStack Query hooks (useListings, useMarketplace)
│   ├── lib/              # Supabase client, utility functions
│   ├── pages/
│   │   ├── public/       # Home, Explore, Listing Detail, Contact, Terms
│   │   ├── student/      # My Listings, Create/Edit, Requests, Profile
│   │   └── admin/        # Admin panel (Reports, Listings, Users, Categories, Transactions)
│   ├── store/            # Zustand auth store
│   └── types/            # TypeScript definitions
├── supabase/
│   └── migrations/       # PostgreSQL migrations (5 files)
├── public/               # Static assets
└── dist/                 # Production build output
```

## Architecture

### Security model

- **Client** uses only the anon/publishable key – no service-role secrets in frontend code
- **RLS policies** on every table enforce user isolation and admin access
- **SECURITY DEFINER RPCs** validate all state transitions server-side (request lifecycle, archive, moderation)
- **Private schema** (`private.user_roles`) stores admin roles, inaccessible to the client
- **Triggers** handle notifications and profile synchronization server-side

### Key workflows

| Workflow | Entry point | What happens |
|----------|-------------|--------------|
| Create listing | `insert` → `publish_listing` RPC | Draft → image upload → publish sets `available` |
| Submit request | `submit_request` RPC | Validates listing, owner, dates, overlap |
| Accept request | `respond_to_request` RPC | Creates transaction, reserves listing, rejects competing requests |
| Handover | `confirm_handover` RPC | Owner marks handover complete |
| Completion | `confirm_completion` RPC | Both parties confirm → listing marked sold/donated |
| Borrowing return | `initiate_return` → `confirm_return` | Two-step return with dual confirmation |
| Archive | `archive_listing` RPC | Hides from discovery, cancels pending requests, preserves history |

### Data invariants

- `auth.users` ↔ `profiles` – 1:1, cascade delete
- `profiles` → `public_profiles` – synced by trigger (safe projection)
- One request per listing/requester pair
- Max one transaction per request
- GiST exclusion constraint prevents overlapping active borrow periods
- RESTRICT foreign keys on requests/transactions prevent listing deletion (use archive instead)

## Deployment

Build the production bundle:

```bash
npm run build
```

The `dist/` folder contains static files ready for any hosting provider:

- **Netlify:** `npx netlify deploy --prod --dir=dist`
- **Vercel:** `npx vercel --prod`
- **Static hosting:** Upload `dist/` contents via FTP or file manager

Add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as environment variables in your hosting provider's settings.

## Known Limitations

- **Public storage bucket** – The `listing-images` bucket is public. Anyone who knows an image URL can access it; RLS on `listing_images` only controls metadata visibility, not the storage object itself.
- **No email notifications** – Notifications are in-app only. Supabase Edge Functions or a separate email service would be needed for email delivery.
- **No college verification** – Users self-select their college. There is no `.edu` email verification or enrollment check.
- **Manual admin setup** – Admin roles must be assigned via direct SQL insert into `private.user_roles`.
- **No real-time updates** – The app uses polling via TanStack Query refetch intervals, not Supabase Realtime subscriptions.
- **Contact form** – The contact page collects input but has no backend email integration; it shows an honest notice about this.

## License

This project is provided as-is for educational purposes.
