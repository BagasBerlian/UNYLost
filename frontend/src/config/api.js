// File: frontend/src/config/api.js
import { Platform } from "react-native";
import Constants from "expo-constants";

// GANTI IP INI DENGAN IP LAPTOP ANDA
const LAPTOP_IP = "192.168.109.105"; // ← UBAH SESUAI IP LAPTOP

function getApiBaseUrl() {
  // Jika running di Expo Go (real device)
  if (Constants.appOwnership === "expo") {
    return `http://${LAPTOP_IP}:5000/api`;
  }

  // Jika running di simulator/emulator
  if (Platform.OS === "ios") {
    return "http://localhost:5000/api"; // iOS Simulator
  } else if (Platform.OS === "android") {
    return "http://10.0.2.2:5000/api"; // Android Emulator
  }

  // Default fallback
  return `http://${LAPTOP_IP}:5000/api`;
}

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
};

export default API_CONFIG;
