import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Provider } from "urql";
import { client } from "../lib/graphql";
import { colors } from "../lib/theme";

export default function RootLayout() {
  return (
    <Provider value={client}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Invoices" }} />
        <Stack.Screen name="new" options={{ title: "New invoice" }} />
        <Stack.Screen name="invoice/[id]" options={{ title: "Invoice" }} />
      </Stack>
    </Provider>
  );
}
