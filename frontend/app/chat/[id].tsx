import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/src/components/Avatar";
import { langName } from "@/src/constants/languages";
import { useAuth } from "@/src/context/AuthContext";
import { useChatSocket } from "@/src/hooks/use-chat-socket";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { api, Conversation, Message } from "@/src/utils/api";
import { clockTime } from "@/src/utils/time";

interface Correction {
  corrected: string;
  explanation: string;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<string | null>(null);
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [conv, msgs] = await Promise.all([
          api.get<Conversation>(`/chats/${id}`),
          api.get<Message[]>(`/chats/${id}/messages`),
        ]);
        setConversation(conv);
        setMessages(msgs);
        api.post(`/chats/${id}/read`).catch(() => {});
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useChatSocket(
    useCallback(
      (event) => {
        if (event.type === "new_message" && event.conversation_id === id && event.message) {
          const msg = event.message;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
          );
          api.post(`/chats/${id}/read`).catch(() => {});
        }
      },
      [id],
    ),
  );

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setCorrection(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const msg = await api.post<Message>(`/chats/${id}/messages`, { text });
      setMessages((prev) => [...prev, msg]);
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  const translate = async (msg: Message) => {
    if (translations[msg.id]) {
      setTranslations((prev) => {
        const next = { ...prev };
        delete next[msg.id];
        return next;
      });
      return;
    }
    setTranslating(msg.id);
    try {
      const result = await api.post<{ translated: string }>("/ai/translate", {
        text: msg.text,
        target_language: langName(user?.native_language || "en"),
      });
      setTranslations((prev) => ({ ...prev, [msg.id]: result.translated }));
    } catch {
      // leave bubble untranslated on failure
    } finally {
      setTranslating(null);
    }
  };

  const checkGrammar = async () => {
    const text = draft.trim();
    if (!text || correcting) return;
    setCorrecting(true);
    try {
      const result = await api.post<Correction>("/ai/correct", {
        text,
        language: langName(user?.learning_language),
      });
      setCorrection(result);
    } catch {
      // silently ignore; user can retry
    } finally {
      setCorrecting(false);
    }
  };

  const partner = conversation?.partner;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]} testID="chat-screen">
      <View style={styles.header}>
        <Pressable testID="chat-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        {partner && (
          <Pressable
            testID="chat-partner-header"
            style={styles.headerInfo}
            onPress={() => router.push(`/user/${partner.id}`)}
          >
            <Avatar name={partner.name} url={partner.avatar_url} size={38} />
            <View>
              <Text style={styles.headerName}>{partner.name}</Text>
              <Text style={styles.headerLang}>
                Native {langName(partner.native_language)} · Learning{" "}
                {langName(partner.learning_language)}
              </Text>
            </View>
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            ListEmptyComponent={
              <View style={styles.center}>
                <Ionicons name="hand-left-outline" size={48} color={colors.borderStrong} />
                <Text style={styles.emptyText}>
                  Say hello to {partner?.name?.split(" ")[0]}!
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const mine = item.sender_id === user?.id;
              const translated = translations[item.id];
              return (
                <View
                  style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}
                >
                  <View
                    style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
                  >
                    <Text
                      style={[styles.bubbleText, mine && styles.bubbleTextMine]}
                    >
                      {item.text}
                    </Text>
                    {translated && (
                      <View style={styles.translationBox}>
                        <Text
                          style={[
                            styles.translationText,
                            mine && styles.bubbleTextMine,
                          ]}
                        >
                          {translated}
                        </Text>
                      </View>
                    )}
                    <View style={styles.bubbleFooter}>
                      <Text
                        style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}
                      >
                        {clockTime(item.created_at)}
                      </Text>
                      {!mine && (
                        <Pressable
                          testID={`translate-btn-${item.id}`}
                          onPress={() => translate(item)}
                          hitSlop={8}
                        >
                          {translating === item.id ? (
                            <ActivityIndicator size="small" color={colors.brand} />
                          ) : (
                            <Ionicons
                              name="language"
                              size={16}
                              color={translated ? colors.brand : colors.onSurfaceSecondary}
                            />
                          )}
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )}

        {correction && (
          <View style={styles.correctionCard} testID="correction-card">
            <View style={styles.correctionHeader}>
              <Ionicons name="sparkles" size={16} color={colors.brand} />
              <Text style={styles.correctionTitle}>AI Suggestion</Text>
              <Pressable
                testID="correction-dismiss-btn"
                onPress={() => setCorrection(null)}
                hitSlop={8}
                style={{ marginLeft: "auto" }}
              >
                <Ionicons name="close" size={18} color={colors.onSurfaceSecondary} />
              </Pressable>
            </View>
            <Text style={styles.correctionText}>{correction.corrected}</Text>
            {correction.explanation ? (
              <Text style={styles.correctionExplanation}>
                {correction.explanation}
              </Text>
            ) : null}
            <Pressable
              testID="correction-apply-btn"
              style={styles.applyBtn}
              onPress={() => {
                setDraft(correction.corrected);
                setCorrection(null);
              }}
            >
              <Text style={styles.applyText}>Use this</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.inputRow}>
          <Pressable
            testID="grammar-check-btn"
            onPress={checkGrammar}
            style={[styles.toolBtn, !draft.trim() && { opacity: 0.4 }]}
            disabled={!draft.trim() || correcting}
          >
            {correcting ? (
              <ActivityIndicator size="small" color={colors.brand} />
            ) : (
              <Ionicons name="sparkles-outline" size={20} color={colors.brand} />
            )}
          </Pressable>
          <TextInput
            testID="chat-message-input"
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.onSurfaceSecondary}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <Pressable
            testID="chat-send-btn"
            onPress={send}
            style={[styles.sendBtn, (!draft.trim() || sending) && { opacity: 0.4 }]}
            disabled={!draft.trim() || sending}
          >
            <Ionicons name="send" size={18} color={colors.onBrand} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  headerName: {
    fontFamily: fonts.displaySemi,
    fontSize: 16,
    color: colors.onSurface,
  },
  headerLang: {
    fontFamily: fonts.text,
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    minHeight: 200,
  },
  emptyText: {
    fontFamily: fonts.textSemi,
    fontSize: 14,
    color: colors.onSurfaceSecondary,
  },
  messageList: {
    padding: spacing.lg,
    gap: spacing.sm,
    flexGrow: 1,
  },
  bubbleRow: {
    flexDirection: "row",
  },
  rowMine: {
    justifyContent: "flex-end",
  },
  rowTheirs: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.xs,
  },
  bubbleMine: {
    backgroundColor: colors.brand,
    borderBottomRightRadius: radius.sm / 2,
  },
  bubbleTheirs: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.sm / 2,
  },
  bubbleText: {
    fontFamily: fonts.text,
    fontSize: 15,
    lineHeight: 21,
    color: colors.onSurface,
  },
  bubbleTextMine: {
    color: colors.onBrand,
  },
  translationBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.xs + 2,
  },
  translationText: {
    fontFamily: fonts.textSemi,
    fontSize: 14,
    lineHeight: 20,
    color: colors.brand,
  },
  bubbleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  bubbleTime: {
    fontFamily: fonts.text,
    fontSize: 10,
    color: colors.onSurfaceSecondary,
  },
  bubbleTimeMine: {
    color: "rgba(255,255,255,0.8)",
  },
  correctionCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  correctionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  correctionTitle: {
    fontFamily: fonts.textBold,
    fontSize: 13,
    color: colors.onBrandTertiary,
  },
  correctionText: {
    fontFamily: fonts.textSemi,
    fontSize: 15,
    color: colors.onSurface,
  },
  correctionExplanation: {
    fontFamily: fonts.text,
    fontSize: 13,
    color: colors.onSurfaceSecondary,
    lineHeight: 18,
  },
  applyBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  applyText: {
    color: colors.onBrand,
    fontFamily: fonts.textBold,
    fontSize: 13,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  toolBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    fontFamily: fonts.text,
    fontSize: 15,
    color: colors.onSurface,
    maxHeight: 110,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
});
