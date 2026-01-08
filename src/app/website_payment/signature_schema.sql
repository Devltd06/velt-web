-- ============================================================================
-- VELT SIGNATURE SUBSCRIPTION DATABASE SCHEMA
-- ============================================================================
-- 
-- This SQL file contains all the necessary database tables and functions
-- for managing Velt Signature subscriptions.
-- 
-- RUN ORDER:
-- 1. Run this entire file in your Supabase SQL Editor
-- 2. This will create/update all necessary tables and functions
-- 
-- TABLES CREATED/UPDATED:
-- - profiles (adds is_signature, subscription_ends_at columns if not exist)
-- - payments (for tracking all payment transactions)
-- - subscription_history (for tracking subscription changes)
-- - signature_pricing (for country-specific pricing)
-- 
-- ============================================================================

-- ============================================================================
-- 1. UPDATE PROFILES TABLE
-- ============================================================================
-- Add signature-related columns to profiles if they don't exist

DO $$ 
BEGIN
    -- Add is_signature column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'is_signature'
    ) THEN
        ALTER TABLE profiles ADD COLUMN is_signature BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add subscription_ends_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'subscription_ends_at'
    ) THEN
        ALTER TABLE profiles ADD COLUMN subscription_ends_at TIMESTAMPTZ NULL;
    END IF;

    -- Add verified column if not exists (for backwards compatibility)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'verified'
    ) THEN
        ALTER TABLE profiles ADD COLUMN verified BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Create index for subscription queries
CREATE INDEX IF NOT EXISTS idx_profiles_signature ON profiles(is_signature) WHERE is_signature = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_end ON profiles(subscription_ends_at) WHERE subscription_ends_at IS NOT NULL;

-- ============================================================================
-- 2. PAYMENTS TABLE
-- ============================================================================
-- Track all payment transactions

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- Amount in smallest currency unit (pesewas, cents, etc.)
    currency VARCHAR(3) NOT NULL DEFAULT 'GHS',
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, completed, failed, cancelled, refunded
    payment_type VARCHAR(50) DEFAULT 'subscription', -- subscription, renewal, one_time
    paystack_reference VARCHAR(255),
    paystack_transaction_id VARCHAR(255),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns to payments table if they don't exist (for existing tables)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'paystack_reference'
    ) THEN
        ALTER TABLE payments ADD COLUMN paystack_reference VARCHAR(255);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'paystack_transaction_id'
    ) THEN
        ALTER TABLE payments ADD COLUMN paystack_transaction_id VARCHAR(255);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'error_message'
    ) THEN
        ALTER TABLE payments ADD COLUMN error_message TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE payments ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'completed_at'
    ) THEN
        ALTER TABLE payments ADD COLUMN completed_at TIMESTAMPTZ;
    END IF;
END $$;

-- Indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(paystack_reference);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at DESC);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payments_updated_at ON payments;
CREATE TRIGGER payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_payments_updated_at();

-- RLS Policies for payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments" ON payments
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own payments" ON payments;
CREATE POLICY "Users can insert own payments" ON payments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own payments" ON payments;
CREATE POLICY "Users can update own payments" ON payments
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage payments" ON payments;
CREATE POLICY "Service role can manage payments" ON payments
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 3. SUBSCRIPTION HISTORY TABLE
-- ============================================================================
-- Track all subscription changes for auditing and analytics

CREATE TABLE IF NOT EXISTS subscription_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id),
    plan_type VARCHAR(20) NOT NULL, -- monthly, annual
    amount INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'GHS',
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_renewal BOOLEAN DEFAULT FALSE,
    is_cancelled BOOLEAN DEFAULT FALSE,
    cancelled_at TIMESTAMPTZ,
    paystack_reference VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns to subscription_history table if they don't exist (for existing tables)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscription_history' AND column_name = 'paystack_reference'
    ) THEN
        ALTER TABLE subscription_history ADD COLUMN paystack_reference VARCHAR(255);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscription_history' AND column_name = 'is_cancelled'
    ) THEN
        ALTER TABLE subscription_history ADD COLUMN is_cancelled BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscription_history' AND column_name = 'cancelled_at'
    ) THEN
        ALTER TABLE subscription_history ADD COLUMN cancelled_at TIMESTAMPTZ;
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscription_history_user ON subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_dates ON subscription_history(start_date, end_date);

