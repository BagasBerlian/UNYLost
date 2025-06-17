// File: frontend/src/components/BottomNavigation.js - UPDATED for Style Preferences
import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  Text,
  TouchableWithoutFeedback,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

export default function BottomNavigation() {
  const navigation = useNavigation();
  const route = useRoute();
  const [modalVisible, setModalVisible] = useState(false);

  const handleCloseModal = () => {
    setTimeout(() => {
      setModalVisible(false);
    }, 0);
  };

  const handleNavigate = (screen) => {
    setTimeout(() => {
      setModalVisible(false);
      navigation.navigate(screen);
    }, 0);
  };

  const menuItems = [
    { icon: "home", screen: "Dashboard" },
    { icon: "list", screen: "MyItems" },
    { icon: "add", isCentral: true },
    { icon: "notifications", screen: "Notifications" },
    { icon: "person", screen: "Profile" },
  ];

  return (
    <View style={styles.outerContainer}>
      <View style={styles.container}>
        {menuItems.map((item, index) => {
          const isActive = route.name === item.screen;
          if (item.isCentral) {
            return (
              <TouchableOpacity
                key={index}
                style={styles.addButton}
                onPress={() => setModalVisible(true)}
              >
                <Ionicons name="add" size={32} color="white" />
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              key={index}
              style={styles.navItem}
              onPress={() => navigation.navigate(item.screen)}
            >
              <Ionicons
                name={isActive ? item.icon : `${item.icon}-outline`}
                size={24}
                color={isActive ? "#3b82f6" : "#6b7280"}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal
        animationType="slide" // <--- PERUBAHAN 1: Kembali ke 'slide'
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleCloseModal}
      >
        <TouchableWithoutFeedback onPress={handleCloseModal}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Buat Laporan Baru</Text>
              <Text style={styles.modalSubtitle}>
                Pilih jenis laporan yang ingin Anda buat
              </Text>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => handleNavigate("ReportFound")}
              >
                <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                <Text style={styles.modalOptionText}>
                  Laporan Barang Temuan
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => handleNavigate("ReportLost")}
              >
                <Ionicons name="close-circle" size={24} color="#ef4444" />
                <Text style={styles.modalOptionText}>
                  Laporan Barang Hilang
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCloseModal}
              >
                <Text style={styles.cancelButtonText}>Batal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    alignItems: "center",
  },
  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    width: "90%",
    height: 70,
    backgroundColor: "white",
    borderRadius: 35,
    marginBottom: Platform.OS === "ios" ? 30 : 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    bottom: 25,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end", // <--- PERUBAHAN 2: Kembali ke 'flex-end'
    backgroundColor: "transparent", // <--- PERUBAHAN 3: Latar belakang dibuat transparan
  },
  modalContent: {
    backgroundColor: "white",
    padding: 24,
    borderTopLeftRadius: 20, // <--- PERUBAHAN 4: Sudut kembali seperti semula
    borderTopRightRadius: 20,
    alignItems: "center",
    // Menambahkan shadow agar terlihat 'mengambang' di atas konten
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 24,
    textAlign: "center",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    padding: 16,
    borderRadius: 12,
    width: "100%",
    marginBottom: 12,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginLeft: 12,
  },
  cancelButton: {
    marginTop: 12,
    padding: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#6b7280",
    fontWeight: "600",
  },
});
