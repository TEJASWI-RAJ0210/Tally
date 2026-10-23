import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTheme } from "@/theme/ThemeProvider";
import HomeScreen from "@/screens/home/HomeScreen";
import FriendsListScreen from "@/screens/friends/FriendsListScreen";
import GroupsListScreen from "@/screens/groups/GroupsListScreen";
import ProfileScreen from "@/screens/profile/ProfileScreen";
import Icon from "@/components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarItemStyle: { paddingTop: 3 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 58 + insets.bottom, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8) },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ color, size }) => <Icon name="view-dashboard-outline" color={color} size={size} /> }} />
      <Tab.Screen name="Friends" component={FriendsListScreen} options={{ tabBarIcon: ({ color, size }) => <Icon name="account-multiple-outline" color={color} size={size} /> }} />
      <Tab.Screen name="Groups" component={GroupsListScreen} options={{ tabBarIcon: ({ color, size }) => <Icon name="account-group-outline" color={color} size={size} /> }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ color, size }) => <Icon name="account-circle-outline" color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}
