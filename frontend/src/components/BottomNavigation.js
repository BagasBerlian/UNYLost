// File: frontend/src/components/BottomNavigation.js
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

const { width } = Dimensions.get("window");

export default function BottomNavigation() {
  const navigation = useNavigation();
  const route = useRoute();
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [scaleValue] = useState(new Animated.Value(0));

  const isActive = (routeName) => route.name === routeName;

  const navItems = [
    {
      icon: "home",
      iconFocused: "home",
      label: "Beranda",
      route: "Dashboard",
      active: isActive("Dashboard"),
    },
    {
      icon: "cube-outline",
      iconFocused: "cube",
      label: "Item Saya",
      route: "MyItems",
      active: isActive("MyItems"),
    },
    {
      icon: "add",
      iconFocused: "add",
      label: "Tambah",
      action: "add",
      active: false,
    },
    {
      icon: "notifications-outline",
      iconFocused: "notifications",
      label: "Notif",
      route: "Notifications",
      active: isActive("Notifications"),
    },
    {
      icon: "person-outline",
      iconFocused: "person",
      label: "Profil",
      route: "Profile",
      active: isActive("Profile"),
    },
  ];

  const handleNavigation = (item) => {
    if (item.action === "add") {
      openActionMenu();
    } else if (item.route) {
      navigation.navigate(item.route);
    }
  };

  const openActionMenu = () => {
    setShowActionMenu(true);
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const closeActionMenu = () => {
    Animated.spring(scaleValue, {
      toValue: 0,
      useNativeDriver: true,
    }).start(() => {
      setShowActionMenu(false);
    });
  };

  const handleReportAction = (type) => {
    closeActionMenu();
    setTimeout(() => {
      if (type === "found") {
        navigation.navigate("ReportFound");
      } else if (type === "lost") {
        navigation.navigate("ReportLost");
      }
    }, 300);
  };

  const NavButton = ({ item, index }) => {
    const isAddButton = item.action === "add";

    return (
      <TouchableOpacity
        key={index}
        style={[styles.navButton, isAddButton && styles.addButton]}
        onPress={() => handleNavigation(item)}
        activeOpacity={0.7}
      >
        {isAddButton ? (
          <View style={styles.addButtonContainer}>
            <Ionicons name={item.icon} size={24} color="white" />
          </View>
        ) : (
          <>
            <Ionicons
              name={item.active ? item.iconFocused : item.icon}
              size={22}
              color={item.active ? "#3b82f6" : "#9ca3af"}
            />
            <Text
              style={[
                styles.navLabel,
                { color: item.active ? "#3b82f6" : "#9ca3af" },
              ]}
            >
              {item.label}
            </Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      {/* Action Menu Modal */}
      <Modal
        visible={showActionMenu}
        transparent={true}
        animationType="none"
        onRequestClose={closeActionMenu}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeActionMenu}
        >
          <Animated.View
            style={[
              styles.actionMenuContainer,
              {
                transform: [{ scale: scaleValue }],
              },
            ]}
          >
            <View style={styles.actionMenuHandle} />

            <Text style={styles.actionMenuTitle}>
              Apa yang ingin kamu lakukan?
            </Text>

            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, styles.foundButton]}
                onPress={() => handleReportAction("found")}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={24} color="white" />
                <Text style={styles.actionButtonText}>
                  Saya Menemukan Barang
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.lostButton]}
                onPress={() => handleReportAction("lost")}
                activeOpacity={0.8}
              >
                <Ionicons name="search" size={24} color="white" />
                <Text style={styles.actionButtonText}>
                  Saya Kehilangan Barang
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={closeActionMenu}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>Batal</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Bottom Navigation */}
      <View style={styles.container}>
        <View style={styles.navContainer}>
          {navItems.map((item, index) => (
            <NavButton key={index} item={item} index={index} />
          ))}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingBottom: 20, // Safe area padding
  },
  navContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  navButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 60,
  },
  addButton: {
    transform: [{ translateY: -8 }],
  },
  addButtonContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  navLabel: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  actionMenuContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 24,
    minHeight: 280,
  },
  actionMenuHandle: {
    width: 48,
    height: 4,
    backgroundColor: "#d1d5db",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 24,
  },
  actionMenuTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    textAlign: "center",
    marginBottom: 24,
  },
  actionButtonsContainer: {
    gap: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 12,
  },
  foundButton: {
    backgroundColor: "#10b981",
  },
  lostButton: {
    backgroundColor: "#ef4444",
  },
  cancelButton: {
    backgroundColor: "#e5e7eb",
  },
  actionButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButtonText: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "600",
  },
});
