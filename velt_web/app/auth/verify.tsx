import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useColorScheme,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import SwipeBackContainer from '@/components/SwipeBackContainer';
import AuthLayout from '@/components/AuthLayout';
import { Stack } from 'expo-router';
import { useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { VELT_ACCENT } from 'app/themes';

export default function VerifyScreen() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const router = withSafeRouter(useRouter());
  const dark = useColorScheme() === 'dark';

  const handleVerify = async () => {
    if (!phone || !otp) {
      Alert.alert('Missing Info', 'Please enter both phone number and code.');
      return;
    }

    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    });

    if (error) {
      Alert.alert('Verification Failed', error.message);
    } else {
      Alert.alert('Verified!', 'You have successfully logged in.');
      router.replace('/(tabs)/home');
    }
  };

  return (
    <SwipeBackContainer>
    <AuthLayout showTitle={false} fullScreen={true}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { backgroundColor: dark ? '#000000ff' : '#fff' },
          ]}
          keyboardShouldPersistTaps="handled"
        >
        <Text style={[styles.title, { color: dark ? '#fff' : '#000' }]}>
          Verify Your Phone
        </Text>

        <TextInput
          placeholder="Phone number (e.g. +233...)"
          placeholderTextColor="#888"
          value={phone}
          onChangeText={setPhone}
          style={[styles.input, { color: dark ? '#fff' : '#000' }]}
          keyboardType="phone-pad"
        />

        <TextInput
          placeholder="Verification Code"
          placeholderTextColor="#888"
          value={otp}
          onChangeText={setOtp}
          style={[styles.input, { color: dark ? '#fff' : '#000' }]}
          keyboardType="numeric"
        />

        <TouchableOpacity onPress={handleVerify} style={styles.button}>
          <Text style={styles.buttonText}>Verify</Text>
        </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthLayout>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingTop: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  input: {
    width: '100%',
    borderBottomWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  button: {
    backgroundColor: VELT_ACCENT,
    padding: 16,
    borderRadius: 8,
    width: '100%',
    marginTop: 20,
  },
  buttonText: {
    color: '#000',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 16,
  },
});

