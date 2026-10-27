import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, RefreshControl } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAcceptFriendRequest, useFriends, useSearchUsers, useSendFriendRequest } from "@/api/hooks/useFriends";
import { formatCurrency } from "@/utils/currency";
import { useTheme } from "@/theme/ThemeProvider";
import { createCommonStyles } from "@/theme/commonStyles";
import Icon from "@/components/Icon";
import { SafeAreaView } from "react-native-safe-area-context";

export default function FriendsListScreen() {
  const navigation = useNavigation<any>();
  const { data: friendData, refetch: refetchFriends, isRefetching, isError: friendsError } = useFriends();
  const [query, setQuery] = useState("");
  const { data: searchResults, isFetching: searchingUsers, isError: searchError } = useSearchUsers(query);
  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const [requestedUsernames, setRequestedUsernames] = useState<Set<string>>(() => new Set());
  const { colors } = useTheme();
  const styles = createCommonStyles(colors);
  const requestError = sendRequest.error as { response?: { data?: { error?: string } } } | null;
  const acceptError = acceptRequest.error as { response?: { data?: { error?: string } } } | null;
  const friends = Array.isArray(friendData?.friends) ? friendData.friends : [];
  const existingFriendIds = new Set(friends.map((friend) => friend.id));
  const incomingRequests = Array.isArray(friendData?.incomingRequests) ? friendData.incomingRequests : [];
  const outgoingRequests = Array.isArray(friendData?.outgoingRequests) ? friendData.outgoingRequests : [];
  const outgoingUsernames = new Set(outgoingRequests.map((request) => request.to?.username).filter(Boolean));
  const availableSearchResults = (Array.isArray(searchResults) ? searchResults : []).filter((user: any) => !existingFriendIds.has(user.id));
  const hasRequested = (username: string) => requestedUsernames.has(username) || outgoingUsernames.has(username);

  useFocusEffect(useCallback(() => {
    void refetchFriends();
  }, [refetchFriends]));

  async function handleSendRequest(username: string) {
    try {
      await sendRequest.mutateAsync(username);
      setRequestedUsernames((current) => new Set(current).add(username));
    } catch {
      // The API error is shown below the search field.
    }
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: 14, paddingBottom: 28 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetchFriends} tintColor={colors.accent} />}
    >
      <Text style={styles.title}>Friends</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Add by username"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        style={styles.input}
      />
      {friendsError && <Text style={styles.errorText}>Couldn't load friends or requests. Pull down to retry.</Text>}
      {sendRequest.isSuccess && <Text style={{ color: colors.owed, marginBottom: 12 }}>Friend request sent.</Text>}
      {sendRequest.isError && <Text style={[styles.errorText, { marginBottom: 12 }]}>{requestError?.response?.data?.error ?? "Couldn't send friend request. Try again."}</Text>}
      {!!incomingRequests.length && (
        <>
          <Text style={[styles.subtitle, { marginTop: 8 }]}>Friend requests</Text>
          {incomingRequests.map((request) => (
            <View key={request.id} style={styles.row}>
              <View>
                <Text style={{ color: colors.text, fontWeight: "600" }}>{request.from?.name}</Text>
                <Text style={styles.muted}>@{request.from?.username}</Text>
              </View>
              <Pressable
                disabled={acceptRequest.isPending}
                onPress={() => acceptRequest.mutate(request.id)}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, opacity: acceptRequest.isPending ? 0.6 : 1 }}
              >
                <Icon name="check-circle-outline" color={colors.owed} size={18} />
                <Text style={{ color: colors.owed, fontWeight: "600" }}>Accept</Text>
              </Pressable>
            </View>
          ))}
        </>
      )}
      {acceptRequest.isError && <Text style={styles.errorText}>{acceptError?.response?.data?.error ?? "Couldn't accept request. Try again."}</Text>}
      {!!outgoingRequests.length && (
        <View style={{ marginBottom: 8 }}>
          <Text style={styles.subtitle}>Sent requests</Text>
          {outgoingRequests.map((request) => (
            <View key={request.id} style={styles.row}>
              <Text style={{ color: colors.text }}>@{request.to?.username}</Text>
              <Text style={styles.muted}>Pending</Text>
            </View>
          ))}
        </View>
      )}
      {query.length >= 2 && (
        <View>
          {searchingUsers && <Text style={[styles.muted, { paddingVertical: 8 }]}>Searching…</Text>}
          {searchError && <Text style={styles.errorText}>Couldn't search for friends. Check your connection.</Text>}
          {availableSearchResults.map((item: any) => (
            <Pressable
              key={item.id}
              disabled={sendRequest.isPending || hasRequested(item.username)}
              onPress={() => handleSendRequest(item.username)}
              style={[styles.row, { opacity: hasRequested(item.username) ? 0.55 : 1 }]}
            >
              <Text style={{ color: colors.text }}>@{item.username}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Icon name={hasRequested(item.username) ? "check-circle-outline" : "account-plus-outline"} color={hasRequested(item.username) ? colors.owed : colors.accent} size={18} />
                <Text style={{ color: hasRequested(item.username) ? colors.owed : colors.accent, fontWeight: "600" }}>
                  {hasRequested(item.username) ? "Sent" : sendRequest.isPending ? "Sending..." : "Add"}
                </Text>
              </View>
            </Pressable>
          ))}
          {!searchingUsers && !searchError && !availableSearchResults.length && <Text style={[styles.muted, { paddingVertical: 12 }]}>No new users found.</Text>}
        </View>
      )}
      <Text style={[styles.subtitle, { marginTop: 24 }]}>Your friends</Text>
      {friends.map((item) => (
        <Pressable key={item.id} onPress={() => navigation.navigate("FriendDetail", { friendId: item.id })} style={styles.row}>
          <Text style={{ color: colors.text }}>{item.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: parseFloat(item.balance) >= 0 ? colors.owed : colors.owe }}>{formatCurrency(item.balance)}</Text>
            <Icon name="chevron-right" color={colors.muted} size={20} />
          </View>
        </Pressable>
      ))}
      {!friends.length && <Text style={[styles.muted, { paddingVertical: 16 }]}>Your accepted friends will appear here.</Text>}
    </ScrollView>
    </SafeAreaView>
  );
}
