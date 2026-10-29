import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/theme/ThemeProvider";
import HomeScreen from "@/screens/home/HomeScreen";
import FriendsListScreen from "@/screens/friends/FriendsListScreen";
import GroupsListScreen from "@/screens/groups/GroupsListScreen";
import ProfileScreen from "@/screens/profile/ProfileScreen";
import Icon from "@/components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Tab = createBottomTabNavigator();

function AddActionScreen() {
  return null;
}

export default function TabNavigator() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarItemStyle: { paddingTop: 3 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 38,
          height: 70 + insets.bottom,
          marginHorizontal: 12,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          overflow: "visible",
          elevation: 5,
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
        },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ color, size }) => <Icon name="view-dashboard-outline" color={color} size={size} /> }} />
      <Tab.Screen name="Friends" component={FriendsListScreen} options={{ tabBarIcon: ({ color, size }) => <Icon name="account-multiple-outline" color={color} size={size} /> }} />
      <Tab.Screen
        name="AddAction"
        component={AddActionScreen}
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            navigation.getParent()?.navigate("AddExpense");
          },
        }}
        options={{
          tabBarLabel: "",
          tabBarAccessibilityLabel: "Add expense",
          tabBarButton: (props) => (
            <Pressable
              {...props}
              accessibilityRole="button"
              accessibilityLabel="Add expense"
              style={[props.style, localStyles.addButtonSlot]}
            >
              <View style={[localStyles.addButton, { backgroundColor: colors.accent, shadowColor: colors.text }]}>
                <Icon name="plus" color="#FFFFFF" size={29} />
              </View>
            </Pressable>
          ),
        }}
      />
      <Tab.Screen name="Groups" component={GroupsListScreen} options={{ tabBarIcon: ({ color, size }) => <Icon name="account-group-outline" color={color} size={size} /> }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ color, size }) => <Icon name="account-circle-outline" color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}

const localStyles = StyleSheet.create({
  addButtonSlot: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    zIndex: 2,
  },
  addButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateY: -15 }],
    elevation: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
  },
});
