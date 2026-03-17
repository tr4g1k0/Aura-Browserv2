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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrowserStore } from '../src/store/browserStore';
import * as Haptics from 'expo-haptics';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
}

// Mock responses for different commands
const MOCK_RESPONSES: Record<string, (context: any) => string> = {
  summarize: (ctx) => `📋 **Summary of ${ctx.title || 'this page'}**

• This page contains information about ${ctx.domain || 'web content'}
• Key topics include technology, user experience, and modern web standards
• The content is well-structured with clear navigation
• Estimated reading time: 3-5 minutes

_Tip: Ask me to "find prices" or "extract links" for more actions!_`,

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

Would you like me to open any of these?`,

  contact: () => `📧 **Contact Information Found:**

• Email: support@example.com
• Phone: +1 (555) 123-4567
• Address: 123 Tech Street, San Francisco, CA
• Social: @example on Twitter

Shall I copy any of this information?`,

  default: (ctx) => `I understand you want to: "${ctx.command}"

Here's what I can help with on ${ctx.domain || 'this page'}:

• **Summarize** - Get a quick overview
• **Find prices** - Locate pricing info
• **Extract links** - List all links
• **Find contact** - Get contact details

Try one of these commands!`,
};

export default function AIAgentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const { tabs } = useBrowserStore();

  const activeTab = tabs.find((t) => t.isActive) || tabs[0];

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `👋 Hey! I'm your AI Browser Agent.

I can help you interact with **${activeTab?.title || 'the current page'}**.

Try these commands:
• "Summarize this page"
• "Find the cheapest price"
• "Extract all links"
• "Find contact information"`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingDots = useRef(new Animated.Value(0)).current;

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

    // Simulate AI "thinking" delay (1 second as requested)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get mock response
    const responseText = getMockResponse(userCommand);

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: responseText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setIsTyping(false);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, isTyping]);

  const renderMessage = (message: Message) => (
    <Animated.View
      key={message.id}
      style={[
        styles.messageBubble,
        message.role === 'user' ? styles.userBubble : styles.assistantBubble,
      ]}
    >
      {message.role === 'assistant' && (
        <View style={styles.avatarContainer}>
          <Ionicons name="sparkles" size={16} color="#00FF88" />
        </View>
      )}
      <View
        style={[
          styles.messageContent,
          message.role === 'user' ? styles.userContent : styles.assistantContent,
        ]}
      >
        <Text style={[
          styles.messageText,
          message.role === 'user' && styles.userMessageText,
        ]}>
          {message.content}
        </Text>
      </View>
    </Animated.View>
  );

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

  // Quick action buttons
  const QuickActions = () => (
    <View style={styles.quickActions}>
      {['Summarize', 'Find prices', 'Extract links'].map((action) => (
        <TouchableOpacity
          key={action}
          style={styles.quickActionButton}
          onPress={() => {
            setInput(action + ' on this page');
            inputRef.current?.focus();
          }}
        >
          <Text style={styles.quickActionText}>{action}</Text>
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
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.agentIcon}>
            <Ionicons name="sparkles" size={20} color="#0D0D0D" />
          </View>
          <View>
            <Text style={styles.headerTitle}>AI Agent</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {activeTab ? (() => {
                try {
                  return new URL(activeTab.url).hostname;
                } catch {
                  return 'Current page';
                }
              })() : 'No page loaded'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
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
        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask me anything about this page..."
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
  headerSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    maxWidth: 200,
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
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#FFF',
  },
  userMessageText: {
    color: '#0D0D0D',
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
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
