import { StyleSheet } from "react-native";

export const colors = {
  bg: "#F6F5F2",
  card: "#FFFFFF",
  text: "#1C1B19",
  muted: "#6B6862",
  border: "#E4E1DB",
  accent: "#E8590C",
  accentText: "#FFFFFF",
  paid: "#2B8A3E",
  paidBg: "#EBFBEE",
  open: "#9C6500",
  openBg: "#FFF4DB",
  danger: "#C92A2A",
};

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, width: "100%", maxWidth: 640, alignSelf: "center" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 6 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: colors.accentText, fontSize: 16, fontWeight: "700" },
  error: { color: colors.danger, fontSize: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
});
