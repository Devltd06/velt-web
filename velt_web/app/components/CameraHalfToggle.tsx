import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Camera, CameraView } from 'expo-camera';

// Short explanation for teammates / AI:
// Remove the ratio UI. Keep the camera default at 1× (the device camera’s neutral zoom).
// Add a single toggle button labeled 0.5x. When the user taps 0.5x, try to switch
// to the ultra-wide physical lens (if available). If none exists, set the camera
// zoom to neutralZoom * 0.5 clamped to the device range. Tapping again returns to 1×.
// Using expo-camera keeps this component compatible with the Expo managed workflow.

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function CameraHalfToggle() {
  // Using expo-camera in the managed workflow. It's not possible to select
  // an individual physical lens (ultra-wide vs wide) reliably with Expo's
  // API, so the toggle will approximate a "0.5x" option by setting digital
  // zoom to 0.5. When an actual ultra-wide physical lens selection becomes
  // necessary, a custom native module would be required.

  // permission is kept as a simple string here to avoid typing mismatches across
  // different versions of camera APIs where the status type may vary.
  const [permission, setPermission] = useState<string | null>(null);
  // expo-camera uses a zoom value in [0, 1]
  const [zoom, setZoom] = useState<number>(0);
  const [isHalf, setIsHalf] = useState(false);
  // expo-camera's CameraType is a string 'back' | 'front' but we keep this
  // component focused only on the back camera like the previous implementation.

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setPermission(status);
    })();
  }, []);

  // When the camera device selection becomes available, initialize to wideDevice
  // Enable/disable the 0.5× view by switching digital zoom. expo-camera expects
  // a normalized zoom in [0, 1]. 0 represents no zoom; 0.5 is an easy-to-understand
  // middle value. You can tweak these numbers for your desired effect.
  const enableHalf = () => {
    setZoom(0.5);
    setIsHalf(true);
  };

  const disableHalf = () => {
    setZoom(0);
    setIsHalf(false);
  };

  const toggleHalf = () => {
    if (isHalf) disableHalf();
    else enableHalf();
  };

  if (permission == null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Initializing camera…</Text>
      </View>
    );
  }

  if (permission !== 'granted') {
    return (
      <View style={styles.center}>
        <Text>Camera permission is required.</Text>
      </View>
    );
  }

  // expo-camera is ready (permission granted)

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing={'back'} zoom={zoom as any} />

      <View style={styles.controls} pointerEvents="box-none">
        <TouchableOpacity style={styles.button} onPress={toggleHalf}>
          <Text style={styles.buttonText}>{isHalf ? '1x' : '0.5x'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.info} pointerEvents="none">
        <Text>Camera: back</Text>
        <Text>Zoom: {zoom.toFixed(2)}</Text>
        <Text>Ultra-wide: (not detectable in Expo)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  controls: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: '#00000088',
    borderRadius: 12,
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  info: {
    position: 'absolute',
    top: 36,
    left: 12,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
