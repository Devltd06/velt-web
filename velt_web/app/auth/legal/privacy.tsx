// File: app/auth/legal/privacy.tsx

import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SwipeBackContainer from '@/components/SwipeBackContainer';

export default function PrivacyPolicyScreen() {
  return (
    <SwipeBackContainer>
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'left', 'right', 'bottom']}>
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Privacy Policy – Velt</Text>
      <Text style={styles.date}>Effective Date: July 22, 2025</Text>

      <Text style={styles.paragraph}>
        Your privacy is important to us. This Privacy Policy explains how Velt collects, uses, and protects your personal data.
      </Text>

      <Text style={styles.sectionTitle}>1. Information We Collect</Text>
      <Text style={styles.paragraph}>
        We collect information similar to other social platforms like Instagram, including:
        {"\n"}• Profile details (name, email, phone number, profile photo)
        {"\n"}• Content (posts, photos, messages)
        {"\n"}• Location (via Google Maps)
        {"\n"}• Device and usage data
        {"\n"}• Analytics (interaction behavior)
      </Text>

      <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
      <Text style={styles.paragraph}>
        We use your information to:
        {"\n"}• Manage your account
        {"\n"}• Provide and personalize app features
        {"\n"}• Display your content to other users
        {"\n"}• Conduct analytics and improve our services
        {"\n"}• Ensure security and prevent fraud
      </Text>

      <Text style={styles.sectionTitle}>3. Sharing of Information</Text>
      <Text style={styles.paragraph}>
        We may share your data with third-party service providers such as:
        {"\n"}• Supabase (authentication and data storage)
        {"\n"}• ChatGPT (AI assistance)
        {"\n"}• Google Maps (location services)
        {"\n"}We do not sell your personal data to third parties.
      </Text>

      <Text style={styles.sectionTitle}>4. Data Storage & Security</Text>
      <Text style={styles.paragraph}>
        Your data is stored on your device and on encrypted Supabase cloud servers. We use industry-standard security practices,
        including encryption and access control, to safeguard your information.
      </Text>

      <Text style={styles.sectionTitle}>5. Your Rights</Text>
      <Text style={styles.paragraph}>
        You have the right to:
        {"\n"}• Access your data
        {"\n"}• Request correction or deletion
        {"\n"}• Withdraw consent and deactivate your account
        {"\n"}To exercise these rights, email us at atmosdevltd@gmail.com.
      </Text>

      <Text style={styles.sectionTitle}>6. Age Restriction</Text>
      <Text style={styles.paragraph}>
        Velt is not intended for individuals under the age of 18. We do not knowingly collect or process personal data from users under 18 years of age.
      </Text>

      <Text style={styles.sectionTitle}>7. Policy Updates</Text>
      <Text style={styles.paragraph}>
        We may revise this Privacy Policy from time to time. You will be notified of any material changes, and continued use of the app indicates your acceptance of such changes.
      </Text>
    </ScrollView>
    </SafeAreaView>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff', paddingBottom: 100 },
  heading: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  date: { fontSize: 14, color: '#888', marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 6 },
  paragraph: { fontSize: 14, lineHeight: 20, color: '#333' },
});
