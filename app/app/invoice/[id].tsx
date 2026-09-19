import { Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery } from "urql";
import { StatusPill } from "../../components/StatusPill";
import { formatCents, formatDate } from "../../lib/format";
import { INVOICE, invoiceContext, MARK_PAID, type InvoiceDetail } from "../../lib/graphql";
import { colors, ui } from "../../lib/theme";

export default function InvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [{ data, fetching, error }] = useQuery<{ invoice: InvoiceDetail | null }>({
    query: INVOICE,
    variables: { id },
    context: invoiceContext,
  });
  const [{ fetching: paying, error: payError }, markPaid] = useMutation(MARK_PAID);

  if (!data && fetching) {
    return (
      <View style={ui.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  const invoice = data?.invoice;
  if (!invoice) {
    return (
      <View style={ui.center}>
        <Text style={ui.error}>{error ? error.message : "Invoice not found."}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Stack.Screen options={{ title: invoice.displayNumber }} />

      <View style={[ui.card, { gap: 10 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.number}>{invoice.displayNumber}</Text>
          <StatusPill status={invoice.status} />
        </View>
        <View>
          <Text style={styles.client}>{invoice.client.name}</Text>
          <Text style={styles.muted}>{invoice.client.email}</Text>
        </View>
        <View style={styles.dates}>
          <Meta label="Issued" value={formatDate(invoice.issueDate)} />
          <Meta label="Due" value={formatDate(invoice.dueDate)} />
          {invoice.paidAt && <Meta label="Paid" value={formatDate(invoice.paidAt)} />}
        </View>
      </View>

      <View style={ui.card}>
        {invoice.lineItems.map((li) => (
          <View key={li.id} style={styles.lineItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lineDesc}>{li.description}</Text>
              <Text style={styles.muted}>
                {li.quantity} × {formatCents(li.unitPriceCents)}
              </Text>
            </View>
            <Text style={styles.amount}>{formatCents(li.totalCents)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.total}>{formatCents(invoice.totalCents)}</Text>
        </View>
      </View>

      {payError && <Text style={ui.error}>{payError.graphQLErrors[0]?.message ?? payError.message}</Text>}

      {invoice.status === "OPEN" && (
        <Pressable
          style={[ui.button, { backgroundColor: colors.paid }, paying && { opacity: 0.5 }]}
          disabled={paying}
          onPress={() => markPaid({ id: invoice.id }, invoiceContext)}
          accessibilityRole="button"
        >
          <Text style={ui.buttonText}>{paying ? "Marking paid…" : "Mark paid"}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  number: { fontSize: 22, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
  client: { fontSize: 17, fontWeight: "600", color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  dates: { flexDirection: "row", gap: 24 },
  metaLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  metaValue: { fontSize: 15, color: colors.text },
  lineItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  lineDesc: { fontSize: 15, color: colors.text, fontWeight: "500" },
  amount: { fontSize: 15, color: colors.text, fontVariant: ["tabular-nums"] },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 12 },
  totalLabel: { fontSize: 16, fontWeight: "700", color: colors.text },
  total: { fontSize: 18, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
});
