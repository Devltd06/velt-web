-- Waitlist table for MVP sign-ups
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  interests TEXT[] DEFAULT ARRAY['billboard', 'sharing', 'creating'],
  status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, joined
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at DESC);

-- Enable RLS
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (public signup)
CREATE POLICY "Anyone can join waitlist"
  ON waitlist
  FOR INSERT
  WITH CHECK (true);

-- Policy: Anyone can check if email exists (for duplicate check)
CREATE POLICY "Anyone can check waitlist"
  ON waitlist
  FOR SELECT
  USING (true);

-- Policy: Only service role can update status
-- This is controlled at application level with service role key
CREATE POLICY "Service role can update waitlist"
  ON waitlist
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- Trigger to update the updated_at column
CREATE OR REPLACE FUNCTION update_waitlist_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS waitlist_update_timestamp ON waitlist;
CREATE TRIGGER waitlist_update_timestamp
  BEFORE UPDATE ON waitlist
  FOR EACH ROW
  EXECUTE FUNCTION update_waitlist_timestamp();

-- Comment on table
COMMENT ON TABLE waitlist IS 'Waitlist for MVP early access - stores email signups before app launch';
COMMENT ON COLUMN waitlist.status IS 'pending=initial signup, confirmed=email verified, joined=active user';
