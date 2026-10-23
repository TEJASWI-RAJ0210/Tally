import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuthStore } from "@/store/authStore";
import AuthStack from "./AuthStack";
import TabNavigator from "./TabNavigator";
import AddExpenseScreen from "@/screens/expense/AddExpenseScreen";
import SettleUpScreen from "@/screens/settle/SettleUpScreen";
import FriendDetailScreen from "@/screens/friends/FriendDetailScreen";
import GroupDetailScreen from "@/screens/groups/GroupDetailScreen";
import CreateGroupScreen from "@/screens/groups/CreateGroupScreen";
import { useTheme } from "@/theme/ThemeProvider";

const RootStack = createNativeStackNavigator();

export default function RootNavigator() {
  const user = useAuthStore((s) => s.user);
  const { colors } = useTheme();

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.accent,
        headerTitleStyle: { color: colors.text, fontWeight: "700" },
        contentStyle: { backgroundColor: colors.background },
      }}>
        {!user ? (
          <RootStack.Screen name="Auth" component={AuthStack} />
        ) : (
          <>
            <RootStack.Screen name="Tabs" component={TabNavigator} />
            <RootStack.Group screenOptions={{ presentation: "modal", headerShown: true }}>
              <RootStack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: "Add Expense" }} />
              <RootStack.Screen name="SettleUp" component={SettleUpScreen} options={{ title: "Settle Up" }} />
              <RootStack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ title: "New Group" }} />
            </RootStack.Group>
            <RootStack.Group screenOptions={{ headerShown: true }}>
              <RootStack.Screen name="FriendDetail" component={FriendDetailScreen} options={{ title: "Friend" }} />
              <RootStack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ title: "Group" }} />
            </RootStack.Group>
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
