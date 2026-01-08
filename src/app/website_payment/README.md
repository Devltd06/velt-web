# Velt Signature Website Payment Setup Guide

This folder contains all the files needed to set up Signature subscription payments on your website.
This allows users to purchase subscriptions directly on the web, bypassing Apple App Store payments.

## Files Included

| File | Description |
|------|-------------|
| `page.tsx` | Main payment page (App Router ready) |
| `signature_payment.tsx` | Reference React component for payment handling |
| `verify_payment_api.ts` | API route reference for verifying Paystack payments |
| `paystack_webhook.ts` | Webhook handler reference for Paystack events |
| `signature_schema.sql` | Database schema and functions |

## Quick Setup

### 1. Database Setup

1. Go to your Supabase Dashboard → SQL Editor
2. Copy and paste the entire contents of `signature_schema.sql`
3. Run the query

This will create:
- Payments table
- Subscription history table
- Signature pricing table (with Ghana, Nigeria, etc.)
- Helper functions for subscription management

### 2. API Routes (Already Set Up)

The API routes are already configured in the App Router structure:

```
src/app/
├── website_payment/
│   └── page.tsx              ← Main payment page
└── api/
    └── website-payment/
        ├── verify/
        │   └── route.ts      ← Payment verification API
        └── webhook/
            └── route.ts      ← Paystack webhook handler
```

### 3. Environment Variables

Add these to your `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Paystack
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_xxxx  # Use pk_live_xxxx for production
PAYSTACK_SECRET_KEY=sk_test_xxxx              # Use sk_live_xxxx for production
```

### 4. Paystack Dashboard Setup

1. Go to [Paystack Dashboard](https://dashboard.paystack.com)
2. Navigate to Settings → Webhooks
3. Add webhook URL: `https://your-domain.com/api/website-payment/webhook`
4. Select events: `charge.success`, `charge.failed`

## How to Access

Users can access the payment page via:
- Direct URL: `/website_payment`
- Profile Page: Settings → "Get Velt Signature" button
- Profile Page: "Get Signature" upgrade button (for free users)
- Profile Page: "Extend" button (for existing subscribers)

## Features

### For Users
- ✅ View subscription plans (Monthly & Annual)
- ✅ See current subscription status
- ✅ Pay with Paystack (Cards, Mobile Money, USSD)
- ✅ Renew expiring/expired subscriptions
- ✅ Automatic subscription extension for renewals

### For Your Backend
- ✅ Payment verification via Paystack API
- ✅ Webhook handling for payment events
- ✅ Automatic profile updates
- ✅ Subscription history tracking
- ✅ Country-specific pricing
- ✅ Subscription expiry handling

## Pricing Configuration

Default pricing is set in the SQL schema. To change:

```sql
-- Update Ghana pricing
UPDATE signature_pricing 
SET 
    monthly_price = 3000,  -- ₵30 in pesewas
    monthly_price_display = '₵30',
    annual_price = 36000,  -- ₵360 in pesewas
    annual_price_display = '₵360'
WHERE country_code = 'GH';

-- Add a new country
INSERT INTO signature_pricing (
    country_code, currency_code, currency_symbol,
    monthly_price, monthly_price_display,
    annual_price, annual_price_display,
    paystack_currency
) VALUES (
    'CI', 'XOF', 'CFA',
    500000, 'CFA 5,000',
    5000000, 'CFA 50,000',
    'XOF'
);
```

## Testing

1. Use Paystack test keys (`pk_test_...` and `sk_test_...`)
2. Use test card numbers from [Paystack docs](https://paystack.com/docs/payments/test-payments)
3. Test successful payment, failed payment, and webhook events

## User Flow

```
User on App                         User on Website
    │                                     │
    ├── Taps "Get Signature"              │
    │                                     │
    ├── Sees features page ──────────────>├── User visits website
    │   (No payment option)               │
    │                                     ├── Logs in with same account
    │                                     │
    │                                     ├── Goes to /signature
    │                                     │
    │                                     ├── Selects plan (Monthly/Annual)
    │                                     │
    │                                     ├── Clicks "Get Signature"
    │                                     │
    │                                     ├── Paystack popup opens
    │                                     │
    │                                     ├── Completes payment
    │                                     │
    │<── Profile updated ─────────────────├── Subscription activated
    │    (is_signature = true)            │
    │                                     │
    ├── App shows Signature badge         │
    └── Premium features unlocked         │
```

## Support

For issues with:
- **Paystack integration**: [Paystack Support](https://support.paystack.com)
- **Supabase**: [Supabase Discord](https://discord.supabase.com)
- **This implementation**: Contact your developer

---

**Important**: Always test thoroughly in Paystack test mode before going live!
