import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Alert } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useCreateExpense } from "@/api/hooks/useExpenses";
import { useFriends } from "@/api/hooks/useFriends";
import { useAuthStore } from "@/store/authStore";
import { calculateEqualSplit, calculateExactSplit } from "@/utils/splitCalculations";
import { useGroup } from "@/api/hooks/useGroups";
import { useTheme } from "@/theme/ThemeProvider";
import { createCommonStyles } from "@/theme/commonStyles";
import { formatCurrency } from "@/utils/currency";
import Icon from "@/components/Icon";
import { SafeAreaView } from "react-native-safe-area-context";

type SplitType = "EQUAL" | "EXACT";
type Participant = { id: string; name: string; username?: string };

export default function AddExpenseScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const groupId: string | undefined = route.params?.groupId;
  const friendId: string | undefined = route.params?.friendId;

  const user = useAuthStore((state) => state.user);
  const createExpense = useCreateExpense();
  const { data: group, isLoading: groupLoading, isError: groupError } = useGroup(groupId ?? "");
  const { data: friendData, isLoading: friendsLoading, isError: friendsError } = useFriends();
  const friends = Array.isArray(friendData?.friends) ? friendData.friends : [];
  const { colors } = useTheme();
  const styles = createCommonStyles(colors);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>(() =>
    user ? [...new Set([user.id, ...(friendId ? [friendId] : [])])] : friendId ? [friendId] : []
  );
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [splitType, setSplitType] = useState<SplitType>("EQUAL");
  const [initializedGroupId, setInitializedGroupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groupParticipants = useMemo<Participant[]>(() => {
    if (!Array.isArray(group?.members)) return [];
    return group.members.flatMap((member: any) => member.user?.id
      ? [{ id: member.user.id, name: member.user.name ?? "Group member", username: member.user.username }]
      : []);
  }, [group]);

  useEffect(() => {
    if (groupId && group && initializedGroupId !== groupId) {
      setSelectedParticipantIds(groupParticipants.map((person) => person.id));
      setInitializedGroupId(groupId);
    }
  }, [groupId, group, groupParticipants, initializedGroupId]);

  const personalParticipants = useMemo<Participant[]>(() => {
    const people: Participant[] = user ? [{ id: user.id, name: user.name ?? "You", username: "you" }] : [];
    for (const friend of friends) {
      if (friend.id !== user?.id) people.push({ id: friend.id, name: friend.name, username: friend.username });
    }
    return people;
  }, [friends, user]);

  const participants = groupId ? groupParticipants : personalParticipants;
  const selectedSet = useMemo(() => new Set(selectedParticipantIds), [selectedParticipantIds]);
  const selectedParticipants = participants.filter((person) => selectedSet.has(person.id));
  const participantIds = selectedParticipants.map((person) => person.id);
  const numericAmount = Number(amount);
  const amountCents = Math.round(numericAmount * 100);
  const amountHasCentPrecision = Number.isFinite(numericAmount) && Math.abs(numericAmount * 100 - amountCents) < 1e-7;

  const shares = useMemo(() => {
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || participantIds.length === 0) return [];
    if (splitType === "EQUAL") return calculateEqualSplit(numericAmount, participantIds);
    return calculateExactSplit(Object.fromEntries(participantIds.map((id) => [id, Number(exactAmounts[id]) || 0])));
  }, [numericAmount, participantIds.join("|"), splitType, exactAmounts]);

  const exactAmountsValid = splitType !== "EXACT" || (
    participantIds.length > 0 && participantIds.every((id) => {
      const value = exactAmounts[id];
      const numericValue = Number(value);
      return value !== undefined && value.trim() !== "" && Number.isFinite(numericValue) && numericValue > 0 &&
        Math.abs(numericValue * 100 - Math.round(numericValue * 100)) < 1e-7;
    }) && shares.reduce((total, share) => total + Math.round(share.amountOwed * 100), 0) === amountCents
  );
  const equalAmountsValid = splitType !== "EQUAL" || numericAmount <= 0 || amountCents >= participantIds.length;
  const hasValidParticipants = participantIds.length > 0 && selectedParticipantIds.length === participantIds.length &&
    participantIds.every((id) => participants.some((person) => person.id === id));
  const hasPersonalCounterparty = !!groupId || selectedParticipantIds.some((id) => id !== user?.id);
  const canSave = !!user && !!description.trim() && description.trim().length <= 120 && Number.isFinite(numericAmount) && numericAmount > 0 && amountHasCentPrecision &&
    hasValidParticipants && hasPersonalCounterparty && exactAmountsValid && equalAmountsValid && (!groupId || (!!group && initializedGroupId === groupId)) && !createExpense.isPending;

  function toggleParticipant(personId: string) {
    setSelectedParticipantIds((current) => current.includes(personId)
      ? current.filter((id) => id !== personId)
      : [...current, personId]);
  }

  async function handleSave() {
    setError(null);
    if (!user) return setError("Please sign in again before adding an expense.");
    if (groupId && (!group || initializedGroupId !== groupId)) return;
    if (!description.trim()) return setError("Enter what the expense was for.");
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError("Enter an amount greater than zero.");
    if (!amountHasCentPrecision) return setError("Enter an amount with no more than 2 decimal places.");
    if (!hasValidParticipants) return setError("Choose at least one person to include in the split.");
    if (!hasPersonalCounterparty) return setError("Choose at least one friend for a personal expense.");
    if (!exactAmountsValid) return setError("Exact amounts must be entered for everyone and add up to the total.");
    if (!equalAmountsValid) return setError("The total must be at least one cent for each selected person.");

    try {
      const result = await createExpense.mutateAsync({
        description: description.trim(),
        amount: amountCents / 100,
        groupId,
        paidById: user.id,
        splitType,
        shares,
      });
      if (result?.queued) Alert.alert("Saved offline", "This expense will sync when your connection is back.");
      navigation.goBack();
    } catch (cause) {
      const requestError = cause as { response?: { data?: { error?: string } } };
      setError(requestError.response?.data?.error ?? "Couldn't save the expense. Check your connection and try again.");
    }
  }

  const canLoadPersonalFriends = !groupId && !friendsLoading && !friendsError;
  const groupLoadMessage = groupId && groupLoading ? "Loading group members…" : groupId && groupError ? "Couldn't load this group. Close and reopen the screen to retry." : null;

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={[styles.screen, { paddingTop: 18 }]} contentContainerStyle={{ paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>Expense details</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.muted}
          style={styles.amountText}
          accessibilityLabel="Expense amount"
        />
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="What was this for?"
          placeholderTextColor={colors.muted}
          style={styles.input}
          maxLength={120}
        />
        {amount.length > 0 && (!Number.isFinite(numericAmount) || numericAmount <= 0) && <Text style={styles.errorText}>Enter an amount greater than zero.</Text>}
        {amount.length > 0 && Number.isFinite(numericAmount) && numericAmount > 0 && !amountHasCentPrecision && <Text style={styles.errorText}>Use no more than 2 decimal places.</Text>}
        {description.length > 0 && !description.trim() && <Text style={styles.errorText}>Enter what the expense was for.</Text>}

        <Text style={[styles.subtitle, { marginTop: 12 }]}>Split with</Text>
        {groupLoadMessage && <Text style={[groupError ? styles.errorText : styles.muted, { marginBottom: 10 }]}>{groupLoadMessage}</Text>}
        {!groupId && friendsLoading && <Text style={[styles.muted, { marginBottom: 10 }]}>Loading friends…</Text>}
        {!groupId && friendsError && <Text style={[styles.errorText, { marginBottom: 10 }]}>Couldn't load your accepted friends. Try again before saving.</Text>}
        {participants.map((person) => {
          const selected = selectedSet.has(person.id);
          const isYou = person.id === user?.id;
          return (
            <View key={person.id} style={styles.row}>
              <Pressable onPress={() => toggleParticipant(person.id)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}>
                <Icon name={selected ? "check-circle" : "circle-outline"} color={selected ? colors.accent : colors.muted} size={21} />
                <View>
                  <Text style={{ color: colors.text, fontWeight: "600" }}>{isYou ? "You" : person.name}</Text>
                  {!isYou && person.username && <Text style={styles.muted}>@{person.username}</Text>}
                </View>
              </Pressable>
              {splitType === "EXACT" && selected && (
                <TextInput
                  value={exactAmounts[person.id] ?? ""}
                  onChangeText={(value) => setExactAmounts((current) => ({ ...current, [person.id]: value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1") }))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                  style={{ color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10, minWidth: 92, paddingHorizontal: 10, paddingVertical: 8, textAlign: "right" }}
                  accessibilityLabel={`${person.name}'s share`}
                  maxLength={12}
                />
              )}
            </View>
          );
        })}
        {!groupId && canLoadPersonalFriends && !friends.length && <Text style={[styles.muted, { marginBottom: 12 }]}>Add and accept a friend before sharing a personal expense.</Text>}
        {groupId && !groupLoading && !groupError && !participants.length && <Text style={[styles.muted, { marginBottom: 12 }]}>This group has no available members.</Text>}

        <Text style={[styles.subtitle, { marginTop: 22 }]}>Split method</Text>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
          {(["EQUAL", "EXACT"] as const).map((type) => {
            const selected = splitType === type;
            return (
              <Pressable
                key={type}
                onPress={() => setSplitType(type)}
                style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 13, borderWidth: 1, borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent : colors.surface }}
              >
                <Text style={{ color: selected ? "#fff" : colors.text, fontWeight: "600" }}>{type === "EQUAL" ? "Equal" : "Exact amounts"}</Text>
              </Pressable>
            );
          })}
        </View>

        {splitType === "EQUAL" && <Text style={equalAmountsValid ? styles.muted : styles.errorText}>
          {equalAmountsValid
            ? `Split ${formatCurrency(amountCents / 100 || 0)} equally between ${selectedParticipants.length} ${selectedParticipants.length === 1 ? "person" : "people"}.`
            : "The total must be at least one cent for each selected person."}
        </Text>}
        {splitType === "EXACT" && (
          <View style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8 }}>
            <Text style={styles.muted}>Enter each selected person's share.</Text>
            <Text style={{ color: exactAmountsValid ? colors.muted : colors.owe, marginTop: 6, fontWeight: "600" }}>
              Split total · {formatCurrency(shares.reduce((total, share) => total + share.amountOwed, 0))} / {formatCurrency(amountCents / 100 || 0)}
            </Text>
            {!exactAmountsValid && (amount.length > 0 || Object.values(exactAmounts).some((value) => value.length > 0)) && <Text style={{ color: colors.owe, marginTop: 6, fontSize: 13 }}>Enter exact shares that add up to the expense total.</Text>}
          </View>
        )}
        {error && <Text style={[styles.errorText, { marginTop: 12 }]}>{error}</Text>}
        <Pressable
          disabled={!canSave}
          onPress={handleSave}
          style={[styles.primaryButton, { opacity: !canSave ? 0.45 : 1 }]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="content-save-outline" color="#fff" size={20} />
            <Text style={styles.primaryButtonText}>{createExpense.isPending ? "Saving…" : groupId && groupLoading ? "Loading group…" : "Save expense"}</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
