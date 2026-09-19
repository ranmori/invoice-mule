import { router, Stack } from "expo-router";
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useQuery } from "urql";
import { StatusPill } from "../components/StatusPill";
import { formatCents, formatDate } from "../lib/format";
import { INVOICES, invoiceContext, type InvoiceSummary } from "../lib/graphql";
import { colors, ui } from "../lib/theme";

export default function InvoiceList() {
  const [{ data, fetching, error }, refetch] = useQuery<{ invoices: InvoiceSummary[] }>({
    query: INVOICES,
    context: invoiceContext,
  });

  const newButton = (
    <Pressable style={styles.headerButton} onPress={() => router.push("/new")} accessibilityRole="button">
      <Text style={styles.headerButtonText}>+ New</Text>
    </Pressable>
  );

  if (!data && fetching) {
    return (
      <View style={ui.center}>
        <ActivityIndicator color={colors.accent} />
        <Text style={{ color: colors.muted }}>Loading invoices… (the free API host may take ~30s to wake up)</Text>
      </View>
    );
  }

  if (!data && error) {
    return (
      <View style={ui.center}>
        <Text style={ui.error}>Couldn't load invoices: {error.message}</Text>
        <Pressable onPress={() => refetch({ requestPolicy: "network-only" })}>
          <Text style={{ color: colors.accent, fontWeight: "700" }}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerRight: () => newButton }} />
      <FlatList
        style={ui.screen}
        contentContainerStyle={ui.content}
        data={data?.invoices ?? []}
        keyExtractor={(inv) => inv.id}
        refreshControl={
          <RefreshControl refreshing={fetching} onRefresh={() => refetch({ requestPolicy: "network-only" })} />
        }
        ListEmptyComponent={
          <View style={ui.center}>
            <Text style={{ color: colors.muted }}>No invoices yet.</Text>
            {newButton}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/invoice/[id]", params: { id: item.id } })}
            style={({ pressed }) => [ui.card, styles.row, pressed && { opacity: 0.7 }]}
            accessibilityRole="link"
          >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.number}>{item.displayNumber}</Text>
                <Text style={styles.client}>{item.client.name}</Text>
                <Text style={[styles.due, isOverdue(item) && { color: colors.danger, fontWeight: "600" }]}>
                  {isOverdue(item) ? "Overdue · " : "Due "}
                  {formatDate(item.dueDate)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <Text style={styles.total}>{formatCents(item.totalCents)}</Text>
                <StatusPill status={item.status} />
              </View>
          </Pressable>
        )}
      />
    </>
  );
}

const isOverdue = (inv: InvoiceSummary) =>
  inv.status === "OPEN" && new Date(inv.dueDate).getTime() < Date.now();

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  number: { fontSize: 13, fontWeight: "700", color: colors.muted, fontVariant: ["tabular-nums"] },
  client: { fontSize: 16, fontWeight: "600", color: colors.text },
  due: { fontSize: 13, color: colors.muted },
  total: { fontSize: 17, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  headerButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: Platform.OS === "web" ? 16 : 0,
  },
  headerButtonText: { color: colors.accentText, fontWeight: "700" },
});
