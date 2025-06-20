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

const dummyFoundItems = [
  {
    id: "found-1",
    name: "Kunci Mobil Toyota",
    description:
      "Ditemukan kunci mobil dengan gantungan menara Eiffel di dekat parkiran rektorat.",
    location: "Gedung Rektorat UNY",
    createdAt: "2025-06-12T10:00:00Z",
    images: [
      "https://media.karousell.com/media/photos/products/2024/8/2/cari_hp_iphone_15_14_promax_ba_1722579763_50f13e90_progressive",
    ],
    status: "claimed",
    type: "found",
    user: { name: "Bagas" },
  },
  {
    id: "found-2",
    name: "Headphone Sony WH-1000XM4",
    description:
      "Headphone dalam case hitam, ditemukan di perpustakaan pusat, lantai 2.",
    location: "Perpustakaan Pusat UNY",
    createdAt: "2025-06-4T15:30:00Z",
    images: [
      "https://www.static-src.com/wcsstore/Indraprastha/images/catalog/full//95/MTA-59702422/brd-69012_botol-minum-thermos-stainless-steel-800-ml-hd-688_full01.jpg",
    ],
    type: "found",
    status: "pending",
    user: { name: "Bagas" },
  },
];

const dummyLostItems = [
  {
    id: "lost-1",
    name: "Dompet Kulit Coklat",
    description:
      "Dompet berisi KTP, SIM, dan KTM. Terakhir terlihat di kantin FT.",
    location: "Kantin Fakultas Teknik",
    createdAt: "2025-06-16T12:00:00Z",
    images: [
      "https://id-test-11.slatic.net/p/664814516ac5c05b6e3063ef805eb91c.jpg",
    ],
    type: "lost",
    user: { name: "Bagas" },
  },
];

const dummyClaims = [
  {
    id: "claim-1",
    status: "Pending",
    createdAt: "2025-06-18T09:00:00Z",
    type: "claims",
    item: {
      id: "item-xyz",
      name: "iPhone 13 Pro",
      description: "Ditemukan iPhone 13 Pro warna Sierra Blue di dekat FIP.",
      location: "Fakultas Ilmu Pendidikan",
      createdAt: "2025-06-17T08:00:00Z",
      images: [
        "https://imgx.gridoto.com/crop/0x0:1280x853/700x465/filters:watermark(file/2017/gridoto/img/watermark.png,5,5,60)/photo/gridoto/2017/11/23/3353269077.jpeg",
      ],
      type: "found",
      user: { name: "Penemu Baik" },
    },
  },
  {
    id: "claim-2",
    status: "Approved",
    createdAt: "2025-06-15T11:00:00Z",
    type: "claims",
    item: {
      id: "item-abc",
      name: "Botol Minum Corkcicle",
      description: "Botol minum warna pink, ditemukan di GOR.",
      location: "GOR UNY",
      createdAt: "2025-06-14T17:00:00Z",
      images: [
        "https://filebroker-cdn.lazada.co.id/kf/Sdb09655bd0654c2cbd0c4cc7f73d7e517.jpg",
      ],
      type: "found",
      user: { name: "Admin GOR" },
    },
  },
];

export default function MyItemsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState("found");
  const [items, setItems] = useState({
    found: [],
    lost: [],
    claims: [],
  });
  const [isLoading, setIsLoading] = useState(true); // Mulai dengan true
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState("user.demo@uny.ac.id");

  // Tab configuration
  const tabs = [
    { id: "found", label: "Temuan", count: items.found.length },
    { id: "lost", label: "Hilang", count: items.lost.length },
    { id: "claims", label: "Klaim", count: items.claims.length },
  ];

  // Fungsi untuk memuat data dummy
  const loadDummyData = useCallback(() => {
    setIsLoading(true);
    // Simulasi jeda jaringan
    setTimeout(() => {
      setItems({
        found: dummyFoundItems,
        lost: dummyLostItems,
        claims: dummyClaims,
      });
      setIsLoading(false);
      setIsRefreshing(false);
    }, 1000); // Jeda 1 detik
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadDummyData();
  }, [loadDummyData]);

  // Handle item press
  const handleItemPress = (data) => {
    console.log("📱 Item pressed:", data);

    // Navigasi ke detail berdasarkan tipe data
    // Untuk 'found' & 'lost', data adalah item itu sendiri
    // Untuk 'claims', data adalah objek klaim
    if (data.type === "found") {
      navigation.navigate("FoundItemDetail", {
        itemId: data.id,
        isOwner: true,
      });
    } else if (data.type === "lost") {
      navigation.navigate("LostItemDetail", {
        itemId: data.id,
        isOwner: true,
      });
    } else if (data.type === "claims") {
      navigation.navigate("ClaimDetail", {
        claimId: data.id,
      });
    }
  };

  // Gunakan useFocusEffect untuk memuat data setiap kali layar ini aktif
  useFocusEffect(
    useCallback(() => {
      loadDummyData();
    }, [loadDummyData])
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

    if (currentItems.length === 0 && !isLoading) {
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
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {currentItems.map((data, index) => {
          // Jika tab adalah 'claims', 'item' berada di dalam 'data.item'
          // Jika tidak, 'item' adalah 'data' itu sendiri
          const item = activeTab === "claims" ? data.item : data;
          const key = activeTab === "claims" ? data.id : item.id;

          // Menambahkan properti status untuk ditampilkan di ItemCard jika itu adalah klaim
          if (activeTab === "claims") {
            item.claimStatus = data.status;
          }

          return (
            <ItemCard
              key={key || index}
              item={item}
              type={item.type} // Gunakan tipe asli dari item
              onPress={() => handleItemPress(data)}
              isOwner={true}
            />
          );
        })}
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
    marginRight: 16, // Memberi jarak agar judul bisa center
    position: "absolute", // Membuat tombol back tidak mendorong judul
    left: 16,
    top: 50,
    zIndex: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
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
});
