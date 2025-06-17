// File: frontend/src/screens/MyItemsScreen.js
// Update minimal untuk membaca data berdasarkan user login

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { API_CONFIG } from "../config/api";
import { debugAsyncStorage } from "../utils/DebugStorage"; // Import debug helper

const MyItemsScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState("found");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [items, setItems] = useState({
    found: [],
    lost: [],
    claims: [],
  });

  // Tab configuration berdasarkan UI mockup
  const tabs = [
    { id: "found", label: "Temuan", count: items.found.length },
    { id: "lost", label: "Hilang", count: items.lost.length },
    { id: "claims", label: "Klaim", count: items.claims.length },
  ];

  // Get user data dari AsyncStorage
  const getUserData = async () => {
    try {
      // Cek berbagai kemungkinan key yang digunakan untuk menyimpan user data
      const email =
        (await AsyncStorage.getItem("userEmail")) ||
        (await AsyncStorage.getItem("email")) ||
        (await AsyncStorage.getItem("user_email"));

      if (email) {
        console.log("Found user email:", email);
        setUserEmail(email);
        return email;
      }

      // Jika email tidak ada, coba ambil dari user data object
      const userData = await AsyncStorage.getItem("userData");
      if (userData) {
        const user = JSON.parse(userData);
        if (user.email) {
          console.log("Found email from userData:", user.email);
          setUserEmail(user.email);
          return user.email;
        }
      }

      throw new Error("Email not found in AsyncStorage");
    } catch (error) {
      console.error("Error getting user email:", error);
      Alert.alert(
        "Session Expired",
        "Silakan login kembali untuk melanjutkan",
        [
          {
            text: "OK",
            onPress: () => {
              // Clear all stored data
              AsyncStorage.multiRemove([
                "userToken",
                "userEmail",
                "userData",
                "email",
              ]);
              // Navigate back instead of to Login (jika Login route tidak ada)
              navigation.goBack();
            },
          },
        ]
      );
      return null;
    }
  };

  // Fetch user items dari backend berdasarkan email login
  const fetchUserItems = async (email, type = "all") => {
    try {
      const token = await AsyncStorage.getItem("userToken");

      if (!token) {
        throw new Error("Token not found");
      }

      // Endpoint sesuai backend route yang sudah ada
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
      console.error("Error fetching user items:", error);

      if (error.message === "Token expired") {
        Alert.alert("Sesi Berakhir", "Silakan login kembali", [
          {
            text: "OK",
            onPress: () => {
              // Clear stored data
              AsyncStorage.multiRemove(["userToken", "userEmail", "userData"]);
              // Go back instead of navigating to Login
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

  // Load semua data user
  const loadUserItems = async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);

      const email = await getUserData();
      if (!email) return;

      // Fetch data untuk ketiga tab
      const [foundResponse, lostResponse, claimsResponse] =
        await Promise.allSettled([
          fetchUserItems(email, "found"),
          fetchUserItems(email, "lost"),
          fetchUserItems(email, "claims"),
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
    } catch (error) {
      console.error("Error loading user items:", error);
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
    console.log("Item pressed:", item);
    // Navigate ke detail item
    // navigation.navigate('ItemDetail', { item });
  };

  // Load data ketika screen di-focus
  useFocusEffect(
    useCallback(() => {
      // Debug AsyncStorage saat screen load
      debugAsyncStorage();
      loadUserItems();
    }, [])
  );

  // Render item card sederhana
  const renderItemCard = (item, type) => (
    <TouchableOpacity
      key={item.id}
      style={styles.itemCard}
      onPress={() => handleItemPress(item)}
    >
      {/* Image placeholder atau actual image */}
      <View style={styles.imageContainer}>
        {item.images && item.images.length > 0 ? (
          <Image
            source={{ uri: item.images[0] }}
            style={styles.itemImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>Foto {item.itemName}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={{
          position: "absolute",
          top: 100,
          right: 20,
          backgroundColor: "red",
          padding: 10,
        }}
        onPress={() => debugAsyncStorage()}
      >
        <Text style={{ color: "white" }}>Debug Storage</Text>
      </TouchableOpacity>

      {/* Item details */}
      <View style={styles.itemDetails}>
        <Text style={styles.itemName}>{item.itemName}</Text>

        {/* Time ago */}
        <Text style={styles.timeAgo}>
          {item.timeAgo || "1 minggu yang lalu"}
        </Text>

        {/* Status berdasarkan type */}
        {type === "found" && item.matchCount > 0 && (
          <View style={styles.statusContainer}>
            <Ionicons name="people" size={16} color="#3b82f6" />
            <Text style={styles.matchText}>{item.matchCount} Matches</Text>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionText}>Lihat matches</Text>
              <Ionicons name="chevron-forward" size={16} color="#3b82f6" />
            </TouchableOpacity>
          </View>
        )}

        {type === "lost" && item.claimCount > 0 && (
          <View style={styles.statusContainer}>
            <Ionicons name="warning" size={16} color="#f59e0b" />
            <Text style={styles.claimText}>{item.claimCount} Klaim</Text>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionText}>Review Klaim</Text>
              <Ionicons name="chevron-forward" size={16} color="#f59e0b" />
            </TouchableOpacity>
          </View>
        )}

        {type === "claims" && (
          <View style={styles.statusContainer}>
            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
            <Text style={styles.approvedText}>Approved</Text>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionText}>Review Barang</Text>
              <Ionicons name="chevron-forward" size={16} color="#3b82f6" />
            </TouchableOpacity>
          </View>
        )}

        {/* No status case */}
        {type === "found" && (!item.matchCount || item.matchCount === 0) && (
          <View style={styles.statusContainer}>
            <Ionicons name="close-circle" size={16} color="#6b7280" />
            <Text style={styles.noMatchText}>Belum ada match</Text>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionText}>Lihat matches</Text>
              <Ionicons name="chevron-forward" size={16} color="#3b82f6" />
            </TouchableOpacity>
          </View>
        )}

        {type === "lost" && (!item.claimCount || item.claimCount === 0) && (
          <View style={styles.statusContainer}>
            <Ionicons name="close-circle" size={16} color="#6b7280" />
            <Text style={styles.noMatchText}>Belum ada klaim</Text>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionText}>Review Klaim</Text>
              <Ionicons name="chevron-forward" size={16} color="#f59e0b" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  // Render content berdasarkan active tab
  const renderTabContent = () => {
    const currentItems = items[activeTab] || [];

    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Memuat data...</Text>
        </View>
      );
    }

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
      >
        {currentItems.map((item) => renderItemCard(item, activeTab))}
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
      </View>

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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    flex: 1,
    textAlign: "center",
    marginRight: 40, // Kompensasi untuk back button
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "white",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#3b82f6",
  },
  tabText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6b7280",
  },
  activeTabText: {
    color: "#3b82f6",
    fontWeight: "600",
  },
  tabBadge: {
    backgroundColor: "#ef4444",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
    minWidth: 20,
    alignItems: "center",
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "white",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },
  loadingText: {
    fontSize: 16,
    color: "#6b7280",
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6b7280",
    textAlign: "center",
    marginTop: 16,
  },
  itemsList: {
    flex: 1,
    padding: 16,
  },
  itemCard: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    overflow: "hidden",
  },
  imageContainer: {
    flexDirection: "row",
    padding: 16,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  placeholderImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 10,
    color: "#6b7280",
    textAlign: "center",
  },
  itemDetails: {
    flex: 1,
    marginLeft: 16,
    justifyContent: "center",
  },
  itemName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  timeAgo: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  matchText: {
    fontSize: 14,
    color: "#3b82f6",
    fontWeight: "600",
    marginLeft: 4,
  },
  claimText: {
    fontSize: 14,
    color: "#f59e0b",
    fontWeight: "600",
    marginLeft: 4,
  },
  approvedText: {
    fontSize: 14,
    color: "#10b981",
    fontWeight: "600",
    marginLeft: 4,
  },
  noMatchText: {
    fontSize: 14,
    color: "#6b7280",
    marginLeft: 4,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
  },
  actionText: {
    fontSize: 14,
    color: "#3b82f6",
    marginRight: 4,
  },
});

export default MyItemsScreen;
