-- Support Messages Table
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  feedback_type VARCHAR(50) NOT NULL, -- feedback, bug, complaint, suggestion, other
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'new', -- new, read, in-progress, resolved
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_support_email ON support_messages(email);
CREATE INDEX IF NOT EXISTS idx_support_status ON support_messages(status);
CREATE INDEX IF NOT EXISTS idx_support_created_at ON support_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_type ON support_messages(feedback_type);

-- Enable RLS
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert
CREATE POLICY "Anyone can submit support message"
  ON support_messages
  FOR INSERT
  WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_support_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER support_update_timestamp
  BEFORE UPDATE ON support_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_support_timestamp();

---

-- Investor Info Table
CREATE TABLE IF NOT EXISTS company_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name VARCHAR(255) NOT NULL UNIQUE,
  metric_value VARCHAR(255) NOT NULL,
  metric_type VARCHAR(50), -- revenue, profit, valuation, billboards, etc
  period VARCHAR(50), -- monthly, yearly, ytd, projection
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_metrics_name ON company_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_type ON company_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_updated ON company_metrics(last_updated DESC);

-- Enable RLS
ALTER TABLE company_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view metrics
CREATE POLICY "Anyone can view company metrics"
  ON company_metrics
  FOR SELECT
  WITH CHECK (true);

-- Insert initial metrics (you can update these values)
INSERT INTO company_metrics (metric_name, metric_value, metric_type, period) VALUES
  ('Monthly Revenue', 'GHS 2.4M', 'revenue', 'monthly'),
  ('Net Profit', 'GHS 840K', 'profit', 'monthly'),
  ('Company Valuation', 'GHS 180M', 'valuation', 'current'),
  ('Active Billboards', '450+', 'billboards', 'current'),
  ('Total Revenue YTD', 'GHS 18.2M', 'revenue', 'ytd'),
  ('Operating Expenses', 'GHS 8.8M', 'expenses', 'ytd'),
  ('EBITDA', 'GHS 9.4M', 'profit', 'ytd'),
  ('Cash Runway', '18+ months', 'cash', 'current'),
  ('User Growth', '+18%', 'growth', 'monthly'),
  ('Billboard Expansion', '+25 per month', 'growth', 'monthly'),
  ('Customer Retention', '92%', 'retention', 'current'),
  ('Market Penetration', '8% of market', 'market', 'current'),
  ('Projected Revenue', 'GHS 32.4M', 'revenue', 'projection'),
  ('Projected Profit', 'GHS 14.7M', 'profit', 'projection'),
  ('Projected Valuation', 'GHS 320M', 'valuation', 'projection')
ON CONFLICT (metric_name) DO UPDATE SET
  metric_value = EXCLUDED.metric_value,
  last_updated = NOW();
