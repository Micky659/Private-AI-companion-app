// screens/ChatScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native';
import { dbService, Message } from '../services/SQLiteService';
import { llmService, MODEL_CONFIGS } from '../services/LLMService';

interface ChatScreenProps {
  systemPrompt: string;
}

export default function ChatScreen({ systemPrompt }: ChatScreenProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState('Initializing...');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    initializeChat();
    setupAppStateListener();
    
    return () => {
      llmService.release();
    };
  }, []);

  const setupAppStateListener = () => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
      console.log('App backgrounded');
    }
    appState.current = nextAppState;
  };

  async function initializeChat() {
    try {
      const history = await dbService.getAllMessages();
      setMessages(history);

      if (llmService.isReady()) {
        setStatus('Ready');
        return;
      }

      setStatus('Checking model...');
      
      await llmService.initialize(
        { ...MODEL_CONFIGS.LFM_INSTRUCT, systemPrompt },
        (progress) => {
          setDownloadProgress(progress);
          setStatus(progress < 1 ? `Downloading... ${Math.round(progress * 100)}%` : 'Initializing AI...');
        }
      );

      setStatus('Ready');
      setDownloadProgress(0);
    } catch (error: any) {
      console.error('Initialization error:', error);
      setStatus('AI Engine Error');
    }
  }

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || !llmService.isReady() || isGenerating) return;

    setInput('');
    setSuggestions([]);

    const userMessage: Message = {
      id: Date.now(),
      content: textToSend,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    await dbService.addMessage(textToSend, 'user');

    setIsGenerating(true);

    try {
      // 1. Wait for the entire response to finish
      const result = await llmService.generateResponse(
        textToSend,
        messages,
        { temperature: 0.7, maxTokens: 512 }
      );

      console.log('Raw AI response:', result);

      // 2. Clean the full text after it's fully generated
      const finalCleanText = result.text

      const aiMessage: Message = {
        id: Date.now() + 1,
        content: finalCleanText,
        sender: 'assistant',
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, aiMessage]);

      await dbService.addMessage(
        finalCleanText,
        'assistant',
        result.suggestions ? JSON.stringify({ options: result.suggestions }) : undefined
      );

      if (result.suggestions) {
        setSuggestions(result.suggestions);
      }

    } catch (error) {
      console.error('Generation error:', error);
      const errorMessage: Message = {
        id: Date.now() + 1,
        content: "Sorry, I'm having trouble responding right now.",
        sender: 'assistant',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  const renderMessage = (message: Message, index: number) => {
    const isUser = message.sender === 'user';
    const cleanText = message.content
    if (!cleanText) return null;

    // Split text into multiple bubbles by line breaks
    const bubbles = cleanText.split('\n').filter(line => line.trim() !== '');

    return (
      <View key={message.id || index} style={[styles.messageGroup, isUser ? styles.groupRight : styles.groupLeft]}>
        {bubbles.map((line, i) => (
          <View key={i} style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble, i > 0 && { marginTop: 4 }]}>
            <Text style={isUser ? styles.userText : styles.aiText}>{line.trim()}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
            <Text style={styles.title}>Vi</Text>
            <View style={[styles.statusDot, { backgroundColor: llmService.isReady() ? '#10B981' : '#F59E0B' }]} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map(renderMessage)}
          
          {/* While waiting for the batch response, show thinking indicator */}
          {isGenerating && (
            <View style={[styles.messageGroup, styles.groupLeft]}>
              <View style={[styles.bubble, styles.aiBubble, styles.thinkingBubble]}>
                <ActivityIndicator size="small" color="#94A3B8" />
                <Text style={styles.thinkingText}>Vi is thinking...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor="#64748B"
            value={input}
            onChangeText={setInput}
            editable={llmService.isReady() && !isGenerating}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || isGenerating) && styles.sendButtonDisabled]}
            onPress={() => handleSend()}
            disabled={!input.trim() || isGenerating}
          >
            <Text style={styles.sendButtonText}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { backgroundColor: '#1E293B', paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#334155' },
  title: { fontSize: 18, fontWeight: '700', color: '#E2E8F0', marginRight: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  chatArea: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 30 },
  messageGroup: { marginBottom: 16, width: '100%' },
  groupLeft: { alignItems: 'flex-start' },
  groupRight: { alignItems: 'flex-end' },
  bubble: { maxWidth: '85%', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18 },
  userBubble: { backgroundColor: '#2DD4BF', borderBottomRightRadius: 2 },
  aiBubble: { backgroundColor: '#1E293B', borderBottomLeftRadius: 2 },
  thinkingBubble: { flexDirection: 'row', alignItems: 'center', opacity: 0.8 },
  thinkingText: { color: '#94A3B8', fontSize: 12, marginLeft: 8, fontStyle: 'italic' },
  userText: { color: '#0F172A', fontSize: 16, lineHeight: 22 },
  aiText: { color: '#E2E8F0', fontSize: 16, lineHeight: 22 },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: '#1E293B', borderTopWidth: 1, borderTopColor: '#334155' },
  input: { flex: 1, backgroundColor: '#0F172A', color: '#E2E8F0', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, minHeight: 44, maxHeight: 100, borderWidth: 1, borderColor: '#334155' },
  sendButton: { width: 44, height: 44, backgroundColor: '#2DD4BF', borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  sendButtonDisabled: { backgroundColor: '#334155', opacity: 0.5 },
  sendButtonText: { fontSize: 20, color: '#0F172A', fontWeight: 'bold' },
});