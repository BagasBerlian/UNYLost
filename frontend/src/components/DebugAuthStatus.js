// File: frontend/src/components/DebugAuthStatus.js
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function DebugAuthStatus() {
  const { isAuthenticated, isLoading, user, token } = useAuth();

  if (!__DEV__) return null; // Only show in development

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔍 Debug Auth Status</Text>
      <Text style={styles.text}>
        Authenticated: {isAuthenticated ? "✅" : "❌"}
      </Text>
      <Text style={styles.text}>Loading: {isLoading ? "⏳" : "✅"}</Text>
      <Text style={styles.text}>User: {user ? user.email : "None"}</Text>
      <Text style={styles.text}>
        Token: {token ? "✅ Present" : "❌ Missing"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 50,
    left: 16,
    right: 16,
    backgroundColor: "#000",
    padding: 12,
    borderRadius: 8,
    opacity: 0.8,
    zIndex: 1000,
  },
  title: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 4,
  },
  text: {
    color: "#fff",
    fontSize: 10,
    marginBottom: 2,
  },
});
