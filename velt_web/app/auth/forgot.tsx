import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AuthLayout from '@/components/AuthLayout';
import SwipeBackContainer from '@/components/SwipeBackContainer';
import { supabase } from '@/lib/supabase';
import { useRouter, Stack } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { VELT_ACCENT } from 'app/themes';

export default function ForgotPassword() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [stage, setStage] = useState<'request' | 'verify'>('request');
  const router = withSafeRouter(useRouter());

  const sendOtp = async () => {
    if (!phone) return Alert.alert('Missing phone number');

    const { error } = await supabase.auth.signInWithOtp({ phone });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setStage('verify');
      Alert.alert('OTP Sent', 'Check your phone for the verification code.');
    }
  };

  const verifyOtpAndReset = async () => {
    if (!otp || !newPassword) {
      return Alert.alert('Missing Fields', 'OTP and new password are required.');
    }

    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    });

    if (error || !data.session) {
      return Alert.alert('Verification Failed', error?.message || 'Invalid OTP');
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      Alert.alert('Error updating password', updateError.message);
    } else {
      Alert.alert('Success', 'Password updated. Please log in.');
      router.replace('/auth/login');
    }
  };

  return (
    <SwipeBackContainer>
    <AuthLayout showTitle={false} fullScreen={true}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>Forgot Password</Text>

      <TextInput
        placeholder="Phone Number (+233XXXXXXX)"
        placeholderTextColor="#888"
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      {stage === 'verify' && (
        <>
          <TextInput
            placeholder="OTP"
            placeholderTextColor="#888"
            style={styles.input}
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
          />
          <TextInput
            placeholder="New Password"
            placeholderTextColor="#888"
            secureTextEntry
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
          />
        </>
      )}

      <TouchableOpacity
        onPress={stage === 'request' ? sendOtp : verifyOtpAndReset}
        style={styles.button}
      >
        <Text style={styles.buttonText}>
          {stage === 'request' ? 'Send OTP' : 'Reset Password'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.link}>Back to Login</Text>
      </TouchableOpacity>
      </KeyboardAvoidingView>
    </AuthLayout>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 14,
    borderRadius: 8,
    marginBottom: 14,
    color: '#000',
  },
  button: {
    backgroundColor: VELT_ACCENT,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: '#000', fontWeight: 'bold' },
  link: {
    marginTop: 20,
    textAlign: 'center',
    color: VELT_ACCENT,
  },
});
