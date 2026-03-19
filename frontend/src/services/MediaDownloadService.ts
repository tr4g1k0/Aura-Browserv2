/**
 * Media Download Service
 * 
 * Detects and extracts downloadable media URLs from web pages
 * Supports: Videos, Audio, and direct media links
 */

import { Platform } from 'react-native';

export interface DetectedMedia {
  type: 'video' | 'audio';
  src: string;
  poster?: string;
  duration?: number;
  title?: string;
  quality?: string;
}

/**
 * JavaScript to inject into WebView to detect and extract media URLs
 * This script finds all video/audio elements and extracts their sources
 */
export const mediaDetectionScript = `
(function() {
  'use strict';
  
  if (window.__AURA_MEDIA_DETECTOR__) return;
  window.__AURA_MEDIA_DETECTOR__ = true;
  
  let lastMediaReport = null;
  
  function extractMediaSources() {
    const media = [];
    
    // Find all video elements
    document.querySelectorAll('video').forEach((video, index) => {
      const sources = [];
      
      // Direct src attribute
      if (video.src && video.src.startsWith('http')) {
        sources.push(video.src);
      }
      
      // currentSrc (actual playing source)
      if (video.currentSrc && video.currentSrc.startsWith('http')) {
        sources.push(video.currentSrc);
      }
      
      // Source elements
      video.querySelectorAll('source').forEach(source => {
        if (source.src && source.src.startsWith('http')) {
          sources.push(source.src);
        }
      });
      
      // Remove duplicates
      const uniqueSources = [...new Set(sources)];
      
      if (uniqueSources.length > 0) {
        const rect = video.getBoundingClientRect();
        media.push({
          type: 'video',
          src: uniqueSources[0],
          allSources: uniqueSources,
          poster: video.poster || null,
          duration: video.duration || 0,
          title: document.title || 'Video',
          width: rect.width,
          height: rect.height,
          top: rect.top,
          isVisible: rect.top < window.innerHeight && rect.bottom > 0,
          isPlaying: !video.paused,
          index: index
        });
      }
    });
    
    // Find all audio elements
    document.querySelectorAll('audio').forEach((audio, index) => {
      const sources = [];
      
      if (audio.src && audio.src.startsWith('http')) {
        sources.push(audio.src);
      }
      
      if (audio.currentSrc && audio.currentSrc.startsWith('http')) {
        sources.push(audio.currentSrc);
      }
      
      audio.querySelectorAll('source').forEach(source => {
        if (source.src && source.src.startsWith('http')) {
          sources.push(source.src);
        }
      });
      
      const uniqueSources = [...new Set(sources)];
      
      if (uniqueSources.length > 0) {
        media.push({
          type: 'audio',
          src: uniqueSources[0],
          allSources: uniqueSources,
          duration: audio.duration || 0,
          title: document.title || 'Audio',
          isPlaying: !audio.paused,
          index: index
        });
      }
    });
    
    return media;
  }
  
  function reportMedia() {
    const media = extractMediaSources();
    const report = JSON.stringify(media);
    
    // Only report if changed
    if (report !== lastMediaReport) {
      lastMediaReport = report;
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'DETECTED_MEDIA',
        media: media,
        url: window.location.href,
        timestamp: Date.now()
      }));
    }
  }
  
  // Monitor for media changes
  function setupMediaObserver() {
    // Watch for new media elements
    const observer = new MutationObserver(() => {
      setTimeout(reportMedia, 500);
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Listen for media events
    document.addEventListener('play', reportMedia, true);
    document.addEventListener('pause', reportMedia, true);
    document.addEventListener('loadedmetadata', reportMedia, true);
  }
  
  // Initial scan
  if (document.readyState === 'complete') {
    setTimeout(reportMedia, 1000);
    setupMediaObserver();
  } else {
    window.addEventListener('load', () => {
      setTimeout(reportMedia, 1000);
      setupMediaObserver();
    });
  }
  
  // Periodic check
  setInterval(reportMedia, 3000);
  
  console.log('[Aura] Media detector initialized');
})();
true;
`;

/**
 * Script to get download URL for a specific video element
 */
export const getVideoDownloadUrl = (videoIndex: number) => `
(function() {
  const videos = document.querySelectorAll('video');
  const video = videos[${videoIndex}];
  
  if (!video) {
    window.ReactNativeWebView?.postMessage(JSON.stringify({
      type: 'VIDEO_DOWNLOAD_URL',
      success: false,
      error: 'Video not found'
    }));
    return;
  }
  
  // Try to get the best quality source
  let downloadUrl = video.currentSrc || video.src;
  
  // Check source elements for alternatives
  const sources = video.querySelectorAll('source');
  sources.forEach(source => {
    const type = source.type || '';
    // Prefer mp4
    if (type.includes('mp4') && source.src) {
      downloadUrl = source.src;
    }
  });
  
  window.ReactNativeWebView?.postMessage(JSON.stringify({
    type: 'VIDEO_DOWNLOAD_URL',
    success: !!downloadUrl,
    url: downloadUrl,
    title: document.title || 'video',
    duration: video.duration || 0
  }));
})();
true;
`;

/**
 * Check if URL is a direct media file
 */
export function isDirectMediaUrl(url: string): { isMedia: boolean; type: 'video' | 'audio' | null } {
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v', '.flv'];
  const audioExtensions = ['.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a'];
  
  const lowerUrl = url.toLowerCase();
  
  for (const ext of videoExtensions) {
    if (lowerUrl.includes(ext)) {
      return { isMedia: true, type: 'video' };
    }
  }
  
  for (const ext of audioExtensions) {
    if (lowerUrl.includes(ext)) {
      return { isMedia: true, type: 'audio' };
    }
  }
  
  return { isMedia: false, type: null };
}

/**
 * Extract filename from media URL
 */
export function extractMediaFilename(url: string, title?: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];
    
    if (lastPart && lastPart.includes('.')) {
      return decodeURIComponent(lastPart).replace(/[<>:"/\\|?*]/g, '_');
    }
    
    // Use title as fallback
    if (title) {
      const cleanTitle = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
      const { type } = isDirectMediaUrl(url);
      const ext = type === 'video' ? '.mp4' : type === 'audio' ? '.mp3' : '';
      return `${cleanTitle}${ext}`;
    }
    
    return `media_${Date.now()}`;
  } catch {
    return `media_${Date.now()}`;
  }
}

export default {
  mediaDetectionScript,
  getVideoDownloadUrl,
  isDirectMediaUrl,
  extractMediaFilename,
};
