// App.js - Main Entry Point
// File: App.js

import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";

// Import screens
import SplashScreen from "./src/screens/auth/SplashScreen";
import LoginScreen from "./src/screens/auth/LoginScreen";
import RegisterScreen from "./src/screens/auth/RegisterScreen";
import VerificationScreen from "./src/screens/auth/VerificationScreen";
import DashboardScreen from "./src/screens/DashboardScreen";

// Import context
import { AuthProvider } from "./src/context/AuthContext";

const Stack = createStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    prepareApp();
  }, []);

  const prepareApp = async () => {
    try {
      // Show splash for minimum 3.5 seconds
      const splashPromise = new Promise((resolve) => setTimeout(resolve, 3500));

      // Check auth status
      const authPromise = checkAuthStatus();

      // Wait for both splash time and auth check
      const [, userToken] = await Promise.all([splashPromise, authPromise]);

      // Set initial route based on auth status
      if (userToken) {
        setInitialRoute("Dashboard");
      } else {
        setInitialRoute("Login");
      }
    } catch (error) {
      console.log("Error preparing app:", error);
      setInitialRoute("Login"); // Default to login on error
    } finally {
      setIsReady(true);
    }
  };

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      return token;
    } catch (error) {
      console.log("Error checking auth:", error);
      return null;
    }
  };

  // Show splash screen while preparing
  if (!isReady) {
    return <SplashScreen />;
  }

  // Show main app with navigation
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerShown: false,
            gestureEnabled: true,
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Verification" component={VerificationScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}
