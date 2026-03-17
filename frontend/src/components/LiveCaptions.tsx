import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useBrowserStore } from '../store/browserStore';

export const LiveCaptions: React.FC = () => {
  const { liveCaptions, settings } = useBrowserStore();

  if (!settings.liveCaptioningEnabled || liveCaptions.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.liveDot} />
        <Text style={styles.headerText}>LIVE CAPTIONS</Text>
      </View>
      <ScrollView
        style={styles.captionsScroll}
        showsVerticalScrollIndicator={false}
      >
        {liveCaptions.map((caption, index) => (
          <Text
            key={index}
            style={[
              styles.captionText,
              index === liveCaptions.length - 1 && styles.latestCaption,
            ]}
          >
            {caption}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 12,
    maxHeight: 150,
    borderWidth: 1,
    borderColor: '#333',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4444',
    marginRight: 8,
  },
  headerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 1,
  },
  captionsScroll: {
    maxHeight: 100,
  },
  captionText: {
    fontSize: 14,
    color: '#AAA',
    lineHeight: 20,
    marginBottom: 4,
  },
  latestCaption: {
    color: '#FFF',
    fontWeight: '500',
  },
});
