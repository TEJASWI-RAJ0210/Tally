import { StyleSheet } from "react-native";
import { lightColors } from "./tokens";

type Colors = typeof lightColors;

// Call inside a component with colors from useTheme(). Layout is static;
// colors are applied per-render based on light/dark mode.
export function createCommonStyles(colors: Colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 22 },
    title: { fontSize: 28, fontWeight: "700", color: colors.text, marginBottom: 18, letterSpacing: -0.6 },
    subtitle: { fontSize: 17, fontWeight: "600", color: colors.text, marginBottom: 10, letterSpacing: -0.2 },
    muted: { color: colors.muted, fontSize: 14 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
      marginBottom: 12,
      backgroundColor: colors.surface,
    },
    primaryButton: {
      backgroundColor: colors.accent,
      borderRadius: 15,
      paddingVertical: 15,
      alignItems: "center",
      marginTop: 16,
    },
    primaryButtonText: { color: "#FFFFFF", fontWeight: "600", fontSize: 16 },
    linkText: { color: colors.accent, fontWeight: "700", textAlign: "center", marginTop: 18 },
    amountText: { fontWeight: "700", fontSize: 40, color: colors.text, textAlign: "center", marginBottom: 24 },
    errorText: { color: colors.owe, marginBottom: 8 },
  });
}
