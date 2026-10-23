import React, { useState } from "react";
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useLogin } from "@/api/hooks/useAuth";
import { useTheme } from "@/theme/ThemeProvider";
import { createCommonStyles } from "@/theme/commonStyles";
import Icon from "@/components/Icon";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const login = useLogin();
  const { colors } = useTheme();
  const styles = createCommonStyles(colors);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canLogin = identifier.trim().length > 0 && password.length > 0;

  async function handleLogin() {
    setError(null);
    try {
      await login.mutateAsync({ identifier: identifier.trim(), password });
      // RootNavigator swaps to the Tabs stack automatically once
      // useAuthStore's `user` is set by the mutation's onSuccess
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Something went wrong. Try again.");
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.screen, { justifyContent: "center", paddingVertical: 24 }]}>
        <View style={{ alignItems: "center", marginBottom: 12 }}>
          <View style={{ width: 68, height: 68, borderRadius: 22, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <Icon name="scale-balance" color="#fff" size={38} />
          </View>
          <Text style={[styles.title, { fontSize: 32, textAlign: "center", marginBottom: 4 }]}>Tally</Text>
        </View>
        <Text style={[styles.muted, { textAlign: "center", marginBottom: 40 }]}>
          Split expenses with friends, without the spreadsheet.
        </Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TextInput
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="Email or username"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          maxLength={254}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          style={styles.input}
          maxLength={72}
        />

        <Pressable
          disabled={login.isPending || !canLogin}
          onPress={handleLogin}
          style={[styles.primaryButton, { opacity: login.isPending || !canLogin ? 0.4 : 1 }]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="login" color="#fff" size={20} />
            <Text style={styles.primaryButtonText}>{login.isPending ? "Logging in..." : "Log In"}</Text>
          </View>
        </Pressable>

        <Pressable onPress={() => navigation.navigate("Signup")}>
          <Text style={styles.linkText}>Don't have an account? Sign up</Text>
        </Pressable>
      </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
