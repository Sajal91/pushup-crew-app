import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, glows, spacing } from '@/theme';
import { Kicker } from '@/components/Kicker';
import { SectionTitle } from '@/components/SectionTitle';
import { useAppStore } from '@/state/useAppStore';
import type { ChatMessage } from '@/types';

const QUICK_REPLIES = ['💪 let\'s go', 'eat sleep pushup', 'bro how', 'pot\'s growing'];

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const me = useAppStore((s) => s.meId);
  const crew = useAppStore((s) => s.crew);
  const chat = useAppStore((s) => s.chat);
  const sendChat = useAppStore((s) => s.sendChat);
  const crewMeta = useAppStore((s) => s.crewMeta);

  const [draft, setDraft] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: false });
  }, [chat.length]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const send = () => {
    if (!draft.trim()) return;
    sendChat(draft.trim());
    setDraft('');
  };

  const nameOf = (id: string) => crew.find((m) => m.id === id)?.name ?? id;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={{ paddingBottom: 8 }}>
        <SectionTitle kicker="CREW">{crewMeta.name}</SectionTitle>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={chat}
          keyExtractor={(item) => String(item.id)}
          style={{ flex: 1 }}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item: m }) => {
            if (m.system) {
              return (
                <View style={styles.systemPillWrap}>
                  <Text style={styles.systemPill}>// {m.text}</Text>
                </View>
              );
            }
            const mine = m.who === me;
            return (
              <View
                style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}
              >
                {!mine ? (
                  <Text style={styles.meta}>
                    {nameOf(m.who).toLowerCase()} · {m.t}
                  </Text>
                ) : null}
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine && { color: '#000' }]}>{m.text}</Text>
                </View>
                {mine ? <Text style={[styles.meta, styles.metaMine]}>{m.t}</Text> : null}
              </View>
            );
          }}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickScroll}
          contentContainerStyle={styles.quickRow}
        >
          {QUICK_REPLIES.map((q) => (
            <Pressable key={q} onPress={() => sendChat(q)} style={styles.quickChip}>
              <Text style={styles.quickLabel}>{q}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View
          style={[
            styles.composer,
            {
              paddingBottom: keyboardVisible ? Math.max(insets.bottom, 12) : 96,
            },
          ]}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="say something..."
            placeholderTextColor={colors.dim}
            style={styles.input}
            onSubmitEditing={send}
          />
          <Pressable onPress={send} style={styles.sendBtn}>
            <Text style={styles.sendArrow}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  messages: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 14,
    gap: 10,
  },
  bubbleRow: {
    maxWidth: '78%',
  },
  rowMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  rowTheirs: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.dim,
    letterSpacing: 1,
    marginBottom: 4,
  },
  metaMine: {
    marginTop: 4,
    marginBottom: 0,
  },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  bubbleTheirs: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  bubbleMine: {
    backgroundColor: colors.acid,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  bubbleText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  systemPillWrap: {
    alignSelf: 'center',
  },
  systemPill: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.acid,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.acid,
    backgroundColor: colors.bg,
  },
  quickScroll: {
    maxHeight: 56,
  },
  quickRow: {
    paddingHorizontal: spacing.screen,
    paddingVertical: 10,
    gap: 8,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
  },
  quickLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.text,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingTop: 6,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.body,
    color: colors.text,
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.acid,
    alignItems: 'center',
    justifyContent: 'center',
    ...glows.acidButton,
  },
  sendArrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 22,
    color: '#000',
  },
});
