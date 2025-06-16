// File: frontend/src/screens/DashboardScreen.js
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

const { width, height } = Dimensions.get("window");

export default function DashboardScreen() {
  const navigation = useNavigation();
  const { user, logout, isLoading } = useAuth();

  const [dashboardData, setDashboardData] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

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

      if (response.success) {
        console.log("✅ Dashboard data loaded successfully");
        setDashboardData(response.data);
      } else {
        console.error("❌ Failed to load dashboard data:", response.message);
        // Don't force logout on dashboard load error, just show message
        console.log(
          "⚠️ Dashboard data unavailable, continuing with user data only"
        );
      }
    } catch (error) {
      console.error("❌ Dashboard load error:", error);
      // Don't force logout on network error
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
      {
        text: "Batal",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          console.log("🚪 Starting logout process...");
          const result = await logout();
          if (result.success) {
            console.log(
              "✅ Logout successful, auth state will change automatically"
            );
            // Don't navigate manually - let App.js handle auth state change
          } else {
            console.error("❌ Logout failed:", result.message);
            Alert.alert("Error", "Logout gagal, coba lagi");
          }
        },
      },
    ]);
  };

  const renderStatCard = (title, value, icon, color, onPress = null) => (
    <TouchableOpacity
      style={[styles.statCard, { borderLeftColor: color }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.statContent}>
        <View style={styles.statLeft}>
          <Text style={styles.statTitle}>{title}</Text>
          <Text style={styles.statValue}>{value}</Text>
        </View>
        <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoadingData) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="reload-outline" size={32} color="#3478f6" />
        <Text style={styles.loadingText}>Memuat dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={["#3478f6"]}
          tintColor="#3478f6"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Selamat datang,</Text>
          <Text style={styles.username}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* User Status */}
      <View style={styles.statusContainer}>
        <View style={styles.statusItem}>
          <Ionicons
            name={user?.verified ? "checkmark-circle" : "alert-circle"}
            size={16}
            color={user?.verified ? "#10b981" : "#f59e0b"}
          />
          <Text
            style={[
              styles.statusText,
              { color: user?.verified ? "#10b981" : "#f59e0b" },
            ]}
          >
            Email {user?.verified ? "Terverifikasi" : "Belum Terverifikasi"}
          </Text>
        </View>
        <View style={styles.statusItem}>
          <Ionicons
            name={
              user?.isWhatsappVerified ? "checkmark-circle" : "alert-circle"
            }
            size={16}
            color={user?.isWhatsappVerified ? "#10b981" : "#f59e0b"}
          />
          <Text
            style={[
              styles.statusText,
              { color: user?.isWhatsappVerified ? "#10b981" : "#f59e0b" },
            ]}
          >
            WhatsApp{" "}
            {user?.isWhatsappVerified ? "Terverifikasi" : "Belum Terverifikasi"}
          </Text>
        </View>
      </View>

      {/* Statistics */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Statistik</Text>

        <View style={styles.statsGrid}>
          {renderStatCard(
            "Barang Hilang",
            dashboardData?.stats?.lostItems?.total || 0,
            "search-outline",
            "#ef4444"
          )}
          {renderStatCard(
            "Barang Ditemukan",
            dashboardData?.stats?.foundItems?.total || 0,
            "checkmark-circle-outline",
            "#10b981"
          )}
        </View>

        <View style={styles.statsGrid}>
          {renderStatCard(
            "Kecocokan",
            dashboardData?.stats?.matches?.total || 0,
            "link-outline",
            "#3478f6"
          )}
          {renderStatCard(
            "Klaim",
            dashboardData?.stats?.claims?.total || 0,
            "document-text-outline",
            "#f59e0b"
          )}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Aksi Cepat</Text>

        <TouchableOpacity style={styles.actionButton}>
          <View style={styles.actionIcon}>
            <Ionicons name="add-circle-outline" size={24} color="#3478f6" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Laporkan Barang Hilang</Text>
            <Text style={styles.actionSubtitle}>
              Buat laporan untuk barang yang hilang
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <View style={styles.actionIcon}>
            <Ionicons name="camera-outline" size={24} color="#10b981" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Laporkan Barang Ditemukan</Text>
            <Text style={styles.actionSubtitle}>
              Upload foto barang yang Anda temukan
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <View style={styles.actionIcon}>
            <Ionicons name="eye-outline" size={24} color="#f59e0b" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Lihat Kecocokan</Text>
            <Text style={styles.actionSubtitle}>
              Cek barang yang mungkin cocok dengan milik Anda
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* Account Info */}
      <View style={styles.accountSection}>
        <Text style={styles.sectionTitle}>Informasi Akun</Text>

        <View style={styles.accountCard}>
          <View style={styles.accountRow}>
            <Text style={styles.accountLabel}>User ID:</Text>
            <Text style={styles.accountValue}>{user?.id}</Text>
          </View>
          <View style={styles.accountRow}>
            <Text style={styles.accountLabel}>WhatsApp:</Text>
            <Text style={styles.accountValue}>{user?.whatsappNumber}</Text>
          </View>
          <View style={styles.accountRow}>
            <Text style={styles.accountLabel}>Terakhir Login:</Text>
            <Text style={styles.accountValue}>
              {user?.lastLogin
                ? new Date(user.lastLogin).toLocaleString("id-ID")
                : "Belum pernah login"}
            </Text>
          </View>
          <View style={styles.accountRow}>
            <Text style={styles.accountLabel}>Member Sejak:</Text>
            <Text style={styles.accountValue}>
              {new Date(user?.createdAt).toLocaleDateString("id-ID")}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  contentContainer: {
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6b7280",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#fff",
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 16,
    color: "#6b7280",
  },
  username: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
    marginTop: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
  },
  statusContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    marginLeft: 8,
    fontWeight: "500",
  },
  statsSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    width: (width - 60) / 2,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLeft: {
    flex: 1,
  },
  statTitle: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  actionsSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  actionButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f8f9fa",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: "#6b7280",
  },
  accountSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  accountCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  accountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  accountLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
    flex: 1,
  },
  accountValue: {
    fontSize: 14,
    color: "#1f2937",
    flex: 2,
    textAlign: "right",
  },
});
