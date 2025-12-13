// File: app/auth/legal/terms.tsx

import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SwipeBackContainer from '@/components/SwipeBackContainer';

export default function TermsScreen() {
  return (
    <SwipeBackContainer>
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'left', 'right', 'bottom']}>
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Terms & Conditions – Velt</Text>
      <Text style={styles.date}>Effective Date: July 22, 2025</Text>

      <Text style={styles.paragraph}>
        Welcome to Velt, a mobile application designed to function as a marketplace, social network, and productivity platform.
        By accessing or using Velt, you agree to the following Terms & Conditions. Please read them carefully before using our services.
      </Text>

      <Text style={styles.sectionTitle}>1. Eligibility</Text>
      <Text style={styles.paragraph}>
        Velt is intended for individuals who are at least 18 years of age. By registering or using this application,
        you confirm that you meet this requirement and that any information provided during registration is accurate and complete.
      </Text>

      <Text style={styles.sectionTitle}>2. Account Creation and Responsibility</Text>
      <Text style={styles.paragraph}>
        To access most features, you must create a personal account. You are solely responsible for safeguarding your login credentials
        and for all activity that occurs under your account. Velt is not responsible for unauthorized access due to your failure to secure your account.
      </Text>

      <Text style={styles.sectionTitle}>3. User Roles and Features</Text>
      <Text style={styles.paragraph}>
        Velt allows users to create content, interact with others, participate in marketplaces, and use productivity tools.
        These features are similar to platforms like Instagram or Facebook. Users may post media, messages, join groups, and list or buy services or items.
      </Text>

      <Text style={styles.sectionTitle}>4. Prohibited Conduct</Text>
      <Text style={styles.paragraph}>
        Users must not:
        {"\n"}• Post offensive, illegal, or harmful content
        {"\n"}• Harass, threaten, impersonate, or defame others
        {"\n"}• Violate intellectual property or community guidelines
        {"\n"}• Engage in spam, fraud, or any unlawful activity
        {"\n"}Violation may result in suspension or permanent account termination.
      </Text>

      <Text style={styles.sectionTitle}>5. Content Ownership</Text>
      <Text style={styles.paragraph}>
        You retain full ownership of content you upload. However, by posting on Velt, you grant us a non-exclusive, worldwide,
        royalty-free license to host, display, and share your content in order to operate, promote, and improve the app.
      </Text>

      <Text style={styles.sectionTitle}>6. Payments and Refunds</Text>
      <Text style={styles.paragraph}>
        Some premium features within Velt may require payment. All transactions are final and non-refundable, except where required by law.
      </Text>

      <Text style={styles.sectionTitle}>7. Termination</Text>
      <Text style={styles.paragraph}>
        We may suspend or terminate your access to Velt at our sole discretion if you violate these Terms or use the app in a manner that could harm the platform or its users.
      </Text>

      <Text style={styles.sectionTitle}>8. Modifications to Terms</Text>
      <Text style={styles.paragraph}>
        We may update these Terms & Conditions from time to time. Continued use of Velt following updates signifies your acceptance of the revised terms.
      </Text>

      <Text style={styles.sectionTitle}>9. Contact Us</Text>
      <Text style={styles.paragraph}>For any questions regarding these Terms, contact us at atmosdevltd@gmail.com.</Text>
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
