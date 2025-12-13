-- Block and Report Users functionality
-- Run this SQL in your Supabase SQL editor

-- ============================================
-- BLOCKED USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users(blocked_id);

-- RLS policies for blocked_users
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

-- Users can see their own blocks
CREATE POLICY "Users can view their own blocks"
  ON blocked_users FOR SELECT
  USING (auth.uid() = blocker_id);

-- Users can create blocks
CREATE POLICY "Users can create blocks"
  ON blocked_users FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

-- Users can delete their own blocks (unblock)
CREATE POLICY "Users can delete their own blocks"
  ON blocked_users FOR DELETE
  USING (auth.uid() = blocker_id);

-- ============================================
-- REPORTED USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter ON user_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_reported ON user_reports(reported_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status);

-- RLS policies for user_reports
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

-- Users can see their own reports
CREATE POLICY "Users can view their own reports"
  ON user_reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- Users can create reports
CREATE POLICY "Users can create reports"
  ON user_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- ============================================
-- FUNCTION: Block a user
-- ============================================
CREATE OR REPLACE FUNCTION block_user(p_blocked_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_blocker_id UUID;
  v_result JSON;
BEGIN
  -- Get current user
  v_blocker_id := auth.uid();
  
  IF v_blocker_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  IF v_blocker_id = p_blocked_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot block yourself');
  END IF;
  
  -- Insert block (ignore if already exists)
  INSERT INTO blocked_users (blocker_id, blocked_id)
  VALUES (v_blocker_id, p_blocked_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
  
  -- Optionally: Remove any existing follow relationships
  DELETE FROM follows WHERE (follower_id = v_blocker_id AND following_id = p_blocked_id)
                        OR (follower_id = p_blocked_id AND following_id = v_blocker_id);
  
  RETURN json_build_object('success', true, 'message', 'User blocked successfully');
END;
$$;

-- ============================================
-- FUNCTION: Unblock a user
-- ============================================
CREATE OR REPLACE FUNCTION unblock_user(p_blocked_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_blocker_id UUID;
BEGIN
  v_blocker_id := auth.uid();
  
  IF v_blocker_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  DELETE FROM blocked_users
  WHERE blocker_id = v_blocker_id AND blocked_id = p_blocked_id;
  
  RETURN json_build_object('success', true, 'message', 'User unblocked successfully');
END;
$$;

-- ============================================
-- FUNCTION: Check if user is blocked
-- ============================================
CREATE OR REPLACE FUNCTION is_user_blocked(p_other_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_id UUID;
BEGIN
  v_current_id := auth.uid();
  
  IF v_current_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if either user has blocked the other
  RETURN EXISTS (
    SELECT 1 FROM blocked_users
    WHERE (blocker_id = v_current_id AND blocked_id = p_other_id)
       OR (blocker_id = p_other_id AND blocked_id = v_current_id)
  );
END;
$$;

-- ============================================
-- FUNCTION: Report a user
-- ============================================
CREATE OR REPLACE FUNCTION report_user(
  p_reported_id UUID,
  p_reason TEXT,
  p_details TEXT DEFAULT NULL,
  p_conversation_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reporter_id UUID;
  v_report_id UUID;
BEGIN
  v_reporter_id := auth.uid();
  
  IF v_reporter_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  IF v_reporter_id = p_reported_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot report yourself');
  END IF;
  
  -- Check if already reported recently (within 24 hours)
  IF EXISTS (
    SELECT 1 FROM user_reports
    WHERE reporter_id = v_reporter_id
      AND reported_id = p_reported_id
      AND created_at > NOW() - INTERVAL '24 hours'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You have already reported this user recently');
  END IF;
  
  -- Insert report
  INSERT INTO user_reports (reporter_id, reported_id, reason, details, conversation_id)
  VALUES (v_reporter_id, p_reported_id, p_reason, p_details, p_conversation_id)
  RETURNING id INTO v_report_id;
  
  RETURN json_build_object('success', true, 'report_id', v_report_id, 'message', 'Report submitted successfully');
END;
$$;

-- ============================================
-- FUNCTION: Get blocked users list
-- ============================================
CREATE OR REPLACE FUNCTION get_blocked_users()
RETURNS TABLE (
  blocked_id UUID,
  blocked_at TIMESTAMPTZ,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    bu.blocked_id,
    bu.created_at AS blocked_at,
    p.username,
    p.full_name,
    p.avatar_url
  FROM blocked_users bu
  LEFT JOIN profiles p ON p.id = bu.blocked_id
  WHERE bu.blocker_id = v_user_id
  ORDER BY bu.created_at DESC;
END;
$$;

-- ============================================
-- FUNCTION: Clear chat messages
-- ============================================
CREATE OR REPLACE FUNCTION clear_chat_messages(p_conversation_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_is_participant BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Check if user is participant
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id = v_user_id
  ) INTO v_is_participant;
  
  IF NOT v_is_participant THEN
    RETURN json_build_object('success', false, 'error', 'Not a participant in this conversation');
  END IF;
  
  -- Delete messages (or mark as deleted for the user - depending on your preference)
  -- Option 1: Hard delete all messages in conversation
  -- DELETE FROM messages WHERE conversation_id = p_conversation_id;
  
  -- Option 2: Soft delete - mark messages as deleted for this user only
  -- This requires a separate table or column to track per-user deletion
  -- For now, we'll do a hard delete
  DELETE FROM messages WHERE conversation_id = p_conversation_id;
  
  RETURN json_build_object('success', true, 'message', 'Chat cleared successfully');
END;
$$;
