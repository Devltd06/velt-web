/**
 * Paystack Payment Verification API Route
 * 
 * This is a Next.js API route for verifying Paystack payments and activating
 * Signature subscriptions.
 * 
 * SETUP:
 * 1. Copy to your Next.js project: pages/api/verify-payment.ts (or app/api/verify-payment/route.ts for App Router)
 * 2. Set PAYSTACK_SECRET_KEY environment variable
 * 3. Ensure Supabase service role key is available for server-side operations
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for admin operations
);

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

// Subscription durations in days
const SUBSCRIPTION_DAYS = {
  monthly: 30,
  annual: 365,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { reference, payment_id } = req.body;

  if (!reference || !payment_id) {
    return res.status(400).json({ error: 'Missing reference or payment_id' });
  }

  try {
    // Verify payment with Paystack
    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const verifyData = await verifyResponse.json();

    if (!verifyData.status || verifyData.data.status !== 'success') {
      // Update payment record as failed
      await supabase
        .from('payments')
        .update({ status: 'failed', error_message: verifyData.message })
        .eq('id', payment_id);

      return res.status(400).json({ 
        success: false, 
        error: 'Payment verification failed' 
      });
    }

    // Payment verified successfully
    const paymentData = verifyData.data;
    const metadata = paymentData.metadata;
    const userId = metadata.user_id;
    const billingCycle = metadata.billing_cycle as 'monthly' | 'annual';
    const isRenewal = metadata.is_renewal;

    // Calculate subscription end date
    const days = SUBSCRIPTION_DAYS[billingCycle] || 30;
    let subscriptionEndDate: Date;

    if (isRenewal) {
      // For renewals, extend from current end date (if still active) or from now
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('subscription_ends_at')
        .eq('id', userId)
        .single();

      const currentEnd = currentProfile?.subscription_ends_at 
        ? new Date(currentProfile.subscription_ends_at) 
        : new Date();
      
      // If subscription hasn't expired, extend from current end date
      // Otherwise, extend from now
      const baseDate = currentEnd > new Date() ? currentEnd : new Date();
      subscriptionEndDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
    } else {
      // New subscription starts from now
      subscriptionEndDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    // Update payment record
    await supabase
      .from('payments')
      .update({
        status: 'completed',
        paystack_reference: reference,
        paystack_transaction_id: paymentData.id,
        completed_at: new Date().toISOString(),
      })
      .eq('id', payment_id);

    // Update user profile with signature status
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        is_signature: true,
        verified: true,
        subscription_ends_at: subscriptionEndDate.toISOString(),
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to activate subscription' 
      });
    }

    // Create subscription history record
    await supabase
      .from('subscription_history')
      .insert({
        user_id: userId,
        payment_id: payment_id,
        plan_type: billingCycle,
        amount: paymentData.amount,
        currency: paymentData.currency,
        start_date: new Date().toISOString(),
        end_date: subscriptionEndDate.toISOString(),
        is_renewal: isRenewal,
        paystack_reference: reference,
      });

    return res.status(200).json({ 
      success: true,
      subscription_ends_at: subscriptionEndDate.toISOString(),
    });
  } catch (error: any) {
    console.error('Payment verification error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
}
