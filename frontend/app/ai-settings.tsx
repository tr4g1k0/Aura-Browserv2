import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAI } from '../src/context/AIContext';

export default function AISettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    settings,
    updateSettings,
    models,
    downloadModel,
    deleteModel,
    isDownloading,
    downloadProgress,
    isOnnxAvailable,
    memoryUsage,
    preferredSource,
  } = useAI();

  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  const handleClose = () => router.back();

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const getModelTypeIcon = (type: string) => {
    switch (type) {
      case 'stt': return 'mic';
      case 'vlm': return 'eye';
      case 'llm': return 'chatbubbles';
      default: return 'cube';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return '#00FF88';
      case 'downloading': return '#FFB800';
      case 'error': return '#FF4444';
      default: return '#666';
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Settings</Text>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>ONNX Runtime</Text>
              <View style={[styles.statusBadge, { backgroundColor: isOnnxAvailable ? '#1A2A1A' : '#2A1A1A' }]}>
                <View style={[styles.statusDot, { backgroundColor: isOnnxAvailable ? '#00FF88' : '#FF4444' }]} />
                <Text style={[styles.statusText, { color: isOnnxAvailable ? '#00FF88' : '#FF4444' }]}>
                  {isOnnxAvailable ? 'Available' : 'Web Only'}
                </Text>
              </View>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Preferred Source</Text>
              <Text style={styles.statusValue}>{preferredSource.toUpperCase()}</Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Memory Usage</Text>
              <Text style={styles.statusValue}>
                {formatBytes(memoryUsage.used)} / {formatBytes(memoryUsage.max)} ({memoryUsage.percentage}%)
              </Text>
            </View>
          </View>
        </View>

        {/* Privacy Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="shield-checkmark" size={24} color="#00FF88" />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Strict Local Processing</Text>
                  <Text style={styles.settingDescription}>
                    Never send data to cloud APIs. Requires downloaded models.
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.strictLocalProcessing}
                onValueChange={(value) => updateSettings({ strictLocalProcessing: value })}
                trackColor={{ false: '#333', true: '#00FF88' }}
                thumbColor="#FFF"
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="cloud" size={24} color="#00AAFF" />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Cloud Fallback</Text>
                  <Text style={styles.settingDescription}>
                    Use cloud API when local processing fails or times out.
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.cloudFallbackEnabled}
                onValueChange={(value) => updateSettings({ cloudFallbackEnabled: value })}
                trackColor={{ false: '#333', true: '#00AAFF' }}
                thumbColor="#FFF"
                disabled={settings.strictLocalProcessing}
              />
            </View>
          </View>
        </View>

        {/* Models Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Local Models</Text>
          <Text style={styles.sectionSubtitle}>
            Download models for offline AI processing
          </Text>

          {models.map((model) => (
            <TouchableOpacity
              key={model.id}
              style={styles.modelCard}
              onPress={() => setExpandedModel(expandedModel === model.id ? null : model.id)}
              activeOpacity={0.7}
            >
              <View style={styles.modelHeader}>
                <View style={styles.modelInfo}>
                  <View style={[styles.modelIcon, { backgroundColor: `${getStatusColor(model.status)}20` }]}>
                    <Ionicons
                      name={getModelTypeIcon(model.type) as any}
                      size={20}
                      color={getStatusColor(model.status)}
                    />
                  </View>
                  <View>
                    <Text style={styles.modelName}>{model.name}</Text>
                    <Text style={styles.modelMeta}>
                      {model.type.toUpperCase()} • {model.size} MB
                    </Text>
                  </View>
                </View>
                
                <View style={styles.modelStatus}>
                  {model.status === 'downloading' && downloadProgress[model.id] !== undefined ? (
                    <View style={styles.progressContainer}>
                      <Text style={styles.progressText}>{downloadProgress[model.id]}%</Text>
                      <ActivityIndicator size="small" color="#FFB800" />
                    </View>
                  ) : (
                    <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(model.status) }]} />
                  )}
                </View>
              </View>

              {expandedModel === model.id && (
                <View style={styles.modelExpanded}>
                  <View style={styles.modelActions}>
                    {model.status === 'ready' ? (
                      <TouchableOpacity
                        style={[styles.modelButton, styles.deleteButton]}
                        onPress={() => deleteModel(model.id)}
                      >
                        <Ionicons name="trash" size={16} color="#FF4444" />
                        <Text style={[styles.modelButtonText, { color: '#FF4444' }]}>Delete</Text>
                      </TouchableOpacity>
                    ) : model.status !== 'downloading' ? (
                      <TouchableOpacity
                        style={[styles.modelButton, styles.downloadButton]}
                        onPress={() => downloadModel(model.id)}
                        disabled={isDownloading}
                      >
                        <Ionicons name="download" size={16} color="#00FF88" />
                        <Text style={[styles.modelButtonText, { color: '#00FF88' }]}>Download</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  
                  <Text style={styles.modelNote}>
                    {model.status === 'ready' 
                      ? 'Model is ready for local inference'
                      : 'Tap Download to enable offline processing'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Performance Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance</Text>
          
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="timer" size={24} color="#FFB800" />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Cloud Timeout</Text>
                  <Text style={styles.settingDescription}>
                    {settings.cloudFallbackTimeoutMs / 1000}s before falling back
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="hardware-chip" size={24} color="#A78BFA" />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Max Memory</Text>
                  <Text style={styles.settingDescription}>
                    {settings.maxMemoryMB} MB for model caching
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  statusCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 14,
    color: '#888',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 14,
    color: '#FFF',
  },
  settingCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFF',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: '#888',
  },
  modelCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  modelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modelIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modelName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFF',
  },
  modelMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  modelStatus: {
    alignItems: 'flex-end',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressText: {
    fontSize: 12,
    color: '#FFB800',
  },
  modelExpanded: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  modelActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  downloadButton: {
    backgroundColor: '#1A2A1A',
  },
  deleteButton: {
    backgroundColor: '#2A1A1A',
  },
  modelButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modelNote: {
    fontSize: 12,
    color: '#666',
    marginTop: 12,
  },
});
