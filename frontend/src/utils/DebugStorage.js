// File: frontend/src/utils/DebugStorage.js
// Script untuk debug AsyncStorage data

import AsyncStorage from "@react-native-async-storage/async-storage";

export const debugAsyncStorage = async () => {
  try {
    console.log("=== DEBUG ASYNC STORAGE ===");

    // Get all keys
    const keys = await AsyncStorage.getAllKeys();
    console.log("📋 All AsyncStorage keys:", keys);

    // Get all values
    const values = await AsyncStorage.multiGet(keys);

    console.log("💾 AsyncStorage contents:");
    values.forEach(([key, value]) => {
      console.log(`  ${key}:`, value);

      // Try to parse JSON values
      if (value && (value.startsWith("{") || value.startsWith("["))) {
        try {
          const parsed = JSON.parse(value);
          console.log(`  ${key} (parsed):`, parsed);
        } catch (e) {
          // Not JSON, skip
        }
      }
    });

    // Check specific keys
    const userToken = await AsyncStorage.getItem("userToken");
    const userEmail = await AsyncStorage.getItem("userEmail");
    const userData = await AsyncStorage.getItem("userData");
    const email = await AsyncStorage.getItem("email");

    console.log("🔍 Specific checks:");
    console.log("  userToken exists:", !!userToken);
    console.log("  userEmail:", userEmail);
    console.log("  userData:", userData);
    console.log("  email:", email);

    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        console.log("  userData.email:", parsed.email);
      } catch (e) {
        console.log("  userData is not valid JSON");
      }
    }

    console.log("=== END DEBUG ===");

    return {
      keys,
      userToken: !!userToken,
      userEmail,
      userData,
      email,
    };
  } catch (error) {
    console.error("Debug AsyncStorage error:", error);
    return null;
  }
};

// Function to manually set test data
export const setTestUserData = async () => {
  try {
    const testUserData = {
      id: "test-user-123",
      email: "test@uny.ac.id",
      firstName: "Test",
      lastName: "User",
      token: "test-token-123",
    };

    await AsyncStorage.multiSet([
      ["userToken", testUserData.token],
      ["userEmail", testUserData.email],
      ["userData", JSON.stringify(testUserData)],
    ]);

    console.log("✅ Test user data set successfully");
    console.log("Test data:", testUserData);
  } catch (error) {
    console.error("Error setting test data:", error);
  }
};

// Function to clear all user data
export const clearUserData = async () => {
  try {
    await AsyncStorage.multiRemove([
      "userToken",
      "userEmail",
      "userData",
      "email",
      "user_token",
      "user_email",
    ]);
    console.log("✅ All user data cleared");
  } catch (error) {
    console.error("Error clearing user data:", error);
  }
};
