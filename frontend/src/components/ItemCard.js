// File: frontend/src/components/ItemCard.js
// Component untuk menampilkan item card di My Items screen

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
  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
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
    };

    return (
      statusMap[status] || {
        color: "#6b7280",
        text: status,
        bgColor: "#f3f4f6",
      }
    );
  };

  // Get primary image
  const getPrimaryImage = () => {
    if (item.images && item.images.length > 0) {
      return typeof item.images[0] === "string"
        ? item.images[0]
        : item.images[0].url;
    }
    return null;
  };

  // Get category icon
  const getCategoryIcon = (category) => {
    const iconMap = {
      "Dompet/Tas": "bag-outline",
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

  const statusInfo = getStatusInfo(item.status, type);
  const primaryImage = getPrimaryImage();
  const dateToShow = type === "found" ? item.foundDate : item.dateLost;
  const locationToShow =
    type === "found" ? item.locationFound : item.lastSeenLocation;

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
            <Ionicons
              name={getCategoryIcon(item.category)}
              size={32}
              color="#9ca3af"
            />
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

        {/* Match/Claim Count Badge */}
        {(item.matchCount > 0 || item.claimCount > 0) && (
          <View style={styles.countBadge}>
            <Ionicons
              name={type === "found" ? "people-outline" : "search-outline"}
              size={12}
              color="white"
            />
            <Text style={styles.countText}>
              {type === "found" ? item.claimCount || 0 : item.matchCount || 0}
            </Text>
          </View>
        )}
      </View>

      {/* Content Section */}
      <View style={styles.contentContainer}>
        {/* Item Name */}
        <Text style={styles.itemName} numberOfLines={2}>
          {item.itemName}
        </Text>

        {/* Category */}
        <View style={styles.categoryContainer}>
          <Ionicons
            name={getCategoryIcon(item.category)}
            size={14}
            color="#6b7280"
          />
          <Text style={styles.categoryText}>{item.category}</Text>
        </View>

        {/* Location */}
        <View style={styles.locationContainer}>
          <Ionicons name="location-outline" size={14} color="#6b7280" />
          <Text style={styles.locationText} numberOfLines={1}>
            {locationToShow}
          </Text>
        </View>

        {/* Date */}
        <View style={styles.dateContainer}>
          <Ionicons name="calendar-outline" size={14} color="#6b7280" />
          <Text style={styles.dateText}>
            {type === "found" ? "Ditemukan" : "Hilang"}:{" "}
            {formatDate(dateToShow)}
          </Text>
        </View>

        {/* Reward (for lost items) */}
        {type === "lost" && item.reward > 0 && (
          <View style={styles.rewardContainer}>
            <Ionicons name="gift-outline" size={14} color="#f59e0b" />
            <Text style={styles.rewardText}>
              Reward: Rp {item.reward.toLocaleString("id-ID")}
            </Text>
          </View>
        )}

        {/* Description Preview */}
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>

        {/* Bottom Actions/Info */}
        <View style={styles.bottomContainer}>
          <View style={styles.dateCreated}>
            <Text style={styles.createdText}>
              Dibuat {formatDate(item.createdAt)}
            </Text>
          </View>

          {isOwner && (
            <View style={styles.ownerBadge}>
              <Ionicons name="person" size={12} color="#3b82f6" />
              <Text style={styles.ownerText}>Milik Saya</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    overflow: "hidden",
  },
  imageContainer: {
    position: "relative",
    height: 180,
    backgroundColor: "#f8fafc",
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
    backgroundColor: "#f1f5f9",
  },
  statusBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  countBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#3b82f6",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countText: {
    fontSize: 11,
    fontWeight: "600",
    color: "white",
    marginLeft: 2,
  },
  contentContainer: {
    padding: 16,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
    lineHeight: 22,
  },
  categoryContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  categoryText: {
    fontSize: 13,
    color: "#6b7280",
    marginLeft: 6,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  locationText: {
    fontSize: 13,
    color: "#6b7280",
    marginLeft: 6,
    flex: 1,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  dateText: {
    fontSize: 13,
    color: "#6b7280",
    marginLeft: 6,
  },
  rewardContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  rewardText: {
    fontSize: 13,
    color: "#f59e0b",
    fontWeight: "600",
    marginLeft: 6,
  },
  description: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 12,
  },
  bottomContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateCreated: {
    flex: 1,
  },
  createdText: {
    fontSize: 12,
    color: "#9ca3af",
  },
  ownerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ownerText: {
    fontSize: 11,
    color: "#3b82f6",
    fontWeight: "600",
    marginLeft: 3,
  },
});

export default ItemCard;
