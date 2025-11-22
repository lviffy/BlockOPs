# 🔐 Credentials Setup Guide

Your BlockOps frontend requires **3 environment variables** to work properly. Follow the steps below to get each credential.

## Required Environment Variables

You need to create a `.env.local` file in the `frontend` directory with these variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id_here
```

---

## 1. Supabase Credentials

**What it's for:** Database and user data storage

### Steps to get Supabase credentials:

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Sign up or log in

2. **Create a New Project** (if you don't have one)
   - Click "New Project"
   - Choose an organization
   - Enter project name (e.g., "blockops")
   - Set a database password (save it!)
   - Choose a region
   - Click "Create new project"
   - Wait 2-3 minutes for project to initialize

3. **Get Your Credentials**
   - Once project is ready, go to **Settings** → **API**
   - You'll see:
     - **Project URL** → Copy this as `NEXT_PUBLIC_SUPABASE_URL`
     - **anon/public key** → Copy this as `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. **Set Up Database Tables** (Required)
   - Go to **SQL Editor** in Supabase dashboard
   - Run this SQL to create the required tables:

```sql
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  private_key TEXT,
  wallet_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  api_key TEXT UNIQUE NOT NULL,
  tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Create policies (users can only see/edit their own data)
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own data" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Agents policies
CREATE POLICY "Users can view own agents" ON agents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own agents" ON agents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agents" ON agents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own agents" ON agents
  FOR DELETE USING (auth.uid() = user_id);
```

---

## 2. Privy App ID

**What it's for:** User authentication (Google, email, wallet, etc.)

### Steps to get Privy credentials:

1. **Go to Privy Dashboard**
   - Visit: https://dashboard.privy.io/
   - Sign up or log in

2. **Create a New App**
   - Click "Create App" or "New App"
   - Enter app name (e.g., "BlockOps")
   - Choose your environment (Development for local dev)

3. **Get Your App ID**
   - Once app is created, you'll see your **App ID** on the dashboard
   - Copy this as `NEXT_PUBLIC_PRIVY_APP_ID`

4. **Configure Authentication Methods** (Optional)
   - In Privy dashboard, go to **Authentication** settings
   - Enable the methods you want:
     - ✅ Email
     - ✅ Google
     - ✅ Wallet
     - ✅ Twitter, Discord, GitHub (optional)

---

## 3. Create Your .env.local File

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Create the `.env.local` file:**
   - Windows PowerShell:
     ```powershell
     New-Item -Path .env.local -ItemType File
     ```
   - Or manually create it in your code editor

3. **Add your credentials:**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   NEXT_PUBLIC_PRIVY_APP_ID=clxxxxxxxxxxxxxxxxxxxx
   ```

4. **Save the file**

5. **Restart your dev server:**
   - Stop the current server (Ctrl+C)
   - Run `npm run dev` again

---

## ✅ Verification

After setting up credentials, check:

1. **No errors in terminal** when starting the dev server
2. **Browser console** shows no missing env variable errors
3. **Login page** loads properly (you should see Privy login options)

---

## 🔒 Security Notes

- **Never commit `.env.local`** to git (it's already in `.gitignore`)
- **Use different credentials** for development and production
- **Keep your Supabase service role key secret** (only use anon key in frontend)

---

## 🆘 Troubleshooting

**Error: "Missing Supabase environment variables"**
- Make sure `.env.local` is in the `frontend` directory
- Restart the dev server after creating/editing `.env.local`
- Check for typos in variable names

**Error: "NEXT_PUBLIC_PRIVY_APP_ID is not set"**
- Verify the variable name is exactly `NEXT_PUBLIC_PRIVY_APP_ID`
- Make sure there are no spaces around the `=` sign

**Can't connect to Supabase**
- Check your Supabase project is active
- Verify the URL format: `https://xxxxx.supabase.co`
- Make sure you're using the **anon/public** key, not the service role key

---

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Privy Documentation](https://docs.privy.io/)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)

