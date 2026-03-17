import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrowserStore } from '../src/store/browserStore';
import {
  parseAgentCommand,
  formatSitemapForDisplay,
  PageSitemap,
} from '../src/services/AIAgentExecutionService';
import { PrivacyManifestModal } from '../src/components/PrivacyManifestModal';
import { AIAnalyzingIndicator } from '../src/components/AIAnalyzingIndicator';
import {
  initAgentMemory,
  addPageToContext,
  recordAgentAction,
} from '../src/services/PrivacyService';
import * as Haptics from 'expo-haptics';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
  isAction?: boolean;
  actionType?: string;
  actionSuccess?: boolean;
}

// Action result types we can receive from the WebView
interface ActionResult {
  type: string;
  success?: boolean;
  message?: string;
  sitemap?: PageSitemap;
}

// Mock responses for informational commands
const MOCK_RESPONSES: Record<string, (context: any) => string> = {
  summarize: (ctx) => `📋 **Summary of ${ctx.title || 'this page'}**

• This page contains information about ${ctx.domain || 'web content'}
• Key topics include technology, user experience, and modern web standards
• The content is well-structured with clear navigation
• Estimated reading time: 3-5 minutes

_Tip: Try "scroll down" or "find the search field" for actions!_`,

  prices: () => `💰 **Prices Found on This Page:**

• Item 1: $29.99 → Best value
• Item 2: $49.99
• Item 3: $19.99 → Lowest price
• Item 4: $99.99

✨ **Recommendation:** Item 3 offers the best deal at $19.99!`,

  links: () => `🔗 **Links Extracted:**

• Navigation: Home, About, Contact (3)
• External Links: 12 found
• Social Media: Twitter, LinkedIn, GitHub
• Resources: Documentation, FAQ, Support

Would you like me to click any of these?`,

  contact: () => `📧 **Contact Information Found:**

• Email: support@example.com
• Phone: +1 (555) 123-4567
• Address: 123 Tech Street, San Francisco, CA
• Social: @example on Twitter

Shall I copy any of this information?`,

  default: (ctx) => `I understand you want to: "${ctx.command}"

Here's what I can do on ${ctx.domain || 'this page'}:

📖 **Information:**
• "Summarize this page"
• "Find prices" / "Extract links"

🎮 **Actions:**
• "Scroll down" / "Scroll up"
• "Click the [button name]"
• "Type [text] in the search field"
• "Find the login button"

Try one of these commands!`,
};

// Action-specific mock responses
const ACTION_RESPONSES: Record<string, (result: ActionResult, ctx: any) => string> = {
  SCROLL: (result) => `✅ **${result.message || 'Scrolled successfully'}**

The page has been scrolled. What would you like to do next?
• "Scroll more" - Continue scrolling
• "Go back to top" - Return to the beginning`,

  CLICK: (result) => result.success 
    ? `✅ **${result.message || 'Click successful!'}**

I clicked the element. The page may be updating...`
    : `⚠️ **${result.message || 'Could not find that element'}**

Try being more specific, like:
• "Click the Sign In button"
• "Click Submit"`,

  INPUT: (result) => result.success
    ? `✅ **${result.message || 'Text entered successfully!'}**

The text has been typed. Would you like me to submit the form?`
    : `⚠️ **${result.message || 'Could not find that input field'}**

Try:
• "Type [text] in the search box"
• "Enter [text] in the email field"`,

  READ: (result, ctx) => {
    if (result.sitemap) {
      return formatSitemapForDisplay(result.sitemap);
    }
    return `📄 I'm analyzing the page structure...`;
  },
};

