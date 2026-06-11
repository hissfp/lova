import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/src/components/Avatar";
import { LanguagePair } from "@/src/components/LanguagePair";
import {
  LANGUAGES,
  PROFICIENCY_LEVELS,
  langName,
} from "@/src/constants/languages";
import { useAuth } from "@/src/context/AuthContext";
import { colors, fonts, radius, shadow, spacing } from "@/src/theme";
import { api, User } from "@/src/utils/api";

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [country, setCountry] = useState(user?.country || "");
  const [learningLang, setLearningLang] = useState(
    user?.learning_language || null,
  );
  const [proficiency, setProficiency] = useState(user?.proficiency || null);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.put<User>("/users/me", {
        name: name.trim() || user.name,
        bio,
        country,
        learning_language: learningLang,
        proficiency,
      });
      setUser(updated);
      setEditing(false);
    } catch {
      // stay in edit mode so the user can retry
    } finally {
      setSaving(false);
    }
  };

  const doLogout = async () => {
    await logout();
    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="profile-screen">
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Me</Text>
          <Pressable
            testID="profile-edit-btn"
            onPress={() => (editing ? save() : setEditing(true))}
            style={styles.editBtn}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.brand} />
            ) : (
              <Text style={styles.editBtnText}>
                {editing ? "Save" : "Edit"}
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.profileCard}>
          <Avatar name={user.name} url={user.avatar_url} size={80} />
          {editing ? (
            <TextInput
              testID="profile-name-input"
              style={[styles.input, styles.nameInput]}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.onSurfaceSecondary}
            />
          ) : (
            <Text style={styles.name}>{user.name}</Text>
          )}
          <Text style={styles.email}>{user.email}</Text>
          <LanguagePair
            native={user.native_language}
            learning={editing ? learningLang : user.learning_language}
          />
          {user.proficiency && !editing && (
            <Text style={styles.proficiency}>
              {langName(user.learning_language)} · {user.proficiency}
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About me</Text>
          {editing ? (
            <TextInput
              testID="profile-bio-input"
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell partners about yourself..."
              placeholderTextColor={colors.onSurfaceSecondary}
              multiline
            />
          ) : (
            <Text style={styles.bodyText}>
              {user.bio || "No bio yet. Tap Edit to add one!"}
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Country</Text>
          {editing ? (
            <TextInput
              testID="profile-country-input"
              style={styles.input}
              value={country}
              onChangeText={setCountry}
              placeholder="Where are you from?"
              placeholderTextColor={colors.onSurfaceSecondary}
            />
          ) : (
            <Text style={styles.bodyText}>{user.country || "Not set"}</Text>
          )}
        </View>

        {editing && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Learning language</Text>
              <View style={styles.chipWrap}>
                {LANGUAGES.filter((l) => l.code !== user.native_language).map(
                  (lang) => {
                    const active = learningLang === lang.code;
                    return (
                      <Pressable
                        key={lang.code}
                        testID={`profile-learning-${lang.code}`}
                        onPress={() => setLearningLang(lang.code)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            active && styles.chipTextActive,
                          ]}
                        >
                          {lang.flag} {lang.name}
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </View>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Level</Text>
              <View style={styles.chipWrap}>
                {PROFICIENCY_LEVELS.map((level) => {
                  const active = proficiency === level;
                  return (
                    <Pressable
                      key={level}
                      testID={`profile-level-${level.toLowerCase()}`}
                      onPress={() => setProficiency(level)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {level}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        )}

        <Pressable testID="logout-btn" style={styles.logoutBtn} onPress={doLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
  },
  scroll: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.onSurface,
  },
  editBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
  },
  editBtnText: {
    fontFamily: fonts.textBold,
    fontSize: 14,
    color: colors.onBrandTertiary,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
    ...shadow.card,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.onSurface,
  },
  email: {
    fontFamily: fonts.text,
    fontSize: 13,
    color: colors.onSurfaceSecondary,
  },
  proficiency: {
    fontFamily: fonts.textSemi,
    fontSize: 13,
    color: colors.onSurfaceSecondary,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  sectionTitle: {
    fontFamily: fonts.textBold,
    fontSize: 13,
    color: colors.onSurfaceSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bodyText: {
    fontFamily: fonts.text,
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSurface,
  },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.text,
    fontSize: 15,
    color: colors.onSurface,
  },
  nameInput: {
    alignSelf: "stretch",
    textAlign: "center",
  },
  bioInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
  },
  chipActive: {
    backgroundColor: colors.brandTertiary,
  },
  chipText: {
    fontFamily: fonts.textSemi,
    fontSize: 13,
    color: colors.onSurfaceTertiary,
  },
  chipTextActive: {
    color: colors.onBrandTertiary,
    fontFamily: fonts.textBold,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    ...shadow.card,
  },
  logoutText: {
    fontFamily: fonts.textBold,
    fontSize: 15,
    color: colors.error,
  },
});
