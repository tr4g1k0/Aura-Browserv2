import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FindInPageBarProps {
  findText: string;
  setFindText: (text: string) => void;
  findInputRef: React.RefObject<TextInput>;
  onFindNext: () => void;
  onClose: () => void;
}

export const FindInPageBar = ({ findText, setFindText, findInputRef, onFindNext, onClose }: FindInPageBarProps) => (
  <View style={styles.findInPageContainer} data-testid="find-in-page-bar">
    <View style={styles.findInPageBar}>
      <TextInput
        ref={findInputRef}
        style={styles.findInPageInput}
        placeholder="Find in page..."
        placeholderTextColor="rgba(255, 255, 255, 0.5)"
        value={findText}
        onChangeText={setFindText}
        onSubmitEditing={onFindNext}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        selectionColor="#00FFFF"
      />
      <TouchableOpacity
        style={styles.findInPageButton}
        onPress={onFindNext}
        activeOpacity={0.7}
        data-testid="find-next-btn"
      >
        <Ionicons name="arrow-down" size={24} color="#00FFFF" />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.findInPageCloseButton}
        onPress={onClose}
        activeOpacity={0.7}
        data-testid="find-close-btn"
      >
        <Ionicons name="close" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  </View>
);

const styles = StyleSheet.create({
  findInPageContainer: {
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  findInPageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    height: 52,
  },
  findInPageInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    paddingVertical: 12,
    paddingRight: 8,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  findInPageButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
  },
  findInPageCloseButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});
