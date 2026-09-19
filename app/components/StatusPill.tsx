import { StyleSheet, Text, View } from "react-native";
import type { InvoiceStatus } from "../lib/graphql";
import { colors } from "../lib/theme";

export function StatusPill({ status }: { status: InvoiceStatus }) {
  const paid = status === "PAID";
  return (
    <View style={[styles.pill, { backgroundColor: paid ? colors.paidBg : colors.openBg }]}>
      <Text style={[styles.text, { color: paid ? colors.paid : colors.open }]}>{paid ? "Paid" : "Open"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" },
  text: { fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
});
