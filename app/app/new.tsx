import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery } from "urql";
import { formatCents, isoDateInDays, parseDollarsToCents } from "../lib/format";
import { CLIENTS, CREATE_INVOICE } from "../lib/graphql";
import { colors, ui } from "../lib/theme";

type Row = { key: number; description: string; quantity: string; price: string };

let nextKey = 1;
const emptyRow = (): Row => ({ key: nextKey++, description: "", quantity: "1", price: "" });

const TERMS = [15, 30, 60];

export default function NewInvoice() {
  const [{ data: clientData }] = useQuery<{ clients: { id: string; name: string }[] }>({ query: CLIENTS });
  const [{ fetching: submitting }, createInvoice] = useMutation(CREATE_INVOICE);

  const [clientId, setClientId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState(isoDateInDays(30));
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [error, setError] = useState<string | null>(null);

  const parsed = rows.map((r) => ({
    description: r.description.trim(),
    quantity: /^\d+$/.test(r.quantity) ? Number(r.quantity) : null,
    unitPriceCents: parseDollarsToCents(r.price),
  }));
  const totalCents = parsed.reduce((sum, p) => sum + (p.quantity ?? 0) * (p.unitPriceCents ?? 0), 0);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function submit() {
    setError(null);
    if (!clientId) return setError("Pick a client.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return setError("Due date must look like 2026-10-31.");
    if (parsed.some((p) => !p.description || !p.quantity || p.unitPriceCents === null)) {
      return setError("Every line needs a description, a whole-number quantity and a price.");
    }

    const result = await createInvoice(
      { input: { clientId, dueDate, lineItems: parsed } },
      { additionalTypenames: ["Invoice"] },
    );
    if (result.error) return setError(result.error.graphQLErrors[0]?.message ?? result.error.message);

    router.replace({ pathname: "/invoice/[id]", params: { id: result.data.createInvoice.id } });
  }

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <View style={ui.card}>
        <Text style={ui.label}>Client</Text>
        <View style={styles.chips}>
          {(clientData?.clients ?? []).map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setClientId(c.id)}
              style={[styles.chip, clientId === c.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, clientId === c.id && styles.chipTextActive]}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={ui.card}>
        <Text style={ui.label}>Due date</Text>
        <TextInput style={ui.input} value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" />
        <View style={[styles.chips, { marginTop: 8 }]}>
          {TERMS.map((days) => (
            <Pressable key={days} onPress={() => setDueDate(isoDateInDays(days))} style={styles.chip}>
              <Text style={styles.chipText}>Net {days}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[ui.card, { gap: 12 }]}>
        <Text style={ui.label}>Line items</Text>
        {rows.map((row, i) => (
          <View key={row.key} style={styles.lineItem}>
            <TextInput
              style={ui.input}
              value={row.description}
              onChangeText={(description) => update(row.key, { description })}
              placeholder={i === 0 ? "e.g. Die cut stickers 3\" x 3\"" : "Description"}
            />
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <TextInput
                style={[ui.input, styles.half]}
                value={row.quantity}
                onChangeText={(quantity) => update(row.key, { quantity })}
                keyboardType="number-pad"
                placeholder="Qty"
              />
              <TextInput
                style={[ui.input, styles.half]}
                value={row.price}
                onChangeText={(price) => update(row.key, { price })}
                keyboardType="decimal-pad"
                placeholder="Unit price ($)"
              />
              {rows.length > 1 && (
                <Pressable onPress={() => setRows((rs) => rs.filter((r) => r.key !== row.key))} hitSlop={8}>
                  <Text style={{ color: colors.danger, fontWeight: "700" }}>Remove</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}
        <Pressable onPress={() => setRows((rs) => [...rs, emptyRow()])}>
          <Text style={{ color: colors.accent, fontWeight: "700" }}>+ Add line</Text>
        </Pressable>
      </View>

      <View style={[ui.card, styles.totalRow]}>
        <Text style={{ fontSize: 16, color: colors.muted }}>Total</Text>
        <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>{formatCents(totalCents)}</Text>
      </View>

      {error && <Text style={ui.error}>{error}</Text>}

      {/* Disabled while in flight so a double tap can't create (and number) two invoices. */}
      <Pressable
        style={[ui.button, submitting && { opacity: 0.5 }]}
        onPress={submit}
        disabled={submitting}
        accessibilityRole="button"
      >
        <Text style={ui.buttonText}>{submitting ? "Creating…" : "Create invoice"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { color: colors.text, fontWeight: "600" },
  chipTextActive: { color: colors.card },
  // minWidth 0 lets web inputs shrink below their intrinsic width inside a row.
  half: { flex: 1, minWidth: 0 },
  lineItem: { gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
