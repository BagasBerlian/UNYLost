import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

const ItemCard = ({ item, type, onPress, isOwner = false }) => {
  const formatDate = (dateString) => {
    if (!dateString) return "Tanggal tidak tersedia";

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch (error) {
      return "Tanggal tidak valid";
    }
  };

  const getTimeAgo = (dateString) => {
    if (!dateString) return "Waktu tidak tersedia";

    try {
      const now = new Date();
      const date = new Date(dateString);
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffWeeks = Math.floor(diffDays / 7);

      if (diffDays < 1) return "Hari ini";
      if (diffDays === 1) return "1 hari yang lalu";
      if (diffDays < 7) return `${diffDays} hari yang lalu`;
      if (diffWeeks === 1) return "1 minggu yang lalu";
      return `${diffWeeks} minggu yang lalu`;
    } catch (error) {
      return "Waktu tidak valid";
    }
  };

  // Get status color and text
  const getStatusInfo = (status, itemType) => {
    const statusMap = {
      // Found item statuses
      available: { color: "#10b981", text: "Tersedia", bgColor: "#d1fae5" },
      pending_claim: {
        color: "#f59e0b",
        text: "Menunggu Klaim",
        bgColor: "#fef3c7",
      },
      claimed: { color: "#3b82f6", text: "Telah Diklaim", bgColor: "#dbeafe" },
      expired: { color: "#6b7280", text: "Kedaluwarsa", bgColor: "#f3f4f6" },

      // Lost item statuses
      active: { color: "#ef4444", text: "Aktif Dicari", bgColor: "#fee2e2" },
      has_matches: {
        color: "#f59e0b",
        text: "Ada Kecocokan",
        bgColor: "#fef3c7",
      },
      resolved: {
        color: "#10b981",
        text: "Telah Ditemukan",
        bgColor: "#d1fae5",
      },

      // Claim statuses
      pending: {
        color: "#f59e0b",
        text: "Menunggu Review",
        bgColor: "#fef3c7",
      },
      approved: { color: "#10b981", text: "Disetujui", bgColor: "#d1fae5" },
      rejected: { color: "#ef4444", text: "Ditolak", bgColor: "#fee2e2" },
    };

    return (
      statusMap[status] || {
        color: "#6b7280",
        text: status || "Status tidak diketahui",
        bgColor: "#f3f4f6",
      }
    );
  };

  // Get primary image
  const getPrimaryImage = () => {
    if (item.images && item.images.length > 0) {
      // Handle both string and object formats
      const firstImage = item.images[0];
      if (typeof firstImage === "string") {
        return firstImage;
      } else if (firstImage && firstImage.url) {
        return firstImage.url;
      }
    }
    return null;
  };

  // Get category icon
  const getCategoryIcon = (category) => {
    const iconMap = {
      "Dompet/Tas": "bag-outline",
      electronics: "phone-portrait-outline",
      documents: "document-outline",
      clothing: "shirt-outline",
      accessories: "watch-outline",
      books: "book-outline",
      keys: "key-outline",
      others: "ellipsis-horizontal-outline",
      // Legacy support
      Elektronik: "phone-portrait-outline",
      Kendaraan: "car-outline",
      Aksesoris: "watch-outline",
      Dokumen: "document-outline",
      "Alat Tulis": "pencil-outline",
      Pakaian: "shirt-outline",
      Lainnya: "ellipsis-horizontal-outline",
    };
    return iconMap[category] || "cube-outline";
  };

  // Get relevant data based on type
  const getItemData = () => {
    switch (type) {
      case "found":
        return {
          title: item.itemName || "Nama tidak tersedia",
          subtitle:
            item.locationFound || item.location || "Lokasi tidak tersedia",
          date: item.foundDate || item.createdAt,
          status: item.status || "available",
          matchCount: item.matchCount || 0,
          claimCount: item.claimCount || 0,
        };
      case "lost":
        return {
          title: item.itemName || "Nama tidak tersedia",
          subtitle:
            item.lastSeenLocation || item.location || "Lokasi tidak tersedia",
          date: item.dateLost || item.createdAt,
          status: item.status || "active",
          matchCount: item.matchCount || 0,
          reward: item.reward || 0,
        };
      case "claims":
        return {
          title: item.itemName || "Nama tidak tersedia",
          subtitle: item.story || "Klaim tidak ada cerita",
          date: item.createdAt,
          status: item.status || "pending",
        };
      default:
        return {
          title: item.itemName || "Nama tidak tersedia",
          subtitle: "Detail tidak tersedia",
          date: item.createdAt,
          status: "unknown",
        };
    }
  };

  const statusInfo = getStatusInfo(item.status, type);
  const primaryImage = getPrimaryImage();
  const itemData = getItemData();
  const categoryIcon = getCategoryIcon(item.category);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress && onPress(item)}
      activeOpacity={0.7}
    >
      {/* Image Section */}
      <View style={styles.imageContainer}>
        {primaryImage ? (
          <Image
            source={{ uri: primaryImage }}
            style={styles.itemImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name={categoryIcon} size={32} color="#9ca3af" />
          </View>
        )}

        {/* Status Badge */}
        <View
          style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}
        >
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.text}
          </Text>
        </View>
      </View>

      {/* Content Section */}
      <View style={styles.contentContainer}>
        {/* Title and Time */}
        <View style={styles.headerRow}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {itemData.title}
          </Text>
          <Text style={styles.timeAgo}>{getTimeAgo(itemData.date)}</Text>
        </View>

        {/* Subtitle/Location */}
        <Text style={styles.itemSubtitle} numberOfLines={1}>
          <Ionicons name="location-outline" size={14} color="#6b7280" />
          {" " + itemData.subtitle}
        </Text>

        {/* Date */}
        <Text style={styles.itemDate}>
          <Ionicons name="calendar-outline" size={14} color="#6b7280" />
          {" " + formatDate(itemData.date)}
        </Text>

        {/* Action Section */}
        <View style={styles.actionSection}>
          {/* Found Items Actions */}
          {type === "found" && (
            <>
              {itemData.matchCount > 0 && (
                <View style={styles.actionItem}>
                  <Ionicons name="people" size={16} color="#3b82f6" />
                  <Text style={styles.actionText}>
                    {itemData.matchCount} Match
                    {itemData.matchCount > 1 ? "es" : ""}
                  </Text>
                </View>
              )}
              {itemData.claimCount > 0 && (
                <View style={styles.actionItem}>
                  <Ionicons name="hand-right" size={16} color="#f59e0b" />
                  <Text style={styles.actionText}>
                    {itemData.claimCount} Klaim
                  </Text>
                </View>
              )}
              {itemData.matchCount === 0 && itemData.claimCount === 0 && (
                <View style={styles.actionItem}>
                  <Ionicons name="time" size={16} color="#6b7280" />
                  <Text style={[styles.actionText, { color: "#6b7280" }]}>
                    Menunggu
                  </Text>
                </View>
              )}
            </>
          )}

          {/* Lost Items Actions */}
          {type === "lost" && (
            <>
              {itemData.matchCount > 0 && (
                <View style={styles.actionItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                  <Text style={styles.actionText}>
                    {itemData.matchCount} Kemungkinan
                  </Text>
                </View>
              )}
              {itemData.reward > 0 && (
                <View style={styles.actionItem}>
                  <Ionicons name="gift" size={16} color="#f59e0b" />
                  <Text style={styles.actionText}>
                    Rp {itemData.reward.toLocaleString("id-ID")}
                  </Text>
                </View>
              )}
              {itemData.matchCount === 0 && (
                <View style={styles.actionItem}>
                  <Ionicons name="search" size={16} color="#6b7280" />
                  <Text style={[styles.actionText, { color: "#6b7280" }]}>
                    Mencari...
                  </Text>
                </View>
              )}
            </>
          )}

          {/* Claims Actions */}
          {type === "claims" && (
            <View style={styles.actionItem}>
              <Ionicons
                name={
                  item.status === "approved"
                    ? "checkmark-circle"
                    : item.status === "rejected"
                    ? "close-circle"
                    : "time"
                }
                size={16}
                color={statusInfo.color}
              />
              <Text style={[styles.actionText, { color: statusInfo.color }]}>
                {statusInfo.text}
              </Text>
            </View>
          )}

          {/* Arrow */}
          <View style={styles.arrowContainer}>
            <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  imageContainer: {
    position: "relative",
    height: 200,
    backgroundColor: "#f3f4f6",
  },
  itemImage: {
    width: "100%",
    height: "100%",
  },
  placeholderImage: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  statusBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  contentContainer: {
    padding: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  itemTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginRight: 8,
  },
  timeAgo: {
    fontSize: 12,
    color: "#6b7280",
  },
  itemSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
  },
  itemDate: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 12,
  },
  actionSection: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    marginBottom: 4,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 4,
    color: "#374151",
  },
  arrowContainer: {
    marginLeft: "auto",
  },
});

export default ItemCard;
