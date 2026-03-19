import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BotDetectionBannerProps {
  visible: boolean;
  onClose: () => void;
}

export const BotDetectionBanner = ({ visible, onClose }: BotDetectionBannerProps) => {
  if (!visible) return null;

  return (
    <View
      style={{
        position: 'absolute', top: 80, left: 16, right: 16, zIndex: 1000,
        backgroundColor: 'rgba(239, 68, 68, 0.95)', borderRadius: 14,
        paddingVertical: 12, paddingHorizontal: 16,
        flexDirection: 'row', alignItems: 'center',
      }}
      data-testid="bot-detection-banner"
    >
      <Ionicons name="shield-outline" size={20} color="#FFF" style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>Site Blocked Request</Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 }}>
          Try switching networks or disabling VPN.
        </Text>
      </View>
      <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="close" size={20} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
};
