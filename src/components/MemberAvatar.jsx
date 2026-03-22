import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";

import { colors, fontSize } from "../constants/theme";

/*
|--------------------------------------------------------------------------
| Avatar Sizes
|--------------------------------------------------------------------------
*/

const SIZE_MAP = {
  small: 28,
  medium: 40,
  large: 64,
};

/*
|--------------------------------------------------------------------------
| Generate consistent color from name
|--------------------------------------------------------------------------
| Uses simple string hash so same name always produces same color
*/

const generateColorFromName = (name = "") => {
  let hash = 0;

  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const color = `hsl(${hash % 360}, 60%, 55%)`;

  return color;
};

/*
|--------------------------------------------------------------------------
| Get initials from name
|--------------------------------------------------------------------------
*/

const getInitials = (name = "") => {
  const parts = name.trim().split(" ");

  if (parts.length === 1) return parts[0][0]?.toUpperCase();

  return (
    parts[0][0]?.toUpperCase() + parts[parts.length - 1][0]?.toUpperCase()
  );
};

/*
|--------------------------------------------------------------------------
| MemberAvatar Component
|--------------------------------------------------------------------------
*/

export default function MemberAvatar({
  name = "",
  photoUrl,
  size = "medium",
  showRing = false,
  showOnline = false,
  stackIndex,
}) {
  const avatarSize = SIZE_MAP[size] || SIZE_MAP.medium;

  const bgColor = generateColorFromName(name);

  const initials = getInitials(name);

  /*
  |--------------------------------------------------------------------------
  | Stack overlap style
  |--------------------------------------------------------------------------
  */

  const stackStyle =
    stackIndex !== undefined
      ? {
          marginLeft: stackIndex === 0 ? 0 : -avatarSize * 0.35,
          borderWidth: 2,
          borderColor: colors.bg,
        }
      : {};

  return (
    <View
      style={[
        styles.avatar,
        {
          width: avatarSize,
          height: avatarSize,
          borderRadius: avatarSize / 2,
          backgroundColor: photoUrl ? "transparent" : bgColor,
        },
        showRing && styles.ring,
        stackStyle,
      ]}
    >
      {/* If photo exists show image */}
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
          }}
        />
      ) : (
        <Text
          style={[
            styles.initials,
            {
              fontSize:
                size === "large"
                  ? fontSize.lg
                  : size === "small"
                  ? fontSize.xs
                  : fontSize.sm,
            },
          ]}
        >
          {initials}
        </Text>
      )}

      {/* Online indicator */}
      {showOnline && (
        <View
          style={[
            styles.onlineDot,
            {
              width: avatarSize * 0.28,
              height: avatarSize * 0.28,
              borderRadius: avatarSize * 0.14,
            },
          ]}
        />
      )}
    </View>
  );
}

/*
|--------------------------------------------------------------------------
| Styles
|--------------------------------------------------------------------------
*/

const styles = StyleSheet.create({
  avatar: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  initials: {
    color: colors.text,
    fontWeight: "700",
  },

  ring: {
    borderWidth: 2,
    borderColor: colors.accent,
  },

  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.bg,
  },
});
