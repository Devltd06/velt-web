import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SwipeBackContainer from '@/components/SwipeBackContainer';
import openai from '@/utils/openai';

export default function AISearchScreen(): React.ReactElement {
  const [messages, setMessages] = useState<{ id: string; role: 'user' | 'ai'; text: string; loading?: boolean }[]>([
    { id: 'welcome', role: 'ai', text: "Hi  I'm an AI quickstart assistant. Ask me anything!" },
  ]);

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const flatRef = useRef<FlatList<any> | null>(null);

  const quickPrompts = ["What's new in AI?", 'How do I run this app locally?', 'Explain blockchain simply'];

  const handleSend = async (text?: string) => {
    const txt = (text ?? input).trim();
    if (!txt) return;

    const userMsg = { id: `u-${Date.now()}`, role: 'user' as const, text: txt };
    setMessages(prev => [userMsg, ...prev]);
    setInput('');

    const typingId = `ai-typing-${Date.now()}`;
    setMessages(prev => [{ id: typingId, role: 'ai' as const, text: 'Thinking', loading: true }, ...prev]);
    setBusy(true);

    try {
      const reply = await openai.chatRaw(txt);
      const aiMsg = { id: `ai-${Date.now()}`, role: 'ai' as const, text: reply ?? 'No reply (check server/secrets).' };
      setMessages(prev => [aiMsg, ...prev.filter(m => !m.id.startsWith('ai-typing-'))]);
    } catch (err) {
      console.error('openai.chatRaw error', err);
      setMessages(prev => [{ id: `ai-${Date.now()}`, role: 'ai', text: 'Error calling AI proxy.' }, ...prev.filter(m => !m.id.startsWith('ai-typing-'))]);
    } finally {
      setBusy(false);
      setTimeout(() => flatRef.current?.scrollToOffset?.({ offset: 0, animated: true }), 80);
    }
  };

  const renderMessage = ({ item }: { item: { id: string; role: 'user' | 'ai'; text?: string; loading?: boolean } }) => {
    if (item.role === 'user') {
      return (
        <View style={styles.rowRight}>
          <View style={styles.bubbleUser}>
            <Text style={{ color: '#fff' }}>{item.text}</Text>
          </View>
        </View>
      );
    }

    return (
        <View style={styles.rowLeft}>
        <View style={styles.bubbleAi}>
          {item.loading ? <ActivityIndicator /> : <Text>{item.text}</Text>}
        </View>
      </View>
    );
  };

  return (
    <SwipeBackContainer>
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>AI quickstart  Chat</Text>
          <Text style={{ color: '#666', fontSize: 12 }}>A minimal ChatGPT-style UI for local development.</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
        <FlatList
          data={quickPrompts}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={s => s}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setInput(item)} style={styles.chip}>
              <Text style={{ color: '#0b6ea9' }}>{item}</Text>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
        />
      </View>

      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={renderMessage}
        contentContainerStyle={{ padding: 12 }}
        inverted
        showsVerticalScrollIndicator={false}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputRow}>
          <View style={styles.inputBox}>
            <TextInput
              placeholder="Ask anything"
              value={input}
              onChangeText={setInput}
              style={styles.textInput}
              onSubmitEditing={() => handleSend(input)}
              returnKeyType="send"
              editable={!busy}
            />
          </View>

          <TouchableOpacity style={[styles.sendBtn, { backgroundColor: busy ? '#9aaab3' : '#1d3130' }]} onPress={() => handleSend(input)} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff' }}>Send</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#eef7fb' },
  rowLeft: { alignSelf: 'flex-start', maxWidth: '94%' },
  rowRight: { alignSelf: 'flex-end', maxWidth: '94%', alignItems: 'flex-end' },
  bubbleAi: { padding: 12, borderRadius: 12, minWidth: 100, backgroundColor: '#f3f6f9' },
  bubbleUser: { padding: 12, borderRadius: 12, minWidth: 80, maxWidth: '90%', backgroundColor: '#1d3130' },
  inputRow: { padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  inputBox: { flex: 1, height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff' },
  textInput: { flex: 1, paddingHorizontal: 12, fontSize: 15, height: '100%' },
  sendBtn: { marginLeft: 8, width: 72, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
