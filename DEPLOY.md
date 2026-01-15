# CHO Bookkeeping Assistant - Deployment Guide

## What You're Building

A web app where:
- **Chris/crew** submit expenses (photo + property address) from their phone
- **Sherry** asks categorization questions and sees submitted expenses
- **You** can see flagged items and all queries (hidden admin panel)

---

## Step 1: Create Accounts (15 minutes)

### 1A: Supabase (Database)

1. Go to **https://supabase.com**
2. Click "Start your project" → Sign up with GitHub or email
3. Click "New Project"
4. Name it: `cho-bookkeeping`
5. Set a database password (save this somewhere!)
6. Region: Choose closest to you (West US)
7. Click "Create new project" — wait 2 minutes

**Get your keys:**
1. In Supabase dashboard, click ⚙️ **Settings** (left sidebar)
2. Click **API**
3. Copy these two values:
   - `Project URL` → This is your `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` key (under "Project API keys") → This is your `SUPABASE_SERVICE_KEY`

### 1B: Set Up Database Tables

1. In Supabase, click **SQL Editor** (left sidebar)
2. Click "New Query"
3. Paste this and click "Run":

```sql
-- Create expenses table
CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  property TEXT NOT NULL,
  amount TEXT,
  vendor TEXT,
  note TEXT,
  submitted_by TEXT DEFAULT 'Team',
  receipt_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create flagged items table
CREATE TABLE flagged_items (
  id SERIAL PRIMARY KEY,
  query TEXT,
  response TEXT,
  flag_reason TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true);

-- Allow public access to receipts
CREATE POLICY "Public Access" ON storage.objects 
FOR ALL USING (bucket_id = 'receipts');
```

4. You should see "Success" — tables are created!

### 1C: Anthropic API Key

1. Go to **https://console.anthropic.com**
2. Sign in (you probably already have an account)
3. Click **API Keys**
4. Click "Create Key"
5. Name it: `cho-bookkeeping`
6. Copy the key (starts with `sk-ant-...`)

### 1D: Vercel Account

1. Go to **https://vercel.com**
2. Click "Sign Up" → Sign up with GitHub (easiest)
3. Done — you'll deploy here later

---

## Step 2: Download the Code

**Option A: If you use GitHub**

1. Create a new repository on GitHub called `cho-bookkeeping`
2. Upload all the files from the `cho-bookkeeping-app` folder

**Option B: If you don't use GitHub**

1. Keep the folder I gave you
2. You'll upload directly to Vercel

---

## Step 3: Deploy to Vercel (10 minutes)

1. Go to **https://vercel.com/new**
2. If using GitHub: Click "Import" next to your `cho-bookkeeping` repo
3. If not using GitHub: Click "Upload" and drag the `cho-bookkeeping-app` folder

4. **Configure Environment Variables:**
   - Click "Environment Variables"
   - Add these three:
   
   | Name | Value |
   |------|-------|
   | `ANTHROPIC_API_KEY` | Your Anthropic key (sk-ant-...) |
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase URL |
   | `SUPABASE_SERVICE_KEY` | Your Supabase service key |

5. Click **Deploy**
6. Wait 2-3 minutes

7. **Done!** Vercel gives you a URL like `cho-bookkeeping.vercel.app`

---

## Step 4: Test It

1. Open your Vercel URL
2. You should see the CHO Bookkeeping Assistant
3. Try:
   - Switch to "Submit Expense" mode
   - Enter a property address and submit
   - Switch back to "Bookkeeper View"
   - Ask "show me submitted expenses"
   - Ask "where does Xandro go?"

4. **Test the admin panel:**
   - Click the tiny dot in the top-right corner
   - You should see the admin panel with flagged items and submitted expenses

---

## Step 5: Share with Team

**For Chris/crew (expense submission):**
- Share the URL
- Bookmark it on their phone
- They only use "Submit Expense" mode

**For Sherry (bookkeeping):**
- Share the URL
- She uses "Bookkeeper View" mode
- She can see submitted expenses and ask questions

**For you (admin):**
- Click the tiny dot top-right to see admin panel
- View all flagged items and queries
- Sherry doesn't know this exists

---

## Troubleshooting

**"Failed to fetch expenses"**
- Check Supabase credentials are correct
- Make sure you ran the SQL to create tables

**"Chat not working"**
- Check Anthropic API key is correct
- Make sure you have credits in your Anthropic account

**"Receipt upload not working"**
- Check Supabase storage bucket was created
- Run the SQL again if needed

---

## Updating the App

To make changes:
1. Edit the code
2. Push to GitHub (or re-upload to Vercel)
3. Vercel automatically redeploys

---

## Adding More Properties

Edit `src/app/page.js` and find the `activeProperties` array:

```javascript
const activeProperties = [
  '3845 E Yeager Dr, Gilbert AZ',
  '4570 W Lyn Circle, Tucson AZ',
  // Add more here
];
```

Then redeploy.

---

## Questions?

The app is built. If something doesn't work, the issue is almost always:
1. Wrong API key
2. Supabase tables not created
3. Environment variables not set in Vercel

Check those first.
