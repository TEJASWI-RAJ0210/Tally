import React, { useState } from "react";
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useSignup } from "@/api/hooks/useAuth";
import { useTheme } from "@/theme/ThemeProvider";
import { createCommonStyles } from "@/theme/commonStyles";
import Icon from "@/components/Icon";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SignupScreen() {
  const navigation = useNavigation<any>();
  const signup = useSignup();
  const { colors } = useTheme();
  const styles = createCommonStyles(colors);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const usernameValid = /^[a-z0-9_]{3,20}$/.test(username);
  const { data: availability, isFetching: isCheckingUsername, isError: usernameCheckFailed } = useQuery({
    queryKey: ["check-username", username],
    queryFn: async () => (await api.get(`/users/check-username?u=${encodeURIComponent(username)}`)).data,
    enabled: usernameValid,
    staleTime: 5_000,
    retry: false,
  });

  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());
  const canSubmit =
    name.trim().length > 0 &&
    name.trim().length <= 60 &&
    usernameValid &&
    availability?.available !== false &&
    emailValid &&
    password.length >= 8;

  async function handleSignup() {
    setError(null);
    try {
      await signup.mutateAsync({ name: name.trim(), username, email: email.trim(), password });
      // RootNavigator swaps to Tabs automatically once the store's `user` is set
    } catch (e: any) {
      setError(
        e?.response?.data?.error ??
          (!e?.response
            ? "Can't reach the backend. Make sure it's running and your phone and computer are on the same Wi-Fi."
            : "Something went wrong. Try again.")
      );
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: 24, paddingBottom: 28 }}>
        <Text style={styles.title}>Create your account</Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor={colors.muted}
          style={styles.input}
          maxLength={60}
        />

        <TextInput
          value={username}
          onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          placeholder="Username — this is how friends find you"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          style={styles.input}
          maxLength={20}
        />
        {username.length > 0 && !usernameValid && (
          <Text style={{ color: colors.owe, marginBottom: 8, marginTop: -8 }}>Use 3–20 letters, numbers, or underscores.</Text>
        )}
        {usernameValid && isCheckingUsername && (
          <Text style={[styles.muted, { marginBottom: 8, marginTop: -8 }]}>Checking username…</Text>
        )}
        {usernameValid && !isCheckingUsername && availability && (
          <Text style={{ color: availability.available ? colors.owed : colors.owe, marginBottom: 8, marginTop: -8 }}>
            {availability.available ? "Username available" : availability.reason ?? "Username taken"}
          </Text>
        )}
        {usernameValid && usernameCheckFailed && !isCheckingUsername && (
          <Text style={{ color: colors.owe, marginBottom: 8, marginTop: -8 }}>
            Couldn't reach the server to check this name. You can still try signing up; the server will check it.
          </Text>
        )}

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          maxLength={254}
        />
        {email.length > 0 && !emailValid && <Text style={{ color: colors.owe, marginBottom: 8 }}>Enter a valid email address.</Text>}

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password (min. 8 characters)"
          placeholderTextColor={colors.muted}
          secureTextEntry
          style={styles.input}
          maxLength={72}
        />
        {password.length > 0 && password.length < 8 && <Text style={{ color: colors.owe, marginBottom: 8 }}>Password must be at least 8 characters.</Text>}

        <Pressable
          disabled={!canSubmit || signup.isPending}
          onPress={handleSignup}
          style={[styles.primaryButton, { opacity: !canSubmit || signup.isPending ? 0.4 : 1 }]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="account-plus-outline" color="#fff" size={20} />
            <Text style={styles.primaryButtonText}>{signup.isPending ? "Creating account..." : "Sign Up"}</Text>
          </View>
        </Pressable>

        <Pressable onPress={() => navigation.navigate("Login")}>
          <Text style={styles.linkText}>Already have an account? Log in</Text>
        </Pressable>
      </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
