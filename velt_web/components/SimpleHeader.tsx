import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useMarketTheme } from '@/utils/marketTheme';

type RightAction = { icon?: string; label?: string; onPress?: () => void } | null;

export default function SimpleHeader({ title, subtitle, avatarUrl, onAvatarPress, onBack, rightAction }: { title?: string; subtitle?: string; avatarUrl?: string; onAvatarPress?: () => void; onBack?: () => void; rightAction?: RightAction }) {
  const router = withSafeRouter(useRouter());
  const { colors } = useMarketTheme();

  const goBack = () => {
    if (onBack) return onBack();
    try { router.back(); } catch { /* ignore */ }
  };
  
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.bg, zIndex: 20, elevation: 4 }}>
      {avatarUrl ? (
        <TouchableOpacity onPress={() => { if (onAvatarPress) return onAvatarPress(); goBack(); }} style={{ padding: 8 }}>
          <Image source={{ uri: avatarUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={goBack} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
      )}
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{title ?? ''}</Text>
        {subtitle ? <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {rightAction ? (
        <TouchableOpacity onPress={rightAction.onPress} style={{ padding: 8 }}>
          {rightAction.icon ? <Ionicons name={rightAction.icon as any} size={20} color={colors.accent} /> : <Text style={{ color: colors.accent, fontWeight: '700' }}>{rightAction.label}</Text>}
        </TouchableOpacity>
      ) : (
        <View style={{ width: 36 }} />
      )}
    </View>
  );
}
