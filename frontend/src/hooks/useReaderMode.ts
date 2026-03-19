import { useState, useCallback, RefObject } from 'react';
import { Platform, Alert } from 'react-native';

const READER_MODE_JS = `
  (function() {
    if (document.getElementById('aura-reader-style')) {
      return true;
    }
    
    const readerModeCSS = \`
      * {
        transition: none !important;
        animation: none !important;
      }
      
      body {
        background-color: #0A0A0F !important;
        color: #E2E8F0 !important;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 20px !important;
        line-height: 1.8 !important;
        padding: 24px !important;
        max-width: 720px !important;
        margin: 0 auto !important;
        min-height: 100vh !important;
      }
      
      h1, h2, h3, h4, h5, h6 {
        color: #FFFFFF !important;
        line-height: 1.3 !important;
        margin-top: 1.5em !important;
        margin-bottom: 0.5em !important;
      }
      
      h1 { font-size: 2em !important; }
      h2 { font-size: 1.6em !important; }
      h3 { font-size: 1.3em !important; }
      
      p {
        margin-bottom: 1.2em !important;
        color: #CBD5E1 !important;
      }
      
      a {
        color: #00F2FF !important;
        text-decoration: none !important;
      }
      
      a:hover {
        text-decoration: underline !important;
      }
      
      img {
        max-width: 100% !important;
        height: auto !important;
        border-radius: 12px !important;
        margin: 1em 0 !important;
      }
      
      pre, code {
        background-color: #1E1E2E !important;
        color: #A6E3A1 !important;
        border-radius: 8px !important;
        padding: 0.2em 0.4em !important;
        font-size: 0.9em !important;
      }
      
      pre {
        padding: 1em !important;
        overflow-x: auto !important;
      }
      
      ul, ol {
        padding-left: 1.5em !important;
        color: #CBD5E1 !important;
      }
      
      li {
        margin-bottom: 0.5em !important;
      }
      
      blockquote {
        border-left: 4px solid #00F2FF !important;
        margin: 1em 0 !important;
        padding-left: 1em !important;
        color: #94A3B8 !important;
        font-style: italic !important;
      }
      
      nav, footer, aside, iframe, 
      .ad, .ads, .advertisement, .banner,
      .sidebar, .side-bar, .menu, .navigation,
      .popup, .modal, .overlay, .cookie-banner, .cookie-notice,
      .social-share, .share-buttons, .comments, .comment-section,
      .related-posts, .recommended, .newsletter,
      header:not(article header), .header,
      .sticky, .fixed, [class*="sticky"], [class*="fixed"],
      [class*="popup"], [class*="modal"], [class*="banner"],
      [class*="cookie"], [class*="gdpr"], [class*="consent"],
      [id*="cookie"], [id*="gdpr"], [id*="consent"],
      video, audio, embed, object,
      .video-player, .audio-player {
        display: none !important;
        visibility: hidden !important;
      }
      
      article, main, .article, .post, .content, .entry-content,
      .post-content, .article-content, .story-body {
        display: block !important;
        width: 100% !important;
        max-width: 720px !important;
        margin: 0 auto !important;
        padding: 0 !important;
      }
      
      table {
        border-collapse: collapse !important;
        width: 100% !important;
        margin: 1em 0 !important;
      }
      
      th, td {
        border: 1px solid #374151 !important;
        padding: 0.75em !important;
        text-align: left !important;
      }
      
      th {
        background-color: #1E1E2E !important;
        color: #FFFFFF !important;
      }
    \`;
    
    const styleNode = document.createElement('style');
    styleNode.innerHTML = readerModeCSS;
    styleNode.id = 'aura-reader-style';
    document.head.appendChild(styleNode);
    
    window.scrollTo(0, 0);
    
    window.ReactNativeWebView?.postMessage(JSON.stringify({
      type: 'READER_MODE_ACTIVATED'
    }));
    
    true;
  })();
`;

const UNDO_READER_MODE_JS = `
  (function() {
    const styleNode = document.getElementById('aura-reader-style');
    if (styleNode) {
      styleNode.remove();
    }
    
    window.ReactNativeWebView?.postMessage(JSON.stringify({
      type: 'READER_MODE_DEACTIVATED'
    }));
    
    true;
  })();
`;

export function useReaderMode(webViewRef: RefObject<any>) {
  const [isReaderModeActive, setIsReaderModeActive] = useState(false);

  const toggleReaderMode = useCallback(() => {
    if (!webViewRef.current || Platform.OS === 'web') {
      Alert.alert('Reader Mode', 'Reader Mode requires native mobile app');
      return;
    }
    
    const newState = !isReaderModeActive;
    setIsReaderModeActive(newState);
    webViewRef.current.injectJavaScript(newState ? READER_MODE_JS : UNDO_READER_MODE_JS);
    console.log('[Reader Mode]', newState ? 'Activated' : 'Deactivated');
  }, [isReaderModeActive, webViewRef]);

  return { isReaderModeActive, setIsReaderModeActive, toggleReaderMode };
}
