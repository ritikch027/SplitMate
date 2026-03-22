import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

import { colors, spacing, radius, fontSize } from "../constants/theme";

/*
|--------------------------------------------------------------------------
| Category color map
|--------------------------------------------------------------------------
*/

const CATEGORY_COLORS = {
  Food: "#F59E0B",
  Transport: "#3B82F6",
  Rent: "#8B5CF6",
  Shopping: "#EC4899",
  Entertainment: "#06B6D4",
  Other: "#6B7280",
};

/*
|--------------------------------------------------------------------------
| Currency formatter (Indian format)
|--------------------------------------------------------------------------
*/

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-IN").format(amount);
};

/*
|--------------------------------------------------------------------------
| Date formatter
|--------------------------------------------------------------------------
*/

const formatDate = (timestamp) => {
  if (!timestamp) return "";

  const date = timestamp.toDate();
  const today = new Date();
  const yesterday = new Date();

  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });
};

/*
|--------------------------------------------------------------------------
| ExpenseItem Component
|--------------------------------------------------------------------------
*/

export default function ExpenseItem({
  expense,
  currentUserId,
  onPress,
}) {
  const {
    description,
    amount,
    category,
    paidBy,
    paidByName,
    splitBetween,
    createdAt,
  } = expense;

  /*
  |--------------------------------------------------------------------------
  | Calculate share per user
  |--------------------------------------------------------------------------
  */

  const share = amount / splitBetween.length;

  /*
  |--------------------------------------------------------------------------
  | Determine if current user paid
  |--------------------------------------------------------------------------
  */

  const youPaid = paidBy === currentUserId;

  /*
  |--------------------------------------------------------------------------
  | Text for user balance
  |--------------------------------------------------------------------------
  */

  let shareText = "";
  let shareStyle = styles.oweText;

  if (youPaid) {
    shareText = `you get ₹${formatCurrency(share)}`;
    shareStyle = styles.getText;
  } else {
    shareText = `you owe ₹${formatCurrency(share)}`;
  }

  /*
  |--------------------------------------------------------------------------
  | Truncate long descriptions
  |--------------------------------------------------------------------------
  */

  const shortDescription =
    description.length > 25
      ? description.substring(0, 25) + "..."
      : description;

  const categoryColor = CATEGORY_COLORS[category] || CATEGORY_COLORS.Other;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      {/* Swipe background hint */}
      <View style={styles.swipeHint}>
        <View style={styles.deleteHint} />
      </View>

      {/* Main row */}
      <View style={styles.container}>
        {/* Left Category Icon */}
        <View style={[styles.iconBox, { backgroundColor: categoryColor }]}>
          <Text style={styles.iconText}>
            {category?.charAt(0) || "O"}
          </Text>
        </View>

        {/* Center Content */}
        <View style={styles.center}>
          <Text style={styles.description}>{shortDescription}</Text>

          <Text style={styles.meta}>Paid by {paidByName || paidBy}</Text>

          <Text style={styles.meta}>
            {formatDate(createdAt)}
          </Text>
        </View>

        {/* Right Amount */}
        <View style={styles.right}>
          <Text style={styles.amount}>
            ₹{formatCurrency(amount)}
          </Text>

          <Text style={[styles.share, shareStyle]}>
            {shareText}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/*
|--------------------------------------------------------------------------
| Styles
|--------------------------------------------------------------------------
*/

const styles = StyleSheet.create({
  swipeHint: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 30,
    backgroundColor: colors.danger,
    opacity: 0.2,
  },

  deleteHint: {
    flex: 1,
  },

  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  iconBox: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },

  iconText: {
    color: colors.text,
    fontWeight: "600",
    fontSize: fontSize.md,
  },

  center: {
    flex: 1,
  },

  description: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: "600",
  },

  meta: {
    color: colors.subtext,
    fontSize: fontSize.sm,
    marginTop: 2,
  },

  right: {
    alignItems: "flex-end",
  },

  amount: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: "600",
  },

  share: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },

  getText: {
    color: colors.success,
  },

  oweText: {
    color: colors.danger,
  },
});
