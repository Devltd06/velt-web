// File: src/app/privacy/page.tsx
import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <main style={{ padding: '40px', maxWidth: '900px', margin: '0 auto', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '10px' }}>
        Privacy Policy – Velt
      </h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>Effective Date: July 22, 2025</p>

      <p>
        Your privacy is important to us. This Privacy Policy explains how Velt collects, uses, and protects your personal data.
      </p>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '30px', marginBottom: '10px' }}>
        1. Information We Collect
      </h2>
      <p>
        We collect information similar to other social platforms like Instagram, including:
        <h2 style={{ paddingLeft: '20px', marginTop: '10px' }}>
          <li>Profile details (name, email, phone number, profile photo)</li>
          <li>Content (posts, photos, messages)</li>
          <li>Location (via Google Maps)</li>
          <li>Device and usage data</li>
          <li>Analytics (interaction behavior)</li>
        </h2>
      </p>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '30px', marginBottom: '10px' }}>
        2. How We Use Your Information
      </h2>
      <p>
        We use your information to:
        <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
          <li>Manage your account</li>
          <li>Provide and personalize app features</li>
          <li>Display your content to other users</li>
          <li>Conduct analytics and improve our services</li>
          <li>Ensure security and prevent fraud</li>
        </ul>
      </p>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '30px', marginBottom: '10px' }}>
        3. Sharing of Information
      </h2>
      <p>
        We may share your data with third-party service providers such as:
        <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
          <li>Supabase (authentication and data storage)</li>
          <li>ChatGPT (AI assistance)</li>
          <li>Google Maps (location services)</li>
        </ul>
        We do not sell your personal data to third parties.
      </p>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '30px', marginBottom: '10px' }}>
        4. Data Storage & Security
      </h2>
      <p>
        Your data is stored on your device and on encrypted Supabase cloud servers. We use industry-standard security practices,
        including encryption and access control, to safeguard your information.
      </p>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '30px', marginBottom: '10px' }}>
        5. Your Rights
      </h2>
      <p>
        You have the right to:
        <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
          <li>Access your data</li>
          <li>Request correction or deletion</li>
          <li>Withdraw consent and deactivate your account</li>
        </ul>
        To exercise these rights, email us at <a href="mailto:atmosdevltd@gmail.com">atmosdevltd@gmail.com</a>.
      </p>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '30px', marginBottom: '10px' }}>
        6. Age Restriction
      </h2>
      <p>
        Velt is not intended for individuals under the age of 18. We do not knowingly collect or process personal data from users under 18 years of age.
      </p>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '30px', marginBottom: '10px' }}>
        7. Policy Updates
      </h2>
      <p>
        We may revise this Privacy Policy from time to time. You will be notified of any material changes, and continued use of the app indicates your acceptance of such changes.
      </p>
    </main>
  );
}
