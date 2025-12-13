import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { useDoodleFeatures } from '@/lib/doodleFeatures';

type Props = { style?: any; screen?: 'profile' | 'home' | 'chat'; label?: string };

export default function DoodleToggle({ style, screen = 'profile', label }: Props) {
  const { enabled, setEnabled, loaded } = useDoodleFeatures(screen);

  // while loading, render nothing to avoid flicker
  if (!loaded) return null;

  const title = label ?? (screen === 'profile' ? 'Profile doodles' : screen === 'home' ? 'Home doodles' : 'Chat doodles');

  return (
    <View style={[styles.row, style]}>
      <Text style={styles.label}>{title}</Text>
      <Switch value={enabled} onValueChange={(v) => setEnabled(v)} thumbColor={enabled ? '#fff' : undefined} trackColor={{ true: '#4AA3FF', false: '#ccc' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  label: { fontSize: 15, fontWeight: '600' },
});
