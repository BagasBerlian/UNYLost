// File: frontend/App.js - UPDATED WITH ALL SCREENS
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar } from "expo-status-bar";

// Import existing screens
import SplashScreen from "./src/screens/auth/SplashScreen";
import LoginScreen from "./src/screens/auth/LoginScreen";
import RegisterScreen from "./src/screens/auth/RegisterScreen";
import VerificationScreen from "./src/screens/auth/VerificationScreen";
import DashboardScreen from "./src/screens/DashboardScreen";

// Import new screens
import ReportFoundScreen from "./src/screens/ReportFoundScreen";
import ReportLostScreen from "./src/screens/ReportLostScreen";
import ReportSuccessScreen from "./src/screens/ReportSuccessScreen";
import MyItemsScreen from "./src/screens/MyItemsScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

// Import context
import { AuthProvider, useAuth } from "./src/context/AuthContext";

const Stack = createStackNavigator();

// Auth Stack
function AuthStack() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Verification" component={VerificationScreen} />
    </Stack.Navigator>
  );
}

// Main App Stack
function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="ReportFound" component={ReportFoundScreen} />
      <Stack.Screen name="ReportLost" component={ReportLostScreen} />
      <Stack.Screen name="ReportSuccess" component={ReportSuccessScreen} />
      <Stack.Screen name="MyItems" component={MyItemsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}

// App Navigator Component
function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show splash only during initial loading
  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <>
      <StatusBar style="auto" />
      {isAuthenticated ? <AppStack /> : <AuthStack />}
    </>
  );
}

// Root App Component
export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
