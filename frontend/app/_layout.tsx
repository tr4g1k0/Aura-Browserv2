import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { AIProvider } from '../src/context/AIContext';
import { SettingsProvider } from '../src/context/SettingsContext';
import { PrivacyProvider } from '../src/context/PrivacyContext';

const AuraDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0a0a0f',
    card: '#0a0a0f',
    primary: '#00FFFF',
    text: '#FFFFFF',
    border: 'rgba(255,255,255,0.1)',
    notification: '#00FFFF',
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <ThemeProvider value={AuraDarkTheme}>
          <SettingsProvider>
            <PrivacyProvider>
              <AIProvider>
              <StatusBar style="light" translucent={true} backgroundColor="transparent" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: '#0a0a0f' },
                  animation: 'fade',
                  navigationBarColor: '#0a0a0f',
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen
                  name="tabs-manager"
                  options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                  }}
                />
                <Stack.Screen
                  name="ai-agent"
                  options={{
                    presentation: 'modal',
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="ai-settings"
                  options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                  }}
                />
                <Stack.Screen
                  name="settings"
                  options={{
                    animation: 'slide_from_bottom',
                    contentStyle: { backgroundColor: '#0a0a0f' },
                  }}
                />
              </Stack>
            </AIProvider>
            </PrivacyProvider>
          </SettingsProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
});
