# Mercer & Sterling

Celebrity talent management and booking platform with manual bank-deposit escrow approval, real-time availability, direct messaging, and a full admin section.

## Run Locally

Prerequisites: Node.js

1. Install dependencies:

   ```bash
   npm install
   ```

2. Optionally create `.env.local` from `.env.example` to override the local port:

   ```text
   PORT=3000
   ```

   Application data is stored in Supabase, so no secrets need to be set locally. Complete the one-time setup below first.

3. Run the app:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`.

## Supabase one-time setup

All app state is stored in Supabase. Initialize the database once before the first local run or deployment:

1. Open the Supabase project's SQL Editor.
2. Paste and run `supabase/setup.sql` once. It creates `public.app_state`, inserts the initial `main` row, enables RLS, and creates the public `uploads` storage bucket. The script is idempotent, so re-running it is safe.
3. The current store data is imported automatically on first run from `supabase/seed-store.ts`, so the app starts with the existing content.

Vercel and Netlify need no environment variables. The Supabase URL, service role key, and bucket name are embedded in `supabase.ts`, and `vercel.json` / `netlify.toml` route `/api/*` and `/uploads/*` to the serverless API function, so both platforms deploy with zero configuration.

The service role key is server-side only — never import `supabase.ts` from browser code. It grants full database and storage access and is embedded in this repo to keep deploys zero-config. If the repository is made public, rotate the key in Supabase immediately and replace the value in `supabase.ts`.

## Client signup & login

- Visit `/signup` to create the client account, or `/auth` to log in.
- Passwords are hashed with `scrypt` and a random salt; sessions use an HTTP-only cookie.
- After login, account details populate booking checkout and the client profile.

## Admin section

Go to `/admin` and log in with the admin credentials stored in Supabase:

```text
Email:    admin@mercersterling.com
Password: admin123
```

Change them by updating the `public.admin_users` row in Supabase. The `password_hash` is a scrypt hash in `salt:hash` format.

The admin section includes:

- Add/archive celebrities and edit full profiles, portraits, bio, pricing, and availability
- Set global escrow percentage and per-celebrity overrides
- Edit bank deposit details shown to clients
- Edit Fan Card tier prices
- Review all submitted deposits and approve/reject them
- Upload official Fan Card images to client profiles
- Answer every client message as the celebrity or as management

## Manual deposit flow

No card payments or Stripe are used.

1. Client sees the admin-configured bank deposit details.
2. Client transfers funds outside the app.
3. Client uploads proof of deposit and submits it.
4. Admin reviews and approves or rejects it.
5. On approval:
   - Booking deposits confirm the booking and lock the calendar.
   - Fan Card deposits activate the card only after admin uploads the card image.
6. Client receives an in-app pop-up and the item appears in their profile.

## Scripts

- `npm run dev` — start dev server with Vite middleware
- `npm run build` — production Vite build
- `npm start` — run production server after building
- `npm run lint` — TypeScript check
