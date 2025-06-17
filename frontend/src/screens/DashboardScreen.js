// File: frontend/src/screens/DashboardScreen.js - FIXED
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { authAPI } from "../services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BottomNavigation from "../components/BottomNavigation";

const { width } = Dimensions.get("window");

export default function DashboardScreen() {
  const navigation = useNavigation();
  const { user, logout, isLoading } = useAuth();

  const [dashboardData, setDashboardData] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Initial state for stats, using 0 as default
  const [stats, setStats] = useState({
    found: 0,
    lost: 0,
    matches: 0,
    pending: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        console.log("❌ No token found, logging out");
        handleLogout();
        return;
      }

      console.log("📊 Loading dashboard data with token...");
      const response = await authAPI.getDashboard(token);

      if (response.success && response.data.stats) {
        console.log("✅ Dashboard data loaded successfully");
        setDashboardData(response.data);
        // Correctly extract the total value from each stat object
        setStats({
          found: response.data.stats.foundItems?.total ?? 0,
          lost: response.data.stats.lostItems?.total ?? 0,
          matches: response.data.stats.matches?.total ?? 0,
          pending: response.data.stats.claims?.total ?? 0, // Assuming 'claims' corresponds to 'pending'
        });
      } else {
        console.error("❌ Failed to load dashboard data:", response.message);
        console.log(
          "⚠️ Dashboard data unavailable, continuing with user data only"
        );
      }
    } catch (error) {
      console.error("❌ Dashboard load error:", error);
      console.log("⚠️ Network error, continuing with cached user data");
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
  };

  const handleLogout = async () => {
    Alert.alert("Konfirmasi Logout", "Apakah Anda yakin ingin keluar?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
            console.log("✅ Logout successful");
          } catch (error) {
            console.error("❌ Logout error:", error);
          }
        },
      },
    ]);
  };

  // Action cards for main actions
  const actionCards = [
    {
      title: "Saya Menemukan Barang",
      subtitle: "Laporkan barang yang kamu temukan",
      icon: "checkmark-circle",
      color: "#10b981",
      bgColor: "#dcfce7",
      action: () => navigation.navigate("ReportFound"),
    },
    {
      title: "Saya Kehilangan Barang",
      subtitle: "Laporkan barang yang kamu hilangkan",
      icon: "close-circle",
      color: "#ef4444",
      bgColor: "#fee2e2",
      action: () => navigation.navigate("ReportLost"),
    },
  ];

  // Stats cards now directly use the numerical values from the stats state
  const statsCards = [
    {
      icon: "checkmark-circle",
      title: "Barang Temuan",
      value: stats.found,
      color: "#10b981",
      bgColor: "#dcfce7",
    },
    {
      icon: "close-circle",
      title: "Barang Hilang",
      value: stats.lost,
      color: "#ef4444",
      bgColor: "#fee2e2",
    },
    {
      icon: "flash",
      title: "Match Ditemukan",
      value: stats.matches,
      color: "#3b82f6",
      bgColor: "#dbeafe",
    },
    {
      icon: "time",
      title: "Menunggu Review",
      value: stats.pending,
      color: "#f59e0b",
      bgColor: "#fef3c7",
    },
  ];

  const ActionCard = ({ item }) => (
    <TouchableOpacity
      style={[styles.actionCard, { backgroundColor: item.bgColor }]}
      onPress={item.action}
      activeOpacity={0.7}
    >
      <View style={styles.actionCardContent}>
        <View
          style={[styles.actionIconContainer, { backgroundColor: "white" }]}
        >
          <Ionicons name={item.icon} size={24} color={item.color} />
        </View>
        <View style={styles.actionTextContainer}>
          <Text style={styles.actionTitle}>{item.title}</Text>
          <Text style={styles.actionSubtitle}>{item.subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#6b7280" />
      </View>
    </TouchableOpacity>
  );

  const StatCard = ({ item }) => (
    <View style={[styles.statCard, { backgroundColor: item.bgColor }]}>
      <View style={[styles.statIconContainer, { backgroundColor: "white" }]}>
        <Ionicons name={item.icon} size={20} color={item.color} />
      </View>
      <Text style={styles.statValue}>{item.value}</Text>
      <Text style={styles.statTitle}>{item.title}</Text>
    </View>
  );

  if (isLoading || isLoadingData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.appTitle}>UNY LOST APP</Text>
            <Text style={styles.greeting}>
              Halo, {user?.firstName || "User"} {user?.lastName || ""}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Question Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Apa yang ingin kamu lakukan?</Text>

          <View style={styles.actionCardsContainer}>
            {actionCards.map((item, index) => (
              <ActionCard key={index} item={item} />
            ))}
          </View>
        </View>

        {/* Statistics Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>STATISTIK SAYA</Text>

          <View style={styles.statsGrid}>
            {statsCards.map((item, index) => (
              <StatCard key={index} item={item} />
            ))}
          </View>
        </View>

        {/* Bottom padding for navigation */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    fontSize: 16,
    color: "#6b7280",
  },
  header: {
    backgroundColor: "#3b82f6",
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  appTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
  },
  greeting: {
    fontSize: 16,
    color: "#bfdbfe",
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 16,
  },
  actionCardsContainer: {
    gap: 12,
  },
  actionCard: {
    borderRadius: 16,
    padding: 16,
  },
  actionCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 14,
    color: "#6b7280",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    width: (width - 52) / 2, // 2 columns with padding and gap
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
  },
  bottomPadding: {
    height: 100, // Space for bottom navigation
  },
});
