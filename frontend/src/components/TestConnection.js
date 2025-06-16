// File: frontend/src/components/TestConnection.js
import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { authAPI } from "../services/api";

export default function TestConnection() {
  const [connectionStatus, setConnectionStatus] = useState("testing");
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    testBackendConnection();
  }, []);

  const testBackendConnection = async () => {
    try {
      setConnectionStatus("testing");
      console.log("🔍 Testing backend connection...");

      const result = await authAPI.testConnection();

      if (result.success) {
        console.log("✅ Backend connection successful");
        setConnectionStatus("connected");
        // Auto hide after 3 seconds if connected
        setTimeout(() => setIsVisible(false), 3000);
      } else {
        console.log("❌ Backend connection failed:", result.error);
        setConnectionStatus("failed");
      }
    } catch (error) {
      console.error("❌ Connection test error:", error);
      setConnectionStatus("failed");
    }
  };

  const handleRetry = () => {
    setIsVisible(true);
    testBackendConnection();
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  const showDetails = () => {
    const messages = {
      testing: "Menguji koneksi ke backend...",
      connected: "Backend berhasil terhubung!",
      failed:
        "Gagal terhubung ke backend. Pastikan:\n\n1. Backend berjalan di localhost:5000\n2. Koneksi internet stabil\n3. CORS dikonfigurasi dengan benar",
    };

    Alert.alert(
      "Status Koneksi Backend",
      messages[connectionStatus],
      connectionStatus === "failed"
        ? [
            { text: "Coba Lagi", onPress: handleRetry },
            { text: "Tutup", style: "cancel" },
          ]
        : [{ text: "OK" }]
    );
  };

  if (!isVisible) {
    return (
      <TouchableOpacity
        style={styles.minimizedButton}
        onPress={() => setIsVisible(true)}
      >
        <Ionicons
          name={
            connectionStatus === "connected"
              ? "checkmark-circle"
              : "alert-circle"
          }
          size={20}
          color={connectionStatus === "connected" ? "#10b981" : "#ef4444"}
        />
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        styles.container,
        connectionStatus === "connected" && styles.connected,
        connectionStatus === "failed" && styles.failed,
      ]}
    >
      <TouchableOpacity style={styles.content} onPress={showDetails}>
        <View style={styles.leftContent}>
          <Ionicons
            name={
              connectionStatus === "testing"
                ? "reload-outline"
                : connectionStatus === "connected"
                ? "checkmark-circle"
                : "alert-circle"
            }
            size={20}
            color={
              connectionStatus === "testing"
                ? "#f59e0b"
                : connectionStatus === "connected"
                ? "#10b981"
                : "#ef4444"
            }
          />
          <Text
            style={[
              styles.text,
              connectionStatus === "connected" && styles.textConnected,
              connectionStatus === "failed" && styles.textFailed,
            ]}
          >
            {connectionStatus === "testing" && "Testing Backend..."}
            {connectionStatus === "connected" && "Backend Connected"}
            {connectionStatus === "failed" && "Backend Disconnected"}
          </Text>
        </View>

        <View style={styles.rightContent}>
          {connectionStatus === "failed" && (
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Ionicons name="refresh" size={16} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
          >
            <Ionicons name="close" size={16} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  connected: {
    borderLeftColor: "#10b981",
    backgroundColor: "#f0fdf4",
  },
  failed: {
    borderLeftColor: "#ef4444",
    backgroundColor: "#fef2f2",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  rightContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    marginLeft: 8,
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  textConnected: {
    color: "#065f46",
  },
  textFailed: {
    color: "#991b1b",
  },
  retryButton: {
    backgroundColor: "#ef4444",
    borderRadius: 4,
    padding: 4,
    marginRight: 8,
  },
  dismissButton: {
    padding: 4,
  },
  minimizedButton: {
    position: "absolute",
    top: 50,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
});
