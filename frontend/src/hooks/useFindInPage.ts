import { useState, useRef, useCallback, RefObject } from 'react';
import { TextInput } from 'react-native';
import * as Haptics from 'expo-haptics';

export function useFindInPage(webViewRef: RefObject<any>) {
  const [isFindModeActive, setIsFindModeActive] = useState(false);
  const [findText, setFindText] = useState('');
  const findInputRef = useRef<TextInput>(null);

  const handleOpenFindInPage = useCallback(() => {
    console.log('[Find in Page] Opening search bar');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsFindModeActive(true);
    setFindText('');
    setTimeout(() => {
      findInputRef.current?.focus();
    }, 100);
  }, []);

  const handleFindNext = useCallback(() => {
    if (!findText.trim() || !webViewRef.current) {
      console.log('[Find in Page] No search text or no WebView ref');
      return;
    }
    
    console.log(`[Find in Page] Searching for: "${findText}"`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const escapedText = findText.replace(/[\\'"]/g, '\\$&');
    
    const findScript = `
      (function() {
        try {
          const found = window.find("${escapedText}", false, false, true);
          if (!found) {
            console.log('[Find in Page] No more matches found');
          } else {
            console.log('[Find in Page] Match found');
          }
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'FIND_RESULT',
            found: found
          }));
        } catch(e) {
          console.error('[Find in Page] Error:', e);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'FIND_RESULT',
            found: false,
            error: e.message
          }));
        }
      })();
      true;
    `;
    
    webViewRef.current.injectJavaScript(findScript);
  }, [findText, webViewRef]);

  const handleCloseFindInPage = useCallback(() => {
    console.log('[Find in Page] Closing search bar');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsFindModeActive(false);
    setFindText('');
    
    if (webViewRef.current) {
      const clearScript = `
        (function() {
          try {
            if (window.getSelection) {
              window.getSelection().removeAllRanges();
            }
            console.log('[Find in Page] Selection cleared');
          } catch(e) {
            console.log('[Find in Page] Error clearing selection:', e);
          }
        })();
        true;
      `;
      webViewRef.current.injectJavaScript(clearScript);
    }
  }, [webViewRef]);

  return {
    isFindModeActive,
    findText,
    setFindText,
    findInputRef,
    handleOpenFindInPage,
    handleFindNext,
    handleCloseFindInPage,
  };
}
