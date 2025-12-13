'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FaArrowLeft, FaEnvelope, FaPhone, FaLock, FaCheckCircle,
  FaSpinner
} from 'react-icons/fa';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

const GOLD = '#D4AF37';

type Stage = 'request' | 'verify' | 'reset' | 'success';

export default function ForgotPasswordPage() {
  const [stage, setStage] = useState<Stage>('request');
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestOTP = async () => {
    setError('');
    setLoading(true);

    try {
      if (method === 'email') {
        if (!email) {
          setError('Please enter your email');
          return;
        }
        
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/app/forgot-password?stage=reset`,
        });
        
        if (resetError) throw resetError;
        setStage('verify');
      } else {
        if (!phone) {
          setError('Please enter your phone number');
          return;
        }
        
        const { error: otpError } = await supabase.auth.signInWithOtp({ phone });
        if (otpError) throw otpError;
        setStage('verify');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      setError('Please enter the verification code');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      if (method === 'phone') {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          phone,
          token: otp,
          type: 'sms',
        });
        
        if (verifyError) throw verifyError;
      }
      setStage('reset');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid verification code';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      
      if (updateError) throw updateError;
      setStage('success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reset password';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link 
            href="/app/login" 
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <FaArrowLeft />
          </Link>
          <h1 className="text-2xl font-bold">Reset Password</h1>
        </div>

        {/* Success State */}
        {stage === 'success' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <div 
              className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
              style={{ backgroundColor: `${GOLD}20` }}
            >
              <FaCheckCircle className="text-4xl" style={{ color: GOLD }} />
            </div>
            <h2 className="text-xl font-bold mb-2">Password Reset!</h2>
            <p className="text-gray-400 mb-6">
              Your password has been successfully reset. You can now log in with your new password.
            </p>
            <Link
              href="/app/login"
              className="inline-block px-8 py-3 rounded-full font-semibold transition-all hover:scale-105"
              style={{ backgroundColor: GOLD, color: 'black' }}
            >
              Back to Login
            </Link>
          </motion.div>
        ) : (
          <>
            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {['request', 'verify', 'reset'].map((s, i) => (
                <div key={s} className="flex items-center">
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                      stage === s || ['request', 'verify', 'reset'].indexOf(stage) > i
                        ? 'text-black'
                        : 'bg-white/10 text-gray-400'
                    }`}
                    style={
                      stage === s || ['request', 'verify', 'reset'].indexOf(stage) > i
                        ? { backgroundColor: GOLD }
                        : {}
                    }
                  >
                    {i + 1}
                  </div>
                  {i < 2 && (
                    <div 
                      className={`w-12 h-0.5 mx-1 ${
                        ['request', 'verify', 'reset'].indexOf(stage) > i
                          ? ''
                          : 'bg-white/10'
                      }`}
                      style={
                        ['request', 'verify', 'reset'].indexOf(stage) > i
                          ? { backgroundColor: GOLD }
                          : {}
                      }
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6"
              >
                <p className="text-red-400 text-sm">{error}</p>
              </motion.div>
            )}

            {/* Stage: Request */}
            {stage === 'request' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <p className="text-gray-400">
                  Enter your email or phone number to receive a verification code.
                </p>

                {/* Method Toggle */}
                <div className="flex rounded-lg overflow-hidden bg-white/5">
                  <button
                    onClick={() => setMethod('email')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      method === 'email' ? 'text-black' : 'text-gray-400'
                    }`}
                    style={method === 'email' ? { backgroundColor: GOLD } : {}}
                  >
                    <FaEnvelope className="inline mr-2" />
                    Email
                  </button>
                  <button
                    onClick={() => setMethod('phone')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      method === 'phone' ? 'text-black' : 'text-gray-400'
                    }`}
                    style={method === 'phone' ? { backgroundColor: GOLD } : {}}
                  >
                    <FaPhone className="inline mr-2" />
                    Phone
                  </button>
                </div>

                {method === 'email' ? (
                  <div className="relative">
                    <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/10 rounded-lg py-3 pl-12 pr-4 focus:outline-none focus:ring-2 transition-all"
                      style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <FaPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      placeholder="Enter phone number (+233...)"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-white/10 rounded-lg py-3 pl-12 pr-4 focus:outline-none focus:ring-2 transition-all"
                      style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                    />
                  </div>
                )}

                <button
                  onClick={handleRequestOTP}
                  disabled={loading}
                  className="w-full py-3 rounded-lg font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  style={{ backgroundColor: GOLD, color: 'black' }}
                >
                  {loading ? (
                    <FaSpinner className="animate-spin mx-auto" />
                  ) : (
                    'Send Verification Code'
                  )}
                </button>
              </motion.div>
            )}

            {/* Stage: Verify */}
            {stage === 'verify' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <p className="text-gray-400">
                  {method === 'email' 
                    ? `We've sent a verification link to ${email}. Check your inbox and click the link.`
                    : `Enter the 6-digit code sent to ${phone}`
                  }
                </p>

                {method === 'phone' && (
                  <>
                    <div className="flex justify-center gap-2">
                      {[...Array(6)].map((_, i) => (
                        <input
                          key={i}
                          type="text"
                          maxLength={1}
                          value={otp[i] || ''}
                          onChange={(e) => {
                            const newOtp = otp.split('');
                            newOtp[i] = e.target.value;
                            setOtp(newOtp.join(''));
                            if (e.target.value && e.target.nextElementSibling) {
                              (e.target.nextElementSibling as HTMLInputElement).focus();
                            }
                          }}
                          className="w-12 h-14 bg-white/10 rounded-lg text-center text-xl font-bold focus:outline-none focus:ring-2 transition-all"
                          style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                        />
                      ))}
                    </div>

                    <button
                      onClick={handleVerifyOTP}
                      disabled={loading || otp.length < 6}
                      className="w-full py-3 rounded-lg font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                      style={{ backgroundColor: GOLD, color: 'black' }}
                    >
                      {loading ? (
                        <FaSpinner className="animate-spin mx-auto" />
                      ) : (
                        'Verify Code'
                      )}
                    </button>
                  </>
                )}

                <button
                  onClick={() => setStage('request')}
                  className="w-full py-3 rounded-lg font-medium text-gray-400 hover:text-white transition-colors"
                >
                  Didn&apos;t receive it? Try again
                </button>
              </motion.div>
            )}

            {/* Stage: Reset */}
            {stage === 'reset' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <p className="text-gray-400">
                  Create a new password for your account.
                </p>

                <div className="space-y-4">
                  <div className="relative">
                    <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-white/10 rounded-lg py-3 pl-12 pr-4 focus:outline-none focus:ring-2 transition-all"
                      style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                    />
                  </div>
                  
                  <div className="relative">
                    <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-white/10 rounded-lg py-3 pl-12 pr-4 focus:outline-none focus:ring-2 transition-all"
                      style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                    />
                  </div>
                </div>

                <button
                  onClick={handleResetPassword}
                  disabled={loading}
                  className="w-full py-3 rounded-lg font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  style={{ backgroundColor: GOLD, color: 'black' }}
                >
                  {loading ? (
                    <FaSpinner className="animate-spin mx-auto" />
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
