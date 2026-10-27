import React, { useState } from "react";
import { View, Text, TextInput, Pressable, FlatList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useCreateGroup } from "@/api/hooks/useGroups";
import { useFriends } from "@/api/hooks/useFriends";
import { useTheme } from "@/theme/ThemeProvider";
import { createCommonStyles } from "@/theme/commonStyles";
import Icon from "@/components/Icon";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CreateGroupScreen() {
  const navigation = useNavigation<any>();
  const createGroup = useCreateGroup();
  const { data: friendData, isLoading: friendsLoading, isError: friendsError } = useFriends();
  const friends = friendData?.friends ?? [];
  const { colors } = useTheme();
  const styles = createCommonStyles(colors);
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    setError(null);
    try {
      await createGroup.mutateAsync({ name: name.trim(), memberIds });
      navigation.goBack();
    } catch (cause) {
      const requestError = cause as { response?: { data?: { error?: string } } };
      setError(requestError.response?.data?.error ?? "Couldn't create the group. Please try again.");
    }
  }

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={[styles.screen, { paddingTop: 18, paddingBottom: 16 }]}>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Group name"
        placeholderTextColor={colors.muted}
        style={styles.input}
        maxLength={60}
      />
      <Text style={styles.subtitle}>Add friends</Text>
      {friendsLoading && <Text style={styles.muted}>Loading friends…</Text>}
      {friendsError && <Text style={styles.errorText}>Couldn't load your friends. Close and reopen this screen to retry.</Text>}
      <FlatList
        style={{ flex: 1 }}
        data={friends}
        keyExtractor={(friend) => friend.id}
        renderItem={({ item }) => {
          const selected = memberIds.includes(item.id);
          return (
            <Pressable
              onPress={() => setMemberIds((current) => selected ? current.filter((id) => id !== item.id) : [...current, item.id])}
              style={styles.row}
            >
              <Text style={{ color: colors.text }}>{item.name} <Text style={styles.muted}>@{item.username}</Text></Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Icon name={selected ? "check-circle" : "plus-circle-outline"} color={colors.accent} size={18} />
                <Text style={{ color: colors.accent, fontWeight: "600" }}>{selected ? "Added" : "Add"}</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={friendsLoading || friendsError ? null : <Text style={[styles.muted, { paddingVertical: 16 }]}>Add friends first to invite them to a group.</Text>}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
      <Pressable disabled={!name.trim() || createGroup.isPending} onPress={handleCreate} style={[styles.primaryButton, { opacity: !name.trim() || createGroup.isPending ? 0.4 : 1 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="account-group-outline" color="#fff" size={20} />
          <Text style={styles.primaryButtonText}>{createGroup.isPending ? "Creating..." : "Create Group"}</Text>
        </View>
      </Pressable>
    </View>
    </SafeAreaView>
  );
}
