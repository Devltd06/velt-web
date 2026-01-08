/**
 * Velt Signature Payment Page
 * 
 * This is a React/Next.js page component for handling Signature subscription payments
 * on your website. It integrates with Paystack for payment processing and Supabase
 * for user authentication and subscription management.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Copy this file to your Next.js website project (e.g., pages/signature.tsx or app/signature/page.tsx)
 * 2. Install required dependencies: npm install @supabase/supabase-js
 * 3. Set up environment variables (see below)
 * 4. Run the SQL migrations in signature_schema.sql
 * 5. Configure Paystack webhook to point to your /api/paystack-webhook endpoint
 * 
 * ENVIRONMENT VARIABLES NEEDED:
 * - NEXT_PUBLIC_SUPABASE_URL: Your Supabase project URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Your Supabase anon key
 * - NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: Your Paystack public key
 * - PAYSTACK_SECRET_KEY: Your Paystack secret key (server-side only)
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Paystack public key
const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!;

// Pricing configuration
const PRICING = {
  monthly: {
    amount: 2500, // Amount in pesewas (25 GHS)
    display: '₵25',
    period: 'month',
    days: 30,
  },
  annual: {
    amount: 30000, // Amount in pesewas (300 GHS)
    display: '₵300',
    period: 'year',
    days: 365,
    savings: '2 months free',
  },
};

// Country-specific pricing (can be fetched from Supabase)
interface PricingData {
  country_code: string;
  currency_code: string;
  currency_symbol: string;
  monthly_price: number;
  monthly_price_display: string;
  signature_price: number;
  signature_price_display: string;
  paystack_currency: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  is_signature: boolean;
  verified: boolean;
  subscription_ends_at: string | null;
}

export default function SignaturePaymentPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check authentication and load user profile
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        
        if (authError || !session) {
          // Redirect to login if not authenticated
          window.location.href = '/login?redirect=/signature';
          return;
        }

        setUser(session.user);

        // Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, full_name, username, is_signature, verified, subscription_ends_at')
          .eq('id', session.user.id)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          setError('Failed to load your profile. Please try again.');
        } else {
          setProfile(profileData);
        }

        // Fetch country-specific pricing
        await fetchPricing();
      } catch (err) {
        console.error('Auth check error:', err);
        setError('An error occurred. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        window.location.href = '/login';
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch pricing based on user's country
  const fetchPricing = async () => {
    try {
      // Try to get user's country from their profile or use default
      const countryCode = 'GH'; // Default to Ghana, can be detected via IP or user preference
      
      const { data, error } = await supabase.rpc('get_signature_pricing', {
        p_country_code: countryCode
      });

      if (error) throw error;
      setPricing(data);
    } catch (err) {
      console.warn('Error fetching pricing, using defaults:', err);
      // Fallback to default Ghana pricing
      setPricing({
        country_code: 'GH',
        currency_code: 'GHS',
        currency_symbol: '₵',
        monthly_price: 2500,
        monthly_price_display: '₵25',
        signature_price: 30000,
        signature_price_display: '₵300',
        paystack_currency: 'GHS',
      });
    }
  };

  // Initialize Paystack payment
  const initializePayment = useCallback(async () => {
    if (!profile || !pricing) return;
    
    setPaymentLoading(true);
    setError(null);

    try {
      const amount = billingCycle === 'monthly' 
        ? pricing.monthly_price 
        : pricing.signature_price;
      
      const currency = pricing.paystack_currency || 'GHS';
      const isRenewal = profile.is_signature || profile.verified;

      // Create payment record in database
      const { data: paymentRecord, error: paymentError } = await supabase
        .from('payments')
        .insert({
          user_id: profile.id,
          amount: amount,
          currency: currency,
          status: 'pending',
          payment_type: isRenewal ? 'renewal' : 'subscription',
          metadata: {
            type: 'signature_subscription',
            product: 'Velt Signature',
            billing_cycle: billingCycle,
            country_code: pricing.country_code,
            is_renewal: isRenewal,
          }
        })
        .select('id')
        .single();

      if (paymentError) {
        throw new Error('Failed to create payment record');
      }

      // Initialize Paystack
      const handler = (window as any).PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: profile.email,
        amount: amount,
        currency: currency,
        ref: `velt_sig_${paymentRecord.id}_${Date.now()}`,
        metadata: {
          user_id: profile.id,
          payment_id: paymentRecord.id,
          billing_cycle: billingCycle,
          is_renewal: isRenewal,
          custom_fields: [
            {
              display_name: 'Product',
              variable_name: 'product',
              value: 'Velt Signature'
            },
            {
              display_name: 'Plan',
              variable_name: 'plan',
              value: billingCycle === 'monthly' ? 'Monthly' : 'Annual'
            }
          ]
        },
        callback: async (response: any) => {
          // Payment successful - verify on server
          await verifyPayment(response.reference, paymentRecord.id);
        },
        onClose: () => {
          setPaymentLoading(false);
          // Update payment status to cancelled if user closes
          supabase
            .from('payments')
            .update({ status: 'cancelled' })
            .eq('id', paymentRecord.id)
            .then(() => {});
        },
      });

      handler.openIframe();
    } catch (err: any) {
      console.error('Payment initialization error:', err);
      setError(err.message || 'Failed to initialize payment. Please try again.');
      setPaymentLoading(false);
    }
  }, [profile, pricing, billingCycle]);

  // Verify payment on server
  const verifyPayment = async (reference: string, paymentId: string) => {
    try {
      // Call your API endpoint to verify the payment
      const response = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reference,
          payment_id: paymentId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Payment successful! Your Signature subscription is now active.');
        // Refresh profile to show updated status
        const { data: updatedProfile } = await supabase
          .from('profiles')
          .select('id, email, full_name, username, is_signature, verified, subscription_ends_at')
          .eq('id', profile!.id)
          .single();
        
        if (updatedProfile) {
          setProfile(updatedProfile);
        }
      } else {
        throw new Error(result.error || 'Payment verification failed');
      }
    } catch (err: any) {
      console.error('Payment verification error:', err);
      setError(err.message || 'Payment verification failed. Please contact support.');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Calculate subscription end date
  const getSubscriptionEndDate = () => {
    if (!profile?.subscription_ends_at) return null;
    return new Date(profile.subscription_ends_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Check if subscription is expiring soon (within 7 days)
  const isExpiringSoon = () => {
    if (!profile?.subscription_ends_at) return false;
    const endDate = new Date(profile.subscription_ends_at);
    const now = new Date();
    const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 7 && daysLeft > 0;
  };

  // Check if subscription has expired
  const isExpired = () => {
    if (!profile?.subscription_ends_at) return false;
    return new Date(profile.subscription_ends_at) < new Date();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  const isSubscribed = profile?.is_signature || profile?.verified;

  return (
    <>
      {/* Paystack Script */}
      <script src="https://js.paystack.co/v1/inline.js" async></script>
      
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <header className="bg-gray-800/50 backdrop-blur-lg border-b border-gray-700">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <a href="/" className="text-xl font-bold text-amber-500">Velt</a>
            <div className="flex items-center gap-4">
              <span className="text-gray-400 text-sm">{profile?.email}</span>
              <button 
                onClick={() => supabase.auth.signOut()}
                className="text-sm text-gray-400 hover:text-white transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8">
          {/* Error/Success Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400">
              {success}
            </div>
          )}

          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full mb-6">
              <svg className="w-10 h-10 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold mb-4">Velt Signature</h1>
            <p className="text-xl text-gray-400">Unlock the full Velt experience</p>
          </div>

          {/* Current Status */}
          {isSubscribed && (
            <div className={`mb-8 p-6 rounded-xl ${isExpired() ? 'bg-red-500/20 border border-red-500/50' : isExpiringSoon() ? 'bg-amber-500/20 border border-amber-500/50' : 'bg-green-500/20 border border-green-500/50'}`}>
              <div className="flex items-center gap-3 mb-2">
                <svg className={`w-6 h-6 ${isExpired() ? 'text-red-400' : 'text-green-400'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-lg font-semibold">
                  {isExpired() ? 'Subscription Expired' : isExpiringSoon() ? 'Subscription Expiring Soon' : 'Signature Active'}
                </span>
              </div>
              {profile?.subscription_ends_at && (
                <p className="text-gray-400">
                  {isExpired() ? 'Expired on' : 'Active until'} {getSubscriptionEndDate()}
                </p>
              )}
              {(isExpired() || isExpiringSoon()) && (
                <p className="mt-2 text-amber-400 font-medium">Renew now to continue enjoying premium features!</p>
              )}
            </div>
          )}

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* Monthly Plan */}
            <div 
              onClick={() => setBillingCycle('monthly')}
              className={`relative p-6 rounded-xl cursor-pointer transition-all ${
                billingCycle === 'monthly' 
                  ? 'bg-gray-800 border-2 border-amber-500' 
                  : 'bg-gray-800/50 border border-gray-700 hover:border-gray-600'
              }`}
            >
              {billingCycle === 'monthly' && (
                <div className="absolute -top-3 -right-3 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <h3 className="text-lg font-semibold text-gray-300 mb-2">Monthly</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold">
                  {pricing?.monthly_price_display || '₵25'}
                </span>
                <span className="text-gray-400">/month</span>
              </div>
              <p className="mt-4 text-gray-400 text-sm">Billed monthly. Cancel anytime.</p>
            </div>

            {/* Annual Plan */}
            <div 
              onClick={() => setBillingCycle('annual')}
              className={`relative p-6 rounded-xl cursor-pointer transition-all ${
                billingCycle === 'annual' 
                  ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/20 border-2 border-amber-500' 
                  : 'bg-gray-800/50 border border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-500 rounded-full text-xs font-bold text-white">
                BEST VALUE
              </div>
              {billingCycle === 'annual' && (
                <div className="absolute -top-3 -right-3 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <h3 className="text-lg font-semibold text-gray-300 mb-2">Annual</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold">
                  {pricing?.signature_price_display || '₵300'}
                </span>
                <span className="text-gray-400">/year</span>
              </div>
              <p className="mt-4 text-green-400 text-sm font-medium">Save 2 months free!</p>
            </div>
          </div>

          {/* Features List */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">What's Included</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { icon: '🎨', title: 'Premium Themes', desc: 'Access exclusive gradient themes' },
                { icon: '✓', title: 'Verification Badge', desc: 'Get verified across the app' },
                { icon: '👋', title: 'Custom Greeting', desc: 'Personalize your home screen' },
                { icon: '📱', title: 'Tab Customization', desc: 'Customize your navigation' },
                { icon: '⚡', title: 'Priority Support', desc: 'Get faster responses' },
                { icon: '🚀', title: 'Early Access', desc: 'Try new features first' },
              ].map((feature) => (
                <div key={feature.title} className="flex items-start gap-3 p-4 bg-gray-800/50 rounded-lg">
                  <span className="text-2xl">{feature.icon}</span>
                  <div>
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="text-gray-400 text-sm">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Button */}
          <div className="text-center">
            <button
              onClick={initializePayment}
              disabled={paymentLoading}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-gray-900 font-bold text-lg rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {paymentLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-900 border-t-transparent"></div>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {isSubscribed && !isExpired() ? 'Extend Subscription' : isExpired() ? 'Renew Subscription' : 'Get Signature'}
                </>
              )}
            </button>
            <p className="mt-4 text-gray-500 text-sm">
              Secure payment powered by Paystack
            </p>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-800 mt-16 py-8">
          <div className="max-w-4xl mx-auto px-4 text-center text-gray-500 text-sm">
            <p>© {new Date().getFullYear()} Velt. All rights reserved.</p>
            <div className="mt-2 flex items-center justify-center gap-4">
              <a href="/terms" className="hover:text-white transition">Terms</a>
              <a href="/privacy" className="hover:text-white transition">Privacy</a>
              <a href="/support" className="hover:text-white transition">Support</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
