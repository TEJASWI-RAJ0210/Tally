import React from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback } from "react";
import { useGroups } from "@/api/hooks/useGroups";
import { useTheme } from "@/theme/ThemeProvider";
import { createCommonStyles } from "@/theme/commonStyles";
import Icon from "@/components/Icon";
import { SafeAreaView } from "react-native-safe-area-context";

export default function GroupsListScreen() {
  const navigation = useNavigation<any>();
  const { data: groups, isLoading, isError, refetch } = useGroups();
  const { colors } = useTheme();
  const styles = createCommonStyles(colors);

  useFocusEffect(useCallback(() => {
    void refetch();
  }, [refetch]));

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={[styles.screen, { paddingTop: 14, paddingBottom: 16 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Text style={styles.title}>Groups</Text>
        <Pressable onPress={() => navigation.navigate("CreateGroup")} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon name="plus-circle-outline" color={colors.accent} size={20} />
          <Text style={{ color: colors.accent, fontWeight: "600" }}>New</Text>
        </Pressable>
      </View>
      <FlatList
        data={groups ?? []}
        keyExtractor={(g: any) => g.id}
        renderItem={({ item }: any) => (
          <Pressable onPress={() => navigation.navigate("GroupDetail", { groupId: item.id })} style={styles.row}>
            <View>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>{item.name}</Text>
              <Text style={styles.muted}>{item.members?.length ?? 0} members</Text>
            </View>
            <Icon name="chevron-right" color={colors.muted} size={20} />
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={[isError ? styles.errorText : styles.muted, { textAlign: "center", paddingVertical: 32 }]}>
            {isLoading ? "Loading groups…" : isError ? "Couldn't load groups. Check your connection and try again." : "No groups yet — create one for a trip, flat, or event."}
          </Text>
        }
      />
    </View>
    </SafeAreaView>
  );
}
