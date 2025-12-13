import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking, Platform } from 'react-native';

export async function openImagePickerAsync() {
  // Request permission to access the media library first. Some platforms will return an empty
  // / canceled result if permissions were not granted, which looks like "nothing happened".
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    // Some SDKs return { status } while others include granted boolean. Check both.
    const granted = (perm as any)?.granted ?? (perm as any)?.status === 'granted';
    if (!granted) {
      // Provide a helpful prompt asking user to enable permissions in Settings
      Alert.alert(
        'Permission required',
        'Photo access is required to pick images. Open app settings to allow access?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return null;
    }
  } catch (err) {
    console.warn('requestMediaLibraryPermissionsAsync', err);
    // Some platforms may still allow the picker to open even if permission check fails — continue
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    // prefer the SDK-provided constant for mediaTypes when available
    mediaTypes: (ImagePicker.MediaTypeOptions?.Images ?? ['Images']) as any,
    allowsEditing: true,
    quality: 0.8,
  });

  if (!result.canceled && result.assets?.length) {
    return result.assets[0].uri; // This is the selected image URI
  }
  return null;
}

export async function openCameraAsync() {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const granted = (perm as any)?.granted ?? (perm as any)?.status === 'granted';
    if (!granted) {
      Alert.alert('Permission required', 'Camera access is required to take photos. Open settings?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return null;
    }
  } catch (err) {
    console.warn('requestCameraPermissionsAsync', err);
  }

  const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });

  if (!result.canceled) {
    return result.assets[0].uri;
  } else {
    return null;
  }
}
