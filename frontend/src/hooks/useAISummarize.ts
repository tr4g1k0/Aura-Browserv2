import { useState, useCallback, RefObject } from 'react';
import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

export function useAISummarize(
  webViewRef: RefObject<any>,
  activeTab: { url?: string; title?: string } | undefined,
) {
  const [isAiDrawerVisible, setIsAiDrawerVisible] = useState(false);
  const [aiSummaryText, setAiSummaryText] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const AI_API_KEY = '';

  const extractTextScript = `
    try {
      const paragraphs = Array.from(document.querySelectorAll('p, h1, h2, h3, article, section, main'))
        .map(p => p.innerText)
        .filter(t => t.length > 50)
        .join('\\n\\n');
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'EXTRACTED_TEXT',
        payload: paragraphs.substring(0, 4000)
      }));
    } catch(e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'EXTRACTION_ERROR',
        payload: e.message
      }));
    }
    true;
  `;

  const handleCopySummary = useCallback(async () => {
    if (!aiSummaryText || aiSummaryText.includes('Scanning') || aiSummaryText.includes('Generating')) {
      return;
    }
    
    try {
      await Clipboard.setStringAsync(aiSummaryText);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('[Copy] Failed to copy:', error);
      Alert.alert('Copy Failed', 'Could not copy to clipboard.');
    }
  }, [aiSummaryText]);

  const generateAISummary = useCallback(async (text: string) => {
    try {
      console.log('[AI Summary] Processing text, length:', text.length);
      
      if (!text || text.trim().length < 100) {
        throw new Error('Not enough readable text found on this page to summarize.');
      }

      const SYSTEM_PROMPT = 'You are a privacy-focused browser assistant. Summarize the following webpage content into 3 clear, high-impact bullet points.';
      
      if (AI_API_KEY && AI_API_KEY.length > 10) {
        console.log('[AI Summary] Using API with provided key');
        setAiSummaryText('✨ Generating AI summary...');
        
        try {
          const isOpenAI = AI_API_KEY.startsWith('sk-');
          
          if (isOpenAI) {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AI_API_KEY}`,
              },
              body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                  { role: 'system', content: SYSTEM_PROMPT },
                  { role: 'user', content: `Summarize this webpage content:\n\n${text.substring(0, 3000)}` }
                ],
                max_tokens: 500,
                temperature: 0.7,
              }),
            });
            
            if (!response.ok) {
              throw new Error(`OpenAI API error: ${response.status}`);
            }
            
            const data = await response.json();
            const summary = data.choices?.[0]?.message?.content;
            
            if (summary) {
              setAiSummaryText(`✨ **AI Summary**\n\n${summary}`);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              return;
            }
          } else {
            const response = await fetch(
              `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${AI_API_KEY}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{
                    parts: [{
                      text: `${SYSTEM_PROMPT}\n\nWebpage content:\n\n${text.substring(0, 3000)}`
                    }]
                  }],
                  generationConfig: {
                    maxOutputTokens: 500,
                    temperature: 0.7,
                  }
                }),
              }
            );
            
            if (!response.ok) {
              throw new Error(`Gemini API error: ${response.status}`);
            }
            
            const data = await response.json();
            const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (summary) {
              setAiSummaryText(`✨ **AI Summary**\n\n${summary}`);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              return;
            }
          }
        } catch (apiError: any) {
          console.warn('[AI Summary] API failed, falling back to local:', apiError.message);
        }
      }

      // Local fallback
      console.log('[AI Summary] Using local heuristic fallback');
      setAiSummaryText('📝 Analyzing content locally...');
      
      const cleanText = text.replace(/\s+/g, ' ').replace(/\n+/g, ' ').trim();
      
      const sentences = cleanText
        .split(/(?<=[.!?])\s+/)
        .filter(s => s.length > 30 && s.length < 300)
        .map(s => s.trim());
      
      if (sentences.length < 2) {
        throw new Error('Could not extract meaningful sentences from this page.');
      }

      const keyPoints: string[] = [];
      keyPoints.push(sentences[0]);
      
      if (sentences.length > 2) {
        const middleIndex = Math.floor(sentences.length / 2);
        keyPoints.push(sentences[middleIndex]);
      }
      
      if (sentences.length > 4) {
        const lateIndex = Math.floor(sentences.length * 0.75);
        if (!keyPoints.includes(sentences[lateIndex])) {
          keyPoints.push(sentences[lateIndex]);
        }
      }
      
      if (sentences.length > 6 && keyPoints.length < 4) {
        const randomIndex = Math.floor(sentences.length * 0.4);
        if (!keyPoints.includes(sentences[randomIndex])) {
          keyPoints.push(sentences[randomIndex]);
        }
      }

      const formattedSummary = [
        '📄 **Page Summary**\n',
        ...keyPoints.map((point) => `• ${point}`),
        '\n\n_Generated using local text analysis_'
      ].join('\n');

      setAiSummaryText(formattedSummary);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
    } catch (error: any) {
      console.error('[AI Summary] Error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setAiSummaryText(`⚠️ **AI Error**\n\n${error.message || 'Failed to generate summary. Please try again.'}`);
    }
  }, []);

  const handleAISummarize = useCallback((closeMenuFn: () => void) => {
    console.log('[AI Summarize] Starting for:', activeTab?.url);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    closeMenuFn();
    
    setAiSummaryText('🔍 Scanning page...');
    setIsAiDrawerVisible(true);
    
    if (!webViewRef.current) {
      console.log('[AI Summarize] No WebView ref - showing demo');
      setTimeout(() => {
        setAiSummaryText('ℹ️ **Navigate to a webpage first**\n\nOpen any website, then tap AI Summarize to generate a summary of its content.');
      }, 500);
      return;
    }
    
    console.log('[AI Summarize] Injecting extraction script');
    setAiSummaryText('🔍 Scanning page content...');
    webViewRef.current.injectJavaScript(extractTextScript);
  }, [activeTab?.url, webViewRef, extractTextScript]);

  const handleCloseAiDrawer = useCallback(() => {
    setIsAiDrawerVisible(false);
    setTimeout(() => setAiSummaryText(''), 300);
  }, []);

  return {
    isAiDrawerVisible,
    aiSummaryText,
    isCopied,
    handleCopySummary,
    generateAISummary,
    handleAISummarize,
    handleCloseAiDrawer,
  };
}
