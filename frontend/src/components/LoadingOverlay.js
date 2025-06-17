// File: frontend/src/components/LoadingOverlay.js
// Component untuk menampilkan loading overlay

import React from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Modal,
  StatusBar,
} from "react-native";

const LoadingOverlay = ({
  visible = true,
  message = "Memuat data...",
  transparent = false,
  size = "large",
  color = "#3b82f6",
}) => {
  if (!transparent) {
    // Full screen loading
    return (
      <View style={styles.container}>
        <StatusBar backgroundColor="#3b82f6" barStyle="light-content" />
        <View style={styles.content}>
          <ActivityIndicator size={size} color={color} />
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    );
  }

  // Overlay loading (modal)
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size={size} color={color} />
          <Text style={styles.overlayMessage}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  message: {
    fontSize: 16,
    color: "#6b7280",
    marginTop: 16,
    textAlign: "center",
    fontWeight: "500",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingBox: {
    backgroundColor: "white",
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 150,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  overlayMessage: {
    fontSize: 14,
    color: "#4b5563",
    marginTop: 12,
    textAlign: "center",
    fontWeight: "500",
  },
});

export default LoadingOverlay;
