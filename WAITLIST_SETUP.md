# Waitlist Setup Guide

## Overview
Billboard is collecting email signups through a waitlist before the MVP launch. This guide walks through the setup process.

## Files Created

### Database
- `supabase/waitlist_schema.sql` - Complete PostgreSQL schema with RLS

### Frontend
- `src/types/waitlist.ts` - TypeScript interfaces
- `src/lib/waitlistService.ts` - Service layer for waitlist operations
- `src/components/WaitlistForm.tsx` - Reusable signup form component

### Landing Page
- Updated `src/app/page.tsx` - Now reflects Billboard as a creator platform for sharing places

---

## Step 1: Deploy Database Schema

### 1.1 Access Supabase SQL Editor
```
1. Go to https://app.supabase.com
2. Select your Billboard project
3. Click "SQL Editor" in the left sidebar
4. Click "New Query"
```

### 1.2 Run the Schema
```
1. Copy the entire contents of supabase/waitlist_schema.sql
2. Paste into the SQL Editor
3. Click RUN (or Ctrl+Enter)
4. Wait for success message
```

### 1.3 Verify Table
```
1. Go to "Table Editor" in left sidebar
2. Look for "waitlist" table in the list
3. Click on it to view the structure
4. You should see 7 columns: id, email, full_name, interests, status, created_at, updated_at
```

---

## Step 2: Enable RLS (Row Level Security)

### 2.1 Check RLS Status
```
1. In Table Editor, click "waitlist" table
2. Click the "RLS" button at top right
3. You should see a toggle showing RLS is ENABLED
4. You should see 2 policies:
   - "Anyone can join waitlist" (INSERT)
   - "Users can view own waitlist entry" (SELECT)
```

If not enabled:
```
1. Click "RLS" toggle to enable
2. The policies from the SQL schema will be auto-applied
```

---

## Step 3: Test the Waitlist

### 3.1 Manual Test
```sql
-- Test: Insert a test email
INSERT INTO waitlist (email, full_name, interests, status)
VALUES ('test@example.com', 'Test User', ARRAY['billboard', 'sharing'], 'pending');

-- Verify it appears
SELECT * FROM waitlist WHERE email = 'test@example.com';

-- Clean up
DELETE FROM waitlist WHERE email = 'test@example.com';
```

### 3.2 Test via Frontend
1. Start the app: `npm run dev`
2. Go to landing page: http://localhost:3000
3. Fill in the waitlist form
4. Click "Join the MVP" or "Get Early Access"
5. You should see a success message

### 3.3 Verify in Database
```
1. Go to Supabase Table Editor
2. Click "waitlist" table
3. You should see your test entry there
4. Status should be "pending"
```

---

## Using WaitlistForm Component

### Basic Usage
```tsx
import WaitlistForm from "@/components/WaitlistForm";

// Simple form with email only
<WaitlistForm showName={false} text="Join Now" />

// Form with name field
<WaitlistForm showName={true} text="Get Early Access" />

// With callback
<WaitlistForm
  showName={true}
  text="Join Waitlist"
  onSuccess={() => {
    console.log("User signed up!");
  }}
/>
```

### Props
- `showName` (boolean) - Show/hide name field. Default: `true`
- `text` (string) - Button text. Default: `"Join the waitlist"`
- `onSuccess` (function) - Callback when signup succeeds. Optional

---

## Using waitlistService

### Get All Methods
```typescript
import { waitlistService } from "@/lib/waitlistService";

// Subscribe with email, name, and interests
const response = await waitlistService.subscribe(
  "user@example.com",
  "John Doe",
  ["billboard", "sharing", "creating"]
);

// Check if email is on waitlist
const exists = await waitlistService.isOnWaitlist("user@example.com");
// Returns: true or false

// Get total count
const count = await waitlistService.getWaitlistCount();
// Returns: 42

// Get user's entry by email
const entry = await waitlistService.getByEmail("user@example.com");
// Returns: { id, email, full_name, interests, status, created_at, updated_at } or null

// Subscribe with custom interests
const response = await waitlistService.subscribeWithInterests(
  "user@example.com",
  "Jane Smith",
  ["shopping", "events", "food"]
);
```

---

## Troubleshooting

### Error: "RLS policy violation"
**Problem:** Database insert is blocked by RLS
**Solution:**
1. Go to Table Editor → waitlist → RLS
2. Check that "Anyone can join waitlist" policy exists
3. If not, run the schema SQL again

### Error: "Unique constraint violation"
**Problem:** Email is already on waitlist
**Solution:**
- This is expected behavior
- The form shows: "This email is already on our waitlist!"
- To remove a duplicate, run in SQL:
  ```sql
  DELETE FROM waitlist WHERE email = 'duplicate@example.com';
  ```

### Form not submitting
**Problem:** Frontend not connecting to Supabase
**Solution:**
1. Check `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Restart dev server: `npm run dev`
3. Check browser console for errors

### No success message after signup
**Problem:** Form submitted but no feedback
**Solution:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Sign up again and check for errors
4. Check Network tab to see if API call succeeded

---

## Next Steps

### For Development
1. ✅ Database schema deployed
2. ✅ WaitlistForm component ready
3. ✅ Service layer functional
4. Next: Add to more pages and CTAs

### For Production
1. Set up email confirmation (optional)
2. Create dashboard to view signups
3. Set up email notifications for new signups
4. Create backend endpoint to mark users as "confirmed" or "joined"

### Optional Features
1. Double opt-in confirmation email
2. Landing page analytics
3. Segmentation by interests
4. Export waitlist to CSV
5. Automated onboarding emails when MVP launches

---

## File Locations

```
supabase/
  └─ waitlist_schema.sql          ← Database schema (run this in Supabase SQL Editor)

src/
  ├─ types/
  │  └─ waitlist.ts               ← TypeScript interfaces
  ├─ lib/
  │  └─ waitlistService.ts        ← Service layer
  ├─ components/
  │  └─ WaitlistForm.tsx          ← React component
  └─ app/
     └─ page.tsx                  ← Updated landing page

docs/
  └─ (This file)                  ← Setup guide
```

---

## Questions?

Check the files directly:
- Database schema: `supabase/waitlist_schema.sql`
- Service methods: `src/lib/waitlistService.ts`
- Component props: `src/components/WaitlistForm.tsx`
- TypeScript types: `src/types/waitlist.ts`
