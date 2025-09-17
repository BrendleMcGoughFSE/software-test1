# Inspection Cloud (Branded + QR-in-PDF + Login from Public Page)

**What’s included**
- Brendle & McGough branding (replace `/public/logo.png` with your real logo).
- Disclaimers + signature placement tweaks (text blocks above signature lines; signatures on dedicated lines).
- PDF includes a **QR code** in the header that points to the stable public URL `/r/{slug}`.
- Public landing page displays the current PDF and shows a **“Brendle & McGough Login”** button.
- Login uses **Supabase Auth** (magic link). After login, users go straight to `/inspect?project_id=...` with customer/project prefilled.
- Dashboard to create **customers**, **projects**, and manage **files**.

## 1) Supabase setup
1. Create a project at supabase.com.
2. Storage → create bucket `reports` (private recommended).
3. SQL Editor → run:
```sql
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);
create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  slug text unique not null,
  storage_path text not null,
  created_at timestamptz default now()
);
```
*(Optional later: add address fields to `projects` for auto-prefill.)*

## 2) Environment variables
Set these (local `.env.local` or Vercel → Project → Settings → Environment Variables):

```
SUPABASE_URL=your_project_url
SUPABASE_SERVICE_ROLE=your_service_role_key
SUPABASE_BUCKET=reports

NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_public_key

NEXT_PUBLIC_APP_NAME=Brendle & McGough Fire & Safety Equipment
```

**Security:** The SERVICE_ROLE key is used **only on the server** (API routes & SSR). Never expose it in the browser.

## 3) Deploy (Vercel)
- Push this folder to a GitHub repo.
- Import on vercel.com; add the env vars; deploy.

## 4) Flow
- **Technician scans the QR** posted at the equipment/site.  
  → Public `/r/{slug}` page opens the current PDF.  
  → **Brendle & McGough Login** button → `/login?next=/inspect?project_id=...`  
  → Magic link login → redirected to `/inspect?project_id=...` prefilled.  
  → Technician creates a new report → PDF auto-uploads → stable link/QR stays the same.

- **Back office** uses **/dashboard** to manage customers, projects, and the file list.

## 5) Branding & text
- Replace `/public/logo.png` with your official logo (same filename).  
- Update the disclaimer text inside `/pages/inspect.js` if you want exact legal wording.

## 6) Put the QR on-site
- From Dashboard or the /inspect result, save the QR image and print as a sticker.  
- Scanning it always shows the **latest** PDF (you can replace PDFs without changing the QR).

## 7) Where to adjust signature placement
- All signature visuals are in `/pages/inspect.js` layout and inside the **Preview** block used for the PDF.  
- You can change the line positions, labels, and the disclaimers there.

That’s it. Deploy this and you’ll have a branded, QR-driven inspection system with login-from-public flow and stable links.