export default function AIAgentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const { tabs, isLoading: pageIsLoading } = useBrowserStore();

  const activeTab = tabs.find((t) => t.isActive) || tabs[0];

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `👋 Hey! I'm your AI Browser Agent.

I can help you interact with **${activeTab?.title || 'the current page'}**.

🎮 **Actions I can perform:**
• "Scroll down" / "Scroll up"
• "Click the [button name]"
• "Type [text] in the [field name]"
• "Find the login button"

📖 **Information I can get:**
• "Summarize this page"
• "Find prices" / "Extract links"

What would you like me to do?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isWaitingForPage, setIsWaitingForPage] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [isAnalyzingPage, setIsAnalyzingPage] = useState(false);
  const typingDots = useRef(new Animated.Value(0)).current;

  // Initialize agent memory on mount
  useEffect(() => {
    initAgentMemory();
    if (activeTab?.url) {
      addPageToContext(activeTab.url, activeTab.title);
    }
  }, []);

  // Track action queue for safety guardrail
  const actionQueueRef = useRef<Array<{ command: string; timestamp: number }>>([]);

  // Typing animation
  useEffect(() => {
    if (isTyping) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(typingDots, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(typingDots, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [isTyping]);

  // Safety guardrail: Check if page is loading
  useEffect(() => {
    if (pageIsLoading) {
      setIsWaitingForPage(true);
    } else if (isWaitingForPage) {
      setIsWaitingForPage(false);
      // Process any queued actions
      if (pendingAction) {
        addSystemMessage('Page loaded. Executing your command now...');
        processCommand(pendingAction);
        setPendingAction(null);
      }
    }
  }, [pageIsLoading]);

  const handleClose = () => {
    Keyboard.dismiss();
    router.back();
  };

  const getContext = useCallback(() => {
    let domain = 'example.com';
    try {
      if (activeTab?.url) {
        domain = new URL(activeTab.url).hostname;
      }
    } catch {}

    return {
      url: activeTab?.url || '',
      title: activeTab?.title || 'Current Page',
      domain,
    };
  }, [activeTab]);

  const addSystemMessage = (content: string) => {
    const systemMessage: Message = {
      id: Date.now().toString(),
      role: 'system',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  const addActionMessage = (actionType: string, success: boolean, message: string) => {
    const actionMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: message,
      timestamp: new Date(),
      isAction: true,
      actionType,
      actionSuccess: success,
    };
    setMessages(prev => [...prev, actionMessage]);
  };

  const getMockResponse = useCallback((command: string): string => {
    const ctx = { ...getContext(), command };
    const lowerCommand = command.toLowerCase();

    if (lowerCommand.includes('summar')) {
      return MOCK_RESPONSES.summarize(ctx);
    }
    if (lowerCommand.includes('price') || lowerCommand.includes('cheap') || lowerCommand.includes('cost')) {
      return MOCK_RESPONSES.prices(ctx);
    }
    if (lowerCommand.includes('link') || lowerCommand.includes('url')) {
      return MOCK_RESPONSES.links(ctx);
    }
    if (lowerCommand.includes('contact') || lowerCommand.includes('email') || lowerCommand.includes('phone')) {
      return MOCK_RESPONSES.contact(ctx);
    }

    return MOCK_RESPONSES.default(ctx);
  }, [getContext]);

  const processCommand = useCallback(async (command: string) => {
    const ctx = getContext();
    const parsedCommand = parseAgentCommand(command);

    if (parsedCommand) {
      // This is an actionable command
      const { action, selector, value, direction } = parsedCommand;

      // Record action for privacy tracking
      recordAgentAction();

      // Show analyzing indicator for READ actions
      if (action === 'READ') {
        setIsAnalyzingPage(true);
      }

      // Send action to parent (browser) via global event
      // In production, this would use a proper communication channel
      const actionEvent = {
        type: action,
        selector,
        value,
        direction,
      };

      // Store the action for the browser to execute
      if (typeof window !== 'undefined') {
        (window as any).__AGENT_ACTION__ = actionEvent;
        (window as any).__AGENT_ACTION_CALLBACK__ = (result: ActionResult) => {
          const responseGenerator = ACTION_RESPONSES[action] || ACTION_RESPONSES.CLICK;
          const response = responseGenerator(result, ctx);
          addActionMessage(action, result.success || false, response);
          setIsTyping(false);
          setIsAnalyzingPage(false);
        };
      }

      // Simulate the action execution
      await new Promise(resolve => setTimeout(resolve, action === 'READ' ? 1500 : 800));

      // Generate mock response based on action type
      const mockResult: ActionResult = {
        type: action,
        success: true,
        message: action === 'SCROLL' 
          ? `Scrolled ${direction || 'down'}` 
          : action === 'CLICK'
            ? `Clicked element: ${value || selector || 'button'}`
            : action === 'INPUT'
              ? `Entered text into ${selector || 'field'}`
              : action === 'READ'
                ? 'Page structure analyzed'
                : 'Action completed',
      };

      // For READ action, generate mock sitemap
      if (action === 'READ') {
        mockResult.sitemap = {
          url: activeTab?.url || '',
          title: activeTab?.title || 'Page',
          buttons: [
            { tag: 'button', selector: 'button.login', text: 'Sign In', isVisible: true, isInteractive: true },
            { tag: 'button', selector: 'button.signup', text: 'Create Account', isVisible: true, isInteractive: true },
            { tag: 'button', selector: 'button.search', text: 'Search', isVisible: true, isInteractive: true },
          ],
          inputs: [
            { tag: 'input', selector: 'input[name="search"]', type: 'text', placeholder: 'Search...', isVisible: true, isInteractive: true },
            { tag: 'input', selector: 'input[name="email"]', type: 'email', placeholder: 'Email address', isVisible: true, isInteractive: true },
          ],
          links: [
            { tag: 'a', selector: 'a.nav-home', text: 'Home', href: '/', isVisible: true, isInteractive: true },
            { tag: 'a', selector: 'a.nav-about', text: 'About', href: '/about', isVisible: true, isInteractive: true },
            { tag: 'a', selector: 'a.nav-contact', text: 'Contact', href: '/contact', isVisible: true, isInteractive: true },
          ],
          textAreas: [],
          selects: [],
          images: [],
          headings: [
            { level: 1, text: activeTab?.title || 'Welcome' },
          ],
        };
      }

      const responseGenerator = ACTION_RESPONSES[action] || ACTION_RESPONSES.CLICK;
      const response = responseGenerator(mockResult, ctx);
      addActionMessage(action, mockResult.success || false, response);
      
      // Hide analyzing indicator
      setIsAnalyzingPage(false);
      
      Haptics.notificationAsync(
        mockResult.success 
          ? Haptics.NotificationFeedbackType.Success 
          : Haptics.NotificationFeedbackType.Warning
      );
    } else {
      // Non-actionable command - use mock responses
      await new Promise(resolve => setTimeout(resolve, 1000));
      const responseText = getMockResponse(command);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setIsTyping(false);
    setIsAnalyzingPage(false);
  }, [getContext, getMockResponse, activeTab]);

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userCommand = input.trim();
    setInput('');
    setIsTyping(true);

    // Safety guardrail: Check if page is loading
    if (pageIsLoading) {
      addSystemMessage('⏳ Waiting for page to load...');
      setPendingAction(userCommand);
      setIsTyping(false);
      return;
    }

    await processCommand(userCommand);
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, isTyping]);

  const renderMessage = (message: Message) => {
    const isSystem = message.role === 'system';
    const isAction = message.isAction;

    return (
      <Animated.View
        key={message.id}
        style={[
          styles.messageBubble,
          message.role === 'user' ? styles.userBubble : styles.assistantBubble,
          isSystem && styles.systemBubble,
        ]}
      >
        {message.role === 'assistant' && (
          <View style={[
            styles.avatarContainer,
            isAction && (message.actionSuccess ? styles.avatarSuccess : styles.avatarWarning),
          ]}>
            <Ionicons 
              name={isAction ? (message.actionSuccess ? 'checkmark' : 'alert') : 'sparkles'} 
              size={16} 
              color={isAction ? (message.actionSuccess ? '#00FF88' : '#FFB800') : '#00FF88'} 
            />
          </View>
        )}
        <View
          style={[
            styles.messageContent,
            message.role === 'user' ? styles.userContent : styles.assistantContent,
            isSystem && styles.systemContent,
            isAction && styles.actionContent,
          ]}
        >
          {isAction && message.actionType && (
            <View style={styles.actionBadge}>
              <Text style={styles.actionBadgeText}>
                {message.actionType}
              </Text>
            </View>
          )}
          <Text style={[
            styles.messageText,
            message.role === 'user' && styles.userMessageText,
            isSystem && styles.systemMessageText,
          ]}>
            {message.content}
          </Text>
        </View>
      </Animated.View>
    );
  };

  const renderTypingIndicator = () => (
    <View style={[styles.messageBubble, styles.assistantBubble]}>
      <View style={styles.avatarContainer}>
        <Ionicons name="sparkles" size={16} color="#00FF88" />
      </View>
      <View style={[styles.messageContent, styles.assistantContent, styles.typingContent]}>
        <Animated.View
          style={[
            styles.typingDot,
            {
              opacity: typingDots.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 1],
              }),
            },
          ]}
        />
        <Animated.View
          style={[
            styles.typingDot,
            {
              opacity: typingDots.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.3, 1, 0.3],
              }),
            },
          ]}
        />
        <Animated.View
          style={[
            styles.typingDot,
            {
              opacity: typingDots.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.3],
              }),
            },
          ]}
        />
      </View>
    </View>
  );

  // Quick action buttons with actions
  const QuickActions = () => (
    <View style={styles.quickActions}>
      {[
        { label: 'Scroll down', icon: 'arrow-down' },
        { label: 'Read page', icon: 'document-text' },
        { label: 'Summarize', icon: 'list' },
      ].map((action) => (
        <TouchableOpacity
          key={action.label}
          style={styles.quickActionButton}
          onPress={() => {
            setInput(action.label);
            inputRef.current?.focus();
          }}
        >
          <Ionicons name={action.icon as any} size={14} color="#888" />
          <Text style={styles.quickActionText}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* AI Analyzing Indicator */}
      <AIAnalyzingIndicator visible={isAnalyzingPage} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.agentIcon}>
            <Ionicons name="sparkles" size={20} color="#0D0D0D" />
          </View>
          <View>
            <Text style={styles.headerTitle}>AI Agent</Text>
            <View style={styles.headerSubtitleRow}>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {activeTab ? (() => {
                  try {
                    return new URL(activeTab.url).hostname;
                  } catch {
                    return 'Current page';
                  }
                })() : 'No page loaded'}
              </Text>
              {pageIsLoading && (
                <View style={styles.loadingBadge}>
                  <ActivityIndicator size={10} color="#FFB800" />
                  <Text style={styles.loadingBadgeText}>Loading</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          {/* Privacy Info Button */}
          <TouchableOpacity 
            style={styles.privacyButton} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setPrivacyModalVisible(true);
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color="#8B5CF6" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map(renderMessage)}
        {isTyping && renderTypingIndicator()}
      </ScrollView>

      {/* Quick Actions */}
      <QuickActions />

      {/* Input */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 8 }]}>
        {isWaitingForPage && (
          <View style={styles.waitingBanner}>
            <ActivityIndicator size="small" color="#FFB800" />
            <Text style={styles.waitingText}>Waiting for page to load...</Text>
          </View>
        )}
        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Try 'Scroll down' or 'Click the login button'..."
            placeholderTextColor="#666"
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            editable={!isTyping}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!input.trim() || isTyping) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!input.trim() || isTyping}
          >
            <Ionicons
              name="send"
              size={20}
              color={input.trim() && !isTyping ? '#0D0D0D' : '#666'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Privacy Manifest Modal */}
      <PrivacyManifestModal
        visible={privacyModalVisible}
        onClose={() => setPrivacyModalVisible(false)}
      />
    </KeyboardAvoidingView>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  agentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00FF88',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#888',
    maxWidth: 150,
  },
  loadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 184, 0, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
    gap: 4,
  },
  loadingBadgeText: {
    fontSize: 10,
    color: '#FFB800',
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  privacyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B5CF615',
    borderWidth: 1,
    borderColor: '#8B5CF640',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  userBubble: {
    justifyContent: 'flex-end',
  },
  assistantBubble: {
    justifyContent: 'flex-start',
  },
  systemBubble: {
    justifyContent: 'center',
  },
  avatarContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1A2A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 4,
  },
  avatarSuccess: {
    backgroundColor: '#1A2A1A',
  },
  avatarWarning: {
    backgroundColor: '#2A2A1A',
  },
  messageContent: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  userContent: {
    backgroundColor: '#00FF88',
    borderBottomRightRadius: 4,
    marginLeft: 'auto',
  },
  assistantContent: {
    backgroundColor: '#1A1A1A',
    borderBottomLeftRadius: 4,
  },
  systemContent: {
    backgroundColor: 'transparent',
    maxWidth: '100%',
    alignSelf: 'center',
  },
  actionContent: {
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  actionBadge: {
    backgroundColor: '#2A2A2A',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 8,
  },
  actionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00FF88',
    letterSpacing: 0.5,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#FFF',
  },
  userMessageText: {
    color: '#0D0D0D',
  },
  systemMessageText: {
    color: '#888',
    textAlign: 'center',
    fontSize: 13,
    fontStyle: 'italic',
  },
  typingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00FF88',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
    gap: 6,
  },
  quickActionText: {
    fontSize: 12,
    color: '#888',
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  waitingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 184, 0, 0.1)',
    paddingVertical: 8,
    marginBottom: 8,
    borderRadius: 8,
    gap: 8,
  },
  waitingText: {
    fontSize: 12,
    color: '#FFB800',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#FFF',
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00FF88',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#2A2A2A',
  },
});