-- RLS Policies
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription history" ON subscription_history;
CREATE POLICY "Users can view own subscription history" ON subscription_history
    FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- 4. SIGNATURE PRICING TABLE
-- ============================================================================
-- Country-specific pricing for international support

CREATE TABLE IF NOT EXISTS signature_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code VARCHAR(2) NOT NULL UNIQUE,
    currency_code VARCHAR(3) NOT NULL,
    currency_symbol VARCHAR(5) NOT NULL,
    monthly_price INTEGER NOT NULL, -- Price in smallest unit
    monthly_price_display VARCHAR(20) NOT NULL, -- e.g., "₵25"
    annual_price INTEGER NOT NULL, -- Price in smallest unit (called signature_price in app)
    annual_price_display VARCHAR(20) NOT NULL, -- e.g., "₵300"
    paystack_currency VARCHAR(3) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default pricing (Ghana)
INSERT INTO signature_pricing (
    country_code, currency_code, currency_symbol,
    monthly_price, monthly_price_display,
    annual_price, annual_price_display,
    paystack_currency
) VALUES (
    'GH', 'GHS', '₵',
    2500, '₵25',
    30000, '₵300',
    'GHS'
) ON CONFLICT (country_code) DO UPDATE SET
    monthly_price = EXCLUDED.monthly_price,
    monthly_price_display = EXCLUDED.monthly_price_display,
    annual_price = EXCLUDED.annual_price,
    annual_price_display = EXCLUDED.annual_price_display,
    updated_at = NOW();

-- Insert more countries (optional)
INSERT INTO signature_pricing (
    country_code, currency_code, currency_symbol,
    monthly_price, monthly_price_display,
    annual_price, annual_price_display,
    paystack_currency
) VALUES 
    ('NG', 'NGN', '₦', 500000, '₦5,000', 5000000, '₦50,000', 'NGN'),
    ('ZA', 'ZAR', 'R', 9900, 'R99', 99900, 'R999', 'ZAR'),
    ('KE', 'KES', 'KSh', 70000, 'KSh700', 700000, 'KSh7,000', 'KES'),
    ('US', 'USD', '$', 499, '$4.99', 4999, '$49.99', 'USD'),
    ('GB', 'GBP', '£', 399, '£3.99', 3999, '£39.99', 'GBP')
ON CONFLICT (country_code) DO NOTHING;

-- ============================================================================
-- 5. FUNCTIONS
-- ============================================================================

-- Drop existing functions first to allow return type changes
DROP FUNCTION IF EXISTS get_signature_pricing(VARCHAR);
DROP FUNCTION IF EXISTS check_subscription_status(UUID);
DROP FUNCTION IF EXISTS extend_subscription(UUID, INTEGER, UUID);
DROP FUNCTION IF EXISTS expire_subscriptions();

