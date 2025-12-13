/** @type {import('expo/config').ExpoConfig} */
export default {
  expo: {
    name: 'VELT',
    slug: 'velt',
    version: '1.0.0',
    scheme: 'velt',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.yourcompany.velt',
      infoPlist: {
        NSMicrophoneUsageDescription: 'This app uses the microphone to record voice notes in chat.',
        NSPhotoLibraryUsageDescription: 'This app needs access to your photos and videos to let you share media in chat.'
      }
    },
    android: {
      package: 'com.yourcompany.velt',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      permissions: [
        'RECORD_AUDIO',
        'READ_MEDIA_AUDIO',
        'READ_MEDIA_IMAGES',
        'READ_MEDIA_VIDEO',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
        'VIBRATE'
      ]
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      // ✅ Cloudinary
      EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME: "dpejjmjxg",
      EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET: "chatsuploads",

      // ✅ EAS project ID (for push notifications to work properly)
      eas: {
        projectId: "8c76779b-96c4-4798-8c67-a6dde1928094",
      },
    },
    plugins: [
      "expo-video",
    ],
  },
};


