import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/src/theme";

interface AvatarProps {
  name?: string | null;
  url?: string | null;
  size?: number;
  testID?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  url,
  size = 48,
  testID,
}) => {
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (url) {
    return (
      <Image
        testID={testID}
        source={{ uri: url }}
        style={style}
        contentFit="cover"
        transition={150}
      />
    );
  }
  const initials = (name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <View testID={testID} style={[styles.fallback, style]}>
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>
        {initials}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: colors.onBrandTertiary,
    fontFamily: fonts.displaySemi,
  },
});
