Manual payment verification / sanity-check
=====================================

Purpose
-------
This file contains a set of quick manual checks and a small helper script to verify the new payment -> verify -> server-side order flow locally or against a deployed Supabase project.

Prerequisites
-------------
- You must have the Supabase Service Role key and the URL available as environment variables: SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL.
- The supabase function endpoints (paystack-init and paystack-complete) should be deployed and reachable. You also need a valid user JWT to call the endpoints (or use the service role key where appropriate).
 - The supabase function endpoints (paystack-init and paystack-complete) should be deployed and reachable. You also need a valid user JWT to call the endpoints (or use the service role key where appropriate).
 - Important: this app defaults to Ghana cedi (GHS). Make sure your Paystack merchant account is configured to accept GHS transactions. If Paystack responds with a "currency not supported" error, update your merchant account to enable GHS or change the app configuration (not recommended for production) to a supported currency.

Quick DB checks (psql)
----------------------
Run these queries in your Supabase SQL editor or via psql to inspect the payments table and orders:

-- look for most recent payments
SELECT * FROM public.payments ORDER BY created_at DESC LIMIT 20;

-- check payment metadata for cart snapshot and order ids
SELECT id, reference, status, metadata->>'order_ids' AS order_ids FROM public.payments WHERE id = '<PAYMENT_ID>';

-- inspect orders created for a payment
SELECT * FROM public.orders WHERE id IN (SELECT jsonb_array_elements_text(metadata -> 'order_ids')::uuid FROM public.payments WHERE id = '<PAYMENT_ID>');


Manual function calls (curl)
----------------------------
Replace placeholders before running.

# 1) Initialize (simulate client sending cart snapshot)
curl -X POST "https://<YOUR_FUNCTIONS_HOST>/paystack-init" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100.00, "email": "you@example.com", "cartItems": [{"product_id": "<product-uuid>", "quantity": 1, "unit_price": 100.00, "seller_id": "<seller-uuid>", "cart_id": "<cart-uuid>"}], "shipping_address_id": "<address-uuid>"}'

# The function should return data.authorization_url and data.reference. Note the reference.

# 2) Verify (server-side) - call paystack-complete with the reference
curl -X POST "https://<YOUR_FUNCTIONS_HOST>/paystack-complete" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"reference": "<PAYSTACK_REFERENCE>"}'

# If the payment is 'success' (Paystack) or if you simulate the verify response, the function should:
# - update the payments row status to 'paid'
# - create one or more order rows and corresponding order_items
# - update the payment metadata with order_ids so repeated verify calls don't duplicate orders


Local helper script (node)
--------------------------
Create a small local script to call the verify endpoint for debugging. Save this file as `local_verify_test.js` and run with node.

```js
// local_verify_test.js
const fetch = require('node-fetch');
const FUNCTION_URL = process.env.FUNCTION_URL; // e.g. https://.../paystack-complete
const AUTH_JWT = process.env.AUTH_JWT; // user JWT or service role bearer

if (!FUNCTION_URL || !AUTH_JWT) {
  console.error('set FUNCTION_URL and AUTH_JWT env vars');
  process.exit(1);
}

const reference = process.argv[2];
if (!reference) {
  console.error('usage: node local_verify_test.js <reference>');
  process.exit(1);
}

async function main() {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    body: JSON.stringify({ reference }),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AUTH_JWT}` },
  });
  const body = await res.text();
  console.log('status', res.status, 'body', body);
}

main().catch((err) => console.error(err));
```

How to use
----------
1. Deploy or have the functions available.
2. Run the init call from your app and note the returned payment reference.
3. Use the node helper or curl to call the verify endpoint with that reference.
4. Check the payments and orders tables in Supabase to confirm updates.

If orders are missing after verify, check function logs and ensure functions have the SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL configured so they can write to the DB.
