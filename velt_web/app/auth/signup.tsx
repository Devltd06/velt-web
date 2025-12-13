import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Animated, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import SwipeBackContainer from '@/components/SwipeBackContainer';
import { useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { VELT_ACCENT, BUTTON_COLORS, GRADIENTS } from 'app/themes';

export default function SignupScreen() {
  const router = withSafeRouter(useRouter());

  // Animation vibe (similar to welcome/login)
  const dark = true;
  const brandLight: [string, string] = GRADIENTS.accent as [string, string];
  const brandDark: [string, string] = ['#0a0a0a', VELT_ACCENT];
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(titleOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 6 })
    ]).start();
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setLoading(true);
    try {
      if (!email || !password || !name) {
        Alert.alert('Error', 'Please fill all fields');
        return;
      }
      // Supabase signup with email confirmation
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: 'https://yourapp.com/auth/verify', // Change to your app's verify URL
        },
      });
      if (error) throw error;
      Alert.alert('Check your email', 'A confirmation link has been sent to your email.');
      router.push('/auth/login');
    } catch (e) {
      const error = e as Error;
      Alert.alert('Signup failed', error.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SwipeBackContainer>
    <SafeAreaView style={{ flex: 1, backgroundColor: dark ? '#000' : '#fff' }} edges={['top', 'left', 'right', 'bottom']}>
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={[styles.container, { backgroundColor: 'transparent' }] }>
          <Animated.View style={{ alignItems: 'center', marginBottom: 24, opacity: titleOpacity }}>
            <Animated.Text style={[styles.title, { transform: [{ scale: logoScale }] }]}>Sign Up</Animated.Text>
            <Text style={[styles.subtitle, { color: dark ? 'rgba(255,255,255,0.85)' : 'rgba(7,17,51,0.75)' }]}>Create your account</Text>
          </Animated.View>
          <View style={{ width: '100%' }}>
            <TextInput
              style={styles.input}
              placeholder="Name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              placeholderTextColor="#aaa"
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#aaa"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor="#aaa"
            />
            <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
              <LinearGradient colors={dark ? brandDark : brandLight} start={[0,0]} end={[1,1]} style={{ borderRadius: 8, width: '100%', height: 48, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={styles.buttonText}>{loading ? 'Signing up...' : 'Sign Up'}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/auth/login')}>
              <Text style={styles.link}>Already have an account? Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
    </SafeAreaView>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 18,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 48,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    fontSize: 16,
    color: '#fff', // Make input text white
    backgroundColor: '#222', // Optional: darken input background for contrast
  },
  button: {
    width: '100%',
    height: 48,
    backgroundColor: VELT_ACCENT,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  link: {
    color: VELT_ACCENT,
    fontSize: 16,
    marginTop: 8,
  },
});
