// File: frontend/src/screens/MyItemsScreen.js
// Screen untuk menampilkan item-item milik user (found, lost, claims)

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ItemCard from "../components/ItemCard";
import { API_CONFIG } from "../config/api";

const { width } = Dimensions.get("window");

export default function MyItemsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState("found");
  const [items, setItems] = useState({
    found: [],
    lost: [],
    claims: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  // Tab configuration
  const tabs = [
    { id: "found", label: "Temuan", count: items.found.length },
    { id: "lost", label: "Hilang", count: items.lost.length },
    { id: "claims", label: "Klaim", count: items.claims.length },
  ];

  // Debug AsyncStorage
  const debugAsyncStorage = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      console.log("🔍 AsyncStorage Keys:", keys);

      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        console.log(`📱 ${key}:`, value);
      }
    } catch (error) {
      console.error("Debug AsyncStorage error:", error);
    }
  };

  // Get user data dari AsyncStorage
  const getUserData = async () => {
    try {
      // Try get email directly first
      let email = await AsyncStorage.getItem("userEmail");
      if (email) {
        console.log("✅ Found email from userEmail key:", email);
        setUserEmail(email);
        return email;
      }

      // Try get from email key
      email = await AsyncStorage.getItem("email");
      if (email) {
        console.log("✅ Found email from email key:", email);
        setUserEmail(email);
        return email;
      }

      // Try get from userData object
      const userData = await AsyncStorage.getItem("userData");
      if (userData) {
        const user = JSON.parse(userData);
        if (user.email) {
          console.log("✅ Found email from userData:", user.email);
          setUserEmail(user.email);
          return user.email;
        }
      }

      throw new Error("Email not found in AsyncStorage");
    } catch (error) {
      console.error("❌ Error getting user email:", error);
      Alert.alert(
        "Session Expired",
        "Silakan login kembali untuk melanjutkan",
        [
          {
            text: "OK",
            onPress: () => {
              AsyncStorage.multiRemove([
                "userToken",
                "userEmail",
                "userData",
                "email",
              ]);
              navigation.goBack();
            },
          },
        ]
      );
      return null;
    }
  };

  // Fetch user items dari backend berdasarkan type
  const fetchUserItems = async (type = "all") => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        throw new Error("Token not found");
      }

      console.log(`📡 Fetching user items, type: ${type}`);

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/items/my-items?type=${type}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Token expired");
        }
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch items");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("❌ Error fetching user items:", error);

      if (error.message === "Token expired") {
        Alert.alert("Sesi Berakhir", "Silakan login kembali", [
          {
            text: "OK",
            onPress: () => {
              AsyncStorage.multiRemove(["userToken", "userEmail", "userData"]);
              navigation.goBack();
            },
          },
        ]);
      } else {
        Alert.alert("Error", "Gagal mengambil data item");
      }

      throw error;
    }
  };

  // Load semua data user berdasarkan tab aktif
  const loadUserItems = async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);

      const email = await getUserData();
      if (!email) return;

      // Fetch data untuk semua tabs
      const [foundResponse, lostResponse, claimsResponse] =
        await Promise.allSettled([
          fetchUserItems("found"),
          fetchUserItems("lost"),
          fetchUserItems("claims"),
        ]);

      // Update state dengan data yang berhasil di-fetch
      setItems({
        found:
          foundResponse.status === "fulfilled"
            ? foundResponse.value.data || []
            : [],
        lost:
          lostResponse.status === "fulfilled"
            ? lostResponse.value.data || []
            : [],
        claims:
          claimsResponse.status === "fulfilled"
            ? claimsResponse.value.data || []
            : [],
      });

      console.log("✅ Items loaded successfully:", {
        found:
          foundResponse.status === "fulfilled"
            ? foundResponse.value.data?.length
            : 0,
        lost:
          lostResponse.status === "fulfilled"
            ? lostResponse.value.data?.length
            : 0,
        claims:
          claimsResponse.status === "fulfilled"
            ? claimsResponse.value.data?.length
            : 0,
      });
    } catch (error) {
      console.error("❌ Error loading user items:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadUserItems(false);
  }, []);

  // Handle item press
  const handleItemPress = (item) => {
    console.log("📱 Item pressed:", item.id, item.type);

    // Navigate ke detail berdasarkan tipe item
    if (item.type === "found") {
      navigation.navigate("FoundItemDetail", {
        itemId: item.id,
        isOwner: true,
      });
    } else if (item.type === "lost") {
      navigation.navigate("LostItemDetail", {
        itemId: item.id,
        isOwner: true,
      });
    } else if (item.type === "claims") {
      navigation.navigate("ClaimDetail", {
        claimId: item.id,
      });
    }
  };

  // Load data ketika screen di-focus
  useFocusEffect(
    useCallback(() => {
      debugAsyncStorage();
      loadUserItems();
    }, [])
  );

  // Get current items based on active tab
  const getCurrentItems = () => {
    return items[activeTab] || [];
  };

  // Render loading state
  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Item Saya</Text>
        </View>

        {/* Loading */}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Memuat data...</Text>
        </View>
      </View>
    );
  }

  // Render tab content
  const renderTabContent = () => {
    const currentItems = getCurrentItems();

    if (currentItems.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons
            name={
              activeTab === "found"
                ? "cube-outline"
                : activeTab === "lost"
                ? "search-outline"
                : "document-outline"
            }
            size={64}
            color="#d1d5db"
          />
          <Text style={styles.emptyText}>
            {activeTab === "found"
              ? "Belum ada barang temuan"
              : activeTab === "lost"
              ? "Belum ada barang hilang"
              : "Belum ada klaim"}
          </Text>
          <Text style={styles.emptySubtext}>
            {activeTab === "found"
              ? "Laporkan barang yang Anda temukan"
              : activeTab === "lost"
              ? "Laporkan barang yang hilang"
              : "Klaim akan muncul setelah disetujui"}
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.itemsList}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {currentItems.map((item, index) => (
          <ItemCard
            key={item.id || index}
            item={item}
            type={activeTab}
            onPress={handleItemPress}
            isOwner={true}
          />
        ))}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Item Saya</Text>

        {/* Debug button - remove in production */}
        <TouchableOpacity
          style={styles.debugButton}
          onPress={debugAsyncStorage}
        >
          <Ionicons name="bug" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* User Info */}
      {userEmail && (
        <View style={styles.userInfo}>
          <Text style={styles.userText}>📧 {userEmail}</Text>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.id && styles.activeTabText,
              ]}
            >
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{tab.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {renderTabContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    backgroundColor: "#2563eb",
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
    marginRight: 40,
  },
  debugButton: {
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 6,
  },
  userInfo: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  userText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6b7280",
  },
  tabsContainer: {
    backgroundColor: "white",
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#2563eb",
  },
  tabText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6b7280",
  },
  activeTabText: {
    color: "#2563eb",
    fontWeight: "600",
  },
  tabBadge: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
    minWidth: 20,
    alignItems: "center",
  },
  tabBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  itemsList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
  },
});
