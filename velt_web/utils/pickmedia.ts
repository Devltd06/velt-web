import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export async function pickMediaAsync(): Promise<{ uri: string; type: 'image' | 'video' } | null> {
  // Check first so the picker opens fast when permission was already granted.
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  let permission = current;
  if (!((current as any)?.granted ?? (current as any)?.status === 'granted')) {
    permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  }
  if (!((permission as any)?.granted ?? (permission as any)?.status === 'granted')) {
    Alert.alert('Permission Denied', 'Please enable photo access to continue.');
    return null;
  }

  const mediaTypeConst = (ImagePicker.MediaTypeOptions && (ImagePicker.MediaTypeOptions as any).All) || (ImagePicker as any).MediaTypeOptions?.All || ("All" as any);
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: mediaTypeConst as any,
    allowsEditing: true,
    quality: 0.8,
  });

  if (!result.canceled && result.assets?.length > 0) {
    const asset = result.assets[0];
    const type = asset.type === 'video' ? 'video' : 'image';
    return { uri: asset.uri, type };
  }

  return null;
}

export async function pickMultipleMediaAsync(): Promise<Array<{ uri: string; type: 'image' | 'video'; mimeType?: string }> | null> {
  // Check permission first to avoid the redundant prompt and open picker faster
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  let permission = current;
  if (!((current as any)?.granted ?? (current as any)?.status === 'granted')) {
    permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  }
  if (!((permission as any)?.granted ?? (permission as any)?.status === 'granted')) {
    Alert.alert('Permission Denied', 'Please enable photo access to continue.');
    return null;
  }

  let result: any;
  const mediaTypeConst = (ImagePicker.MediaTypeOptions && (ImagePicker.MediaTypeOptions as any).All) || (ImagePicker as any).MediaTypeOptions?.All || ("All" as any);
  try {
    result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: mediaTypeConst as any, allowsMultipleSelection: true, quality: 0.8 });
  } catch (err) {
    // Some platforms or SDK versions don't support allowsMultipleSelection — fallback to single-selection
    console.warn('pickMultipleMediaAsync: multi-select launch failed, falling back to single select', err);
    // Fallback to single selection with correct mediaTypes value
    result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: mediaTypeConst as any, quality: 0.8 });
  }

  if (!result.canceled && result.assets?.length) {
    // result.assets may be an array of one or many
    return result.assets.map((asset: any) => ({ uri: asset.uri, type: asset.type === 'video' ? 'video' : 'image', mimeType: asset.mimeType }));
  }

  return null;
}
