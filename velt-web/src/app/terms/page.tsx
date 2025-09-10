// File: src/app/terms/page.tsx
import React from 'react';

export default function TermsPage() {
  return (
    <main style={{
      padding: '40px',
      maxWidth: '900px',
      margin: '0 auto',
      lineHeight: 1.7,
      backgroundColor: '#0e0e10',
      color: '#fff',
      minHeight: '100vh',
    }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '10px', color: '#2563eb' }}>
        Terms & Conditions – Velt
      </h1>
      <p style={{ color: '#aaa', marginBottom: '30px' }}>Effective Date: July 22, 2025</p>

      <p>
        Welcome to Velt, a platform designed to function as a marketplace, social network, and productivity app.
        By accessing or using Velt, you agree to the following Terms & Conditions. Please read them carefully.
      </p>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '30px', marginBottom: '10px', color: '#1e90ff' }}>
        1. Eligibility
      </h2>
      <p>
        Velt is intended for individuals who are at least 18 years of age. By registering or using this platform,
        you confirm that you meet this requirement and that any information provided is accurate and complete.
      </p>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '30px', marginBottom: '10px', color: '#1e90ff' }}>
        2. Account Creation and Responsibility
      </h2>
      <p>
        To access most features, you must create a personal account. You are responsible for safeguarding your login credentials
        and for all activity that occurs under your account.
      </p>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '30px', marginBottom: '10px', color: '#1e90ff' }}>
        3. User Roles and Features
      </h2>
      <p>
        Velt allows users to create content, interact with others, participate in marketplaces, and use productivity tools.
        These features are similar to platforms like Instagram or Facebook.
      </p>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '30px', marginBottom: '10px', color: '#1e90ff' }}>
        4. Prohibited Conduct
      </h2>
      <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
        <li>Post offensive, illegal, or harmful content</li>
        <li>Harass, threaten, impersonate, or defame others</li>
        <li>Violate intellectual property or community guidelines</li>
        <li>Engage in spam, fraud, or any unlawful activity</li>
      </ul>
      <p>Violation may result in suspension or permanent account termination.</p>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '30px', marginBottom: '10px', color: '#1e90ff' }}>
        5. Content Ownership
      </h2>
      <p>
        You retain ownership of content you upload. By posting on Velt, you grant a non-exclusive, worldwide,
        royalty-free license to host, display, and share your content to operate, promote, and improve the platform.
      </p>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '30px', marginBottom: '10px', color: '#1e90ff' }}>
        6. Payments and Refunds
      </h2>
      <p>
        Some premium features may require payment. All transactions are final and non-refundable, except where required by law.
      </p>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '30px', marginBottom: '10px', color: '#1e90ff' }}>
        7. Termination
      </h2>
      <p>
        Velt may suspend or terminate your access if you violate these Terms or use the platform in a manner that could harm others.
      </p>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '30px', marginBottom: '10px', color: '#1e90ff' }}>
        8. Modifications to Terms
      </h2>
      <p>
        We may update these Terms from time to time. Continued use of Velt following updates signifies your acceptance of the revised terms.
      </p>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '30px', marginBottom: '10px', color: '#1e90ff' }}>
        9. Contact Us
      </h2>
      <p>
        For any questions regarding these Terms, contact us at <a href="mailto:atmosdevltd@gmail.com" style={{ color: '#2563eb', textDecoration: 'underline' }}>atmosdevltd@gmail.com</a>.
      </p>
    </main>
  );
}
