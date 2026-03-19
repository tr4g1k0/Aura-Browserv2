import { useState, useCallback, RefObject } from 'react';
import { Platform, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { DownloadStatus } from '../components/DownloadToast';
import { downloadManager } from '../services/FileDownloadManager';
import { useDownloadsStore } from '../store/useDownloadsStore';
import { addDownloadToList } from '../components/DownloadsModal';

export function useDownloads(webViewRef: RefObject<any>) {
  const [downloadToastVisible, setDownloadToastVisible] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>(null);
  const [downloadFilename, setDownloadFilename] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(0);

  const checkForDownload = useCallback((url: string): boolean => {
    return downloadManager.isDownloadableUrl(url);
  }, []);

  const handleFileDownload = useCallback(async (downloadUrl: string) => {
    console.log('[Browser] Download intercepted:', downloadUrl);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (Platform.OS === 'web') {
      console.log('[Browser] Downloads not supported on web');
      return false;
    }

    const store = useDownloadsStore.getState();
    const extractedName = downloadManager.extractFilename(downloadUrl);
    const activeId = store.startDownload(downloadUrl, extractedName);

    setDownloadToastVisible(true);
    setDownloadStatus('downloading');
    setDownloadProgress(0);

    const result = await downloadManager.downloadAndShare(downloadUrl, (status, progress, filename, error) => {
      if (filename) {
        setDownloadFilename(filename);
      }
      
      switch (status) {
        case 'starting':
          setDownloadStatus('downloading');
          setDownloadProgress(0);
          break;
        case 'downloading':
          setDownloadStatus('downloading');
          setDownloadProgress(progress || 0);
          useDownloadsStore.getState().updateProgress(activeId, progress || 0);
          break;
        case 'complete':
          setDownloadStatus('complete');
          setDownloadProgress(100);
          useDownloadsStore.getState().completeDownload(activeId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'error':
          setDownloadStatus('error');
          useDownloadsStore.getState().failDownload(activeId, error || 'Download failed');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          console.error('[Browser] Download error:', error);
          break;
      }
    });

    if (result.success && result.localUri && result.filename) {
      addDownloadToList(result.filename, result.localUri);
    }

    return true;
  }, []);

  const dismissDownloadToast = useCallback(() => {
    setDownloadToastVisible(false);
    setTimeout(() => {
      setDownloadStatus(null);
      setDownloadFilename('');
      setDownloadProgress(0);
    }, 300);
  }, []);

  const handleDownloadAllLinks = useCallback(() => {
    if (!webViewRef.current || Platform.OS === 'web') return;

    const scanScript = `
      (function() {
        var exts = ['.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.txt','.csv','.zip','.rar','.7z','.tar','.gz','.mp3','.wav','.mp4','.mov','.avi','.jpg','.jpeg','.png','.gif','.webp','.apk'];
        var links = Array.from(document.querySelectorAll('a[href]'));
        var found = [];
        links.forEach(function(a) {
          var href = a.href || '';
          var lower = href.toLowerCase();
          for (var i = 0; i < exts.length; i++) {
            if (lower.endsWith(exts[i]) || lower.includes(exts[i] + '?')) {
              found.push(href);
              break;
            }
          }
        });
        found = found.filter(function(v, i, a) { return a.indexOf(v) === i; });
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DOWNLOAD_ALL_LINKS', urls: found }));
      })();
      true;
    `;
    webViewRef.current.injectJavaScript(scanScript);
  }, [webViewRef]);

  return {
    downloadToastVisible,
    downloadStatus,
    downloadFilename,
    downloadProgress,
    checkForDownload,
    handleFileDownload,
    dismissDownloadToast,
    handleDownloadAllLinks,
  };
}
