/**
 * Paystack Webhook Handler
 * 
 * This handles webhook events from Paystack for subscription-related events.
 * Essential for handling failed renewals, subscription cancellations, etc.
 * 
 * SETUP:
 * 1. Copy to your Next.js project: pages/api/paystack-webhook.ts
 * 2. Configure Paystack Dashboard to send webhooks to: https://yourdomain.com/api/paystack-webhook
 * 3. Set PAYSTACK_SECRET_KEY environment variable
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify webhook signature
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;

  try {
    switch (event.event) {
      case 'charge.success':
        // Payment successful - this is also handled by verify-payment API
        // but this ensures we catch payments even if user closes browser
        await handleChargeSuccess(event.data);
        break;

      case 'charge.failed':
        // Payment failed
        await handleChargeFailed(event.data);
        break;

      case 'subscription.disable':
        // Subscription cancelled
        await handleSubscriptionDisabled(event.data);
        break;

      case 'transfer.success':
        // For future: handle creator payouts
        break;

      default:
        console.log('Unhandled webhook event:', event.event);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function handleChargeSuccess(data: any) {
  const { reference, metadata, amount, currency } = data;
  
  if (!metadata?.user_id) return;

  const userId = metadata.user_id;
  const billingCycle = metadata.billing_cycle as 'monthly' | 'annual';
  const isRenewal = metadata.is_renewal;

  // Check if we already processed this payment
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('status')
    .eq('paystack_reference', reference)
    .single();

  if (existingPayment?.status === 'completed') {
    console.log('Payment already processed:', reference);
    return;
  }

  // Calculate subscription end date
  const days = billingCycle === 'annual' ? 365 : 30;
  let subscriptionEndDate: Date;

  if (isRenewal) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_ends_at')
      .eq('id', userId)
      .single();

    const currentEnd = profile?.subscription_ends_at 
      ? new Date(profile.subscription_ends_at) 
      : new Date();
    
    const baseDate = currentEnd > new Date() ? currentEnd : new Date();
    subscriptionEndDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
  } else {
    subscriptionEndDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  // Update profile
  await supabase
    .from('profiles')
    .update({
      is_signature: true,
      verified: true,
      subscription_ends_at: subscriptionEndDate.toISOString(),
    })
    .eq('id', userId);

  // Update or create payment record
  const { data: payment } = await supabase
    .from('payments')
    .select('id')
    .eq('paystack_reference', reference)
    .single();

  if (payment) {
    await supabase
      .from('payments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', payment.id);
  } else {
    await supabase
      .from('payments')
      .insert({
        user_id: userId,
        amount: amount,
        currency: currency,
        status: 'completed',
        paystack_reference: reference,
        payment_type: isRenewal ? 'renewal' : 'subscription',
        completed_at: new Date().toISOString(),
        metadata: metadata,
      });
  }

  // Create subscription history
  await supabase
    .from('subscription_history')
    .insert({
      user_id: userId,
      plan_type: billingCycle,
      amount: amount,
      currency: currency,
      start_date: new Date().toISOString(),
      end_date: subscriptionEndDate.toISOString(),
      is_renewal: isRenewal,
      paystack_reference: reference,
    });

  console.log('Subscription activated for user:', userId);
}

async function handleChargeFailed(data: any) {
  const { reference, metadata } = data;
  
  if (!metadata?.payment_id) return;

  await supabase
    .from('payments')
    .update({
      status: 'failed',
      error_message: data.gateway_response || 'Payment failed',
    })
    .eq('id', metadata.payment_id);

  console.log('Payment failed:', reference);
}

async function handleSubscriptionDisabled(data: any) {
  // Handle subscription cancellation if using Paystack subscriptions
  const { customer } = data;
  
  // Find user by email
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', customer.email)
    .single();

  if (profile) {
    // Don't remove signature immediately - let it expire naturally
    console.log('Subscription cancelled for user:', profile.id);
  }
}

// Disable body parser for webhooks
export const config = {
  api: {
    bodyParser: true,
  },
};
