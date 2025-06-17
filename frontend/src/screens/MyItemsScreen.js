// File: frontend/src/screens/MyItemsScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import BottomNavigation from "../components/BottomNavigation";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

export default function MyItemsScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState("found"); // found, lost, claims
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [items, setItems] = useState({
    found: [],
    lost: [],
    claims: [],
  });

  useEffect(() => {
    loadUserItems();
  }, []);

  const loadUserItems = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");

      // TODO: Implement API calls to load user items
      console.log("Loading user items...");

      // Mock data for now
      setItems({
        found: [
          {
            id: 1,
            name: "Dompet Hitam",
            matches: 2,
            time: "1 minggu yang lalu",
          },
          { id: 2, name: "Buku Catatan", matches: 1, time: "3 hari yang lalu" },
          { id: 3, name: "Kacamata Baca", matches: 0, time: "5 jam yang lalu" },
        ],
        lost: [
          {
            id: 1,
            name: "Kunci Motor",
            matches: 1,
            time: "1 minggu yang lalu",
          },
          {
            id: 2,
            name: "PowerBank 10000 Mah",
            matches: 0,
            time: "5 jam yang lalu",
          },
        ],
        claims: [
          {
            id: 1,
            name: "Laptop Asus",
            status: "approved",
            time: "5 hari yang lalu",
          },
        ],
      });
    } catch (error) {
      console.error("Failed to load items:", error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadUserItems();
    setIsRefreshing(false);
  };

  const tabs = [
    { id: "found", label: "Temuan", count: items.found.length },
    { id: "lost", label: "Hilang", count: items.lost.length },
    { id: "claims", label: "Klaim", count: items.claims.length },
  ];

  const ItemCard = ({ item, type }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemImagePlaceholder}>
        <Text style={styles.itemImageText}>
          Foto{"\n"}
          {item.name.split(" ")[0]}
        </Text>
      </View>

      <View style={styles.itemContent}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemTime}>{item.time}</Text>

        {type === "claims" ? (
          <View
            style={[
              styles.statusBadge,
              item.status === "approved"
                ? styles.approvedBadge
                : styles.pendingBadge,
            ]}
          >
            <Ionicons
              name={item.status === "approved" ? "checkmark-circle" : "time"}
              size={14}
              color="white"
            />
            <Text style={styles.statusText}>
              {item.status === "approved" ? "Approved" : "Pending"}
            </Text>
          </View>
        ) : item.matches > 0 ? (
          <TouchableOpacity style={styles.matchesBadge}>
            <Ionicons name="eye" size={14} color="#3b82f6" />
            <Text style={styles.matchesText}>{item.matches} Matches</Text>
            <Text style={styles.viewLink}>Lihat matches →</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.noMatches}>✗ Belum ada match</Text>
        )}
      </View>
    </View>
  );

  const renderTabContent = () => {
    const currentItems = items[activeTab] || [];

    if (currentItems.length === 0) {
      return (
        <View style={styles.emptyState}>
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
        {currentItems.map((item) => (
          <ItemCard key={item.id} item={item} type={activeTab} />
        ))}
        <View style={styles.bottomPadding} />
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
        <View style={styles.tabs}>
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
                <View
                  style={[
                    styles.tabBadge,
                    activeTab === tab.id && styles.activeTabBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBadgeText,
                      activeTab === tab.id && styles.activeTabBadgeText,
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>{renderTabContent()}</View>

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
  header: {
    backgroundColor: "#3b82f6",
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  tabsContainer: {
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tabs: {
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    position: "relative",
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#3b82f6",
  },
  tabText: {
    fontSize: 14,
    color: "#6b7280",
    marginRight: 8,
  },
  activeTabText: {
    color: "#3b82f6",
    fontWeight: "600",
  },
  tabBadge: {
    backgroundColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  activeTabBadge: {
    backgroundColor: "#dbeafe",
  },
  tabBadgeText: {
    fontSize: 12,
    color: "#6b7280",
  },
  activeTabBadgeText: {
    color: "#3b82f6",
  },
  content: {
    flex: 1,
  },
  itemsList: {
    flex: 1,
    padding: 16,
  },
  itemCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemImagePlaceholder: {
    width: 60,
    height: 60,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  itemImageText: {
    fontSize: 10,
    color: "#6b7280",
    textAlign: "center",
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  itemTime: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 8,
  },
  matchesBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  matchesText: {
    fontSize: 12,
    color: "#3b82f6",
    fontWeight: "500",
  },
  viewLink: {
    fontSize: 12,
    color: "#3b82f6",
    marginLeft: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    alignSelf: "flex-start",
  },
  approvedBadge: {
    backgroundColor: "#10b981",
  },
  pendingBadge: {
    backgroundColor: "#f59e0b",
  },
  statusText: {
    fontSize: 12,
    color: "white",
    fontWeight: "500",
  },
  noMatches: {
    fontSize: 12,
    color: "#9ca3af",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#9ca3af",
    marginTop: 16,
  },
  bottomPadding: {
    height: 120,
  },
});