-- Function to get signature pricing for a country
CREATE OR REPLACE FUNCTION get_signature_pricing(p_country_code VARCHAR(2))
RETURNS TABLE (
    country_code VARCHAR(2),
    currency_code VARCHAR(3),
    currency_symbol VARCHAR(5),
    monthly_price INTEGER,
    monthly_price_display VARCHAR(20),
    signature_price INTEGER,
    signature_price_display VARCHAR(20),
    paystack_currency VARCHAR(3)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.country_code,
        sp.currency_code,
        sp.currency_symbol,
        sp.monthly_price,
        sp.monthly_price_display,
        sp.annual_price as signature_price,
        sp.annual_price_display as signature_price_display,
        sp.paystack_currency
    FROM signature_pricing sp
    WHERE sp.country_code = p_country_code
    AND sp.is_active = TRUE;

    -- Return default (Ghana) if country not found
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            sp.country_code,
            sp.currency_code,
            sp.currency_symbol,
            sp.monthly_price,
            sp.monthly_price_display,
            sp.annual_price as signature_price,
            sp.annual_price_display as signature_price_display,
            sp.paystack_currency
        FROM signature_pricing sp
        WHERE sp.country_code = 'GH'
        AND sp.is_active = TRUE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and expire subscriptions (run via cron)
CREATE OR REPLACE FUNCTION expire_subscriptions()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE profiles
    SET 
        is_signature = FALSE,
        verified = FALSE
    WHERE 
        subscription_ends_at IS NOT NULL
        AND subscription_ends_at < NOW()
        AND (is_signature = TRUE OR verified = TRUE);
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has active subscription
CREATE OR REPLACE FUNCTION check_subscription_status(p_user_id UUID)
RETURNS TABLE (
    is_active BOOLEAN,
    days_remaining INTEGER,
    expires_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN p.subscription_ends_at IS NULL THEN FALSE
            WHEN p.subscription_ends_at > NOW() THEN TRUE
            ELSE FALSE
        END as is_active,
        CASE 
            WHEN p.subscription_ends_at IS NULL THEN 0
            WHEN p.subscription_ends_at > NOW() THEN 
                EXTRACT(DAY FROM (p.subscription_ends_at - NOW()))::INTEGER
            ELSE 0
        END as days_remaining,
        p.subscription_ends_at as expires_at
    FROM profiles p
    WHERE p.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to extend subscription
CREATE OR REPLACE FUNCTION extend_subscription(
    p_user_id UUID,
    p_days INTEGER,
    p_payment_id UUID DEFAULT NULL
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_new_end_date TIMESTAMPTZ;
    v_current_end TIMESTAMPTZ;
BEGIN
    -- Get current subscription end date
    SELECT subscription_ends_at INTO v_current_end
    FROM profiles
    WHERE id = p_user_id;
    
    -- Calculate new end date
    IF v_current_end IS NOT NULL AND v_current_end > NOW() THEN
        -- Extend from current end date
        v_new_end_date := v_current_end + (p_days || ' days')::INTERVAL;
    ELSE
        -- Start fresh from now
        v_new_end_date := NOW() + (p_days || ' days')::INTERVAL;
    END IF;
    
    -- Update profile
    UPDATE profiles
    SET 
        is_signature = TRUE,
        verified = TRUE,
        subscription_ends_at = v_new_end_date
    WHERE id = p_user_id;
    
    RETURN v_new_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. CRON JOB SETUP (Using pg_cron extension if available)
-- ============================================================================
-- Note: Run this only if pg_cron is enabled in your Supabase project

-- Uncomment below if you have pg_cron enabled:
/*
SELECT cron.schedule(
    'expire-subscriptions',
    '0 0 * * *', -- Run daily at midnight
    $$SELECT expire_subscriptions()$$
);
*/

-- ============================================================================
-- 7. HELPER VIEWS
-- ============================================================================

-- View for active subscribers
CREATE OR REPLACE VIEW active_subscribers AS
SELECT 
    p.id,
    p.email,
    p.username,
    p.full_name,
    p.subscription_ends_at,
    EXTRACT(DAY FROM (p.subscription_ends_at - NOW()))::INTEGER as days_remaining
FROM profiles p
WHERE p.is_signature = TRUE 
AND p.subscription_ends_at > NOW();

-- View for expiring subscriptions (within 7 days)
CREATE OR REPLACE VIEW expiring_subscriptions AS
SELECT 
    p.id,
    p.email,
    p.username,
    p.full_name,
    p.subscription_ends_at,
    EXTRACT(DAY FROM (p.subscription_ends_at - NOW()))::INTEGER as days_remaining
FROM profiles p
WHERE p.is_signature = TRUE 
AND p.subscription_ends_at > NOW()
AND p.subscription_ends_at < NOW() + INTERVAL '7 days';

-- ============================================================================
-- DONE!
-- ============================================================================
-- Your database is now set up for Velt Signature subscriptions.
-- 
-- NEXT STEPS:
-- 1. Set up Paystack webhook to point to your /api/paystack-webhook endpoint
-- 2. Add the payment page to your website
-- 3. Configure environment variables on your website
-- 4. Test with Paystack test mode first!
-- ============================================================================
