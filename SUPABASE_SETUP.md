# Supabase Configuration Guide

This guide explains how to set up Supabase persistence for your validation engine configuration.

## Overview

The app now automatically saves your configuration (table rules, validation settings, and code libraries) to a **shared Supabase database**. This means:

- ✅ Your config persists across browser sessions
- ✅ All users see the same shared configuration
- ✅ Changes sync automatically every 500ms
- ✅ Falls back to localStorage if Supabase is unavailable

## Prerequisites

- A free or paid [Supabase](https://supabase.com) account
- 5-10 minutes to complete setup

## Step 1: Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com) and sign in
2. Click **"New Project"** (or use an existing project)
3. Enter a project name (e.g., "dh-validation-engine")
4. Choose your region
5. Create a **strong database password** (you won't need it often)
6. Click **"Create new project"** and wait for it to initialize (2-3 minutes)

## Step 2: Create the Configuration Table

Once your project is ready:

1. Go to the **SQL Editor** tab (left sidebar)
2. Click **"New Query"**
3. Copy and paste the SQL below:

```sql
-- Create the app_configs table
CREATE TABLE IF NOT EXISTS app_configs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  config_name VARCHAR(255) NOT NULL UNIQUE,
  configs JSONB NOT NULL,
  libraries JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Add auto-update for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_app_configs_updated_at
BEFORE UPDATE ON app_configs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) - allow anonymous access for this shared config
ALTER TABLE app_configs ENABLE ROW LEVEL SECURITY;

-- Create policy: Anyone can read (anon users)
CREATE POLICY "Anyone can read app configs" ON app_configs
  FOR SELECT
  USING (true);

-- Create policy: Anyone can update (anon users)
CREATE POLICY "Anyone can update app configs" ON app_configs
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Create policy: Anyone can insert (anon users)
CREATE POLICY "Anyone can insert app configs" ON app_configs
  FOR INSERT
  USING (true)
  WITH CHECK (true);
```

4. Click **"Run"** to execute the query
5. You should see `Successfully executed 5 queries` at the bottom

## Step 3: Get Your Credentials

1. Go to **Settings** → **API** (in the left sidebar)
2. Under "Project API keys", find:
   - **Project URL** - Copy this entire URL (e.g., `https://xxx.supabase.co`)
   - **anon public** - Copy this long key (starts with `eyJ...`)

**⚠️ Important**: Keep these values safe but not secret (anon key is public-facing). Never commit them to git.

## Step 4: Configure Your App

1. In your project root, open (or create) the `.env.local` file:

```bash
# .env.local file in the project root
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

2. Replace the placeholder values with your actual Supabase credentials from Step 3

3. **Do NOT commit `.env.local` to git** - it's already in `.gitignore`

## Step 5: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Go to **Config Tab** and you should see two sync indicators:
   - ✅ "Auto-saved to your browser" (localStorage)
   - ✅ "Synced to Supabase" (if configured correctly)

3. Make a change to the configuration (e.g., add a validation rule)
4. Watch the status change to "Syncing..." then "Synced to Supabase"

5. **To verify it's persisting**: 
   - Open Supabase dashboard → **SQL Editor** → Run:
   ```sql
   SELECT config_name, updated_at FROM app_configs;
   ```
   - You should see a 'default' config with a recent timestamp

## Troubleshooting

### "Synced to Supabase" doesn't appear
- **Check your credentials**: Make sure `.env.local` has the correct URL and API key
- **Reload the app**: After adding credentials, restart `npm run dev`
- **Check browser console**: Look for errors (F12 → Console tab)

### "Sync failed (using local)" appears
- The app will still work using localStorage
- Check your Supabase project URL and API key
- Ensure your Supabase table has the correct structure (run Step 2 SQL again)

### How to manually sync later
- Open Supabase SQL Editor and check the table:
  ```sql
  SELECT * FROM app_configs;
  ```
- You can also export your config locally from the **Config Tab** → **Save Configuration** button

## How It Works

1. **On App Load**:
   - Tries to fetch config from Supabase
   - Falls back to localStorage if Supabase unavailable
   - Falls back to defaults if neither exists

2. **While Using**:
   - Every 500ms after a config change, saves to both:
     - **localStorage** (instant, works offline)
     - **Supabase** (shared, persists globally)

3. **Fallback Behavior**:
   - If Supabase is down, you still save locally
   - Status shows "Sync failed (using local)"
   - Changes automatically retry when Supabase is back

## Optional: Advanced Configuration

### Use Different Configs for Different Projects

If you want separate configs per "project", modify `services/supabaseClient.ts`:

```typescript
// Change this line in saveConfigToSupabase and loadConfigFromSupabase:
eq('config_name', 'default')  // Currently: shared global config
eq('config_name', projectId)   // Alternative: per-project config
```

### Restrict Access

Add authentication to only allow specific users:
1. In Supabase, set up users with email/password
2. Update RLS policies to check `auth.uid()`
3. Use Supabase Auth SDK in the app

## Cleanup

### Remove Supabase Integration
If you want to stop using Supabase:
1. Remove the environment variables from `.env.local`
2. The app automatically falls back to localStorage
3. Your data remains safe in localStorage

### Backup Your Config
Before making changes:
```bash
# Export config from the app UI
Config Tab → Save Configuration → Download userConfig.json
```

## Questions?

- Check [Supabase Documentation](https://supabase.com/docs)
- Review [your project's SQL Editor](https://app.supabase.com) for the table structure
- Verify environment variables with: `npm run dev` and check browser console

---

**Your app is now ready to persist configuration globally! 🎉**
