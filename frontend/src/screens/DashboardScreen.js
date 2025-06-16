import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

export default function DashboardScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Selamat Datang,</Text>
            <Text style={styles.nameText}>{user?.fullName || "User"}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {/* Status Cards */}
        <View style={styles.statusContainer}>
          <View style={styles.statusCard}>
            <Ionicons name="search" size={32} color="#3478f6" />
            <Text style={styles.statusTitle}>Barang Hilang</Text>
            <Text style={styles.statusNumber}>0</Text>
          </View>

          <View style={styles.statusCard}>
            <Ionicons name="checkmark-circle" size={32} color="#10b981" />
            <Text style={styles.statusTitle}>Barang Ditemukan</Text>
            <Text style={styles.statusNumber}>0</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity style={[styles.actionButton, styles.lostButton]}>
            <Ionicons name="alert-circle" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Laporkan Barang Hilang</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.foundButton]}>
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>
              Laporkan Barang Ditemukan
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <View style={styles.activityContainer}>
          <Text style={styles.sectionTitle}>Aktivitas Terbaru</Text>
          <View style={styles.emptyActivity}>
            <Ionicons name="document-text-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyText}>Belum ada aktivitas</Text>
            <Text style={styles.emptySubtext}>
              Mulai laporkan barang hilang atau temuan Anda
            </Text>
          </View>
        </View>

        {/* User Info */}
        <View style={styles.userInfoContainer}>
          <Text style={styles.sectionTitle}>Informasi Akun</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>WhatsApp:</Text>
              <Text style={styles.infoValue}>{user?.whatsappNumber}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status Email:</Text>
              <Text
                style={[
                  styles.infoValue,
                  user?.isEmailVerified ? styles.verified : styles.unverified,
                ]}
              >
                {user?.isEmailVerified ? "Terverifikasi" : "Belum Verifikasi"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status WhatsApp:</Text>
              <Text
                style={[
                  styles.infoValue,
                  user?.isWhatsappVerified
                    ? styles.verified
                    : styles.unverified,
                ]}
              >
                {user?.isWhatsappVerified
                  ? "Terverifikasi"
                  : "Belum Verifikasi"}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 16,
    color: "#6b7280",
  },
  nameText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
  },
  logoutButton: {
    padding: 8,
  },
  statusContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 12,
  },
  statusCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusTitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 8,
    marginBottom: 4,
    textAlign: "center",
  },
  statusNumber: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1f2937",
  },
  actionContainer: {
    marginBottom: 32,
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  lostButton: {
    backgroundColor: "#ef4444",
  },
  foundButton: {
    backgroundColor: "#10b981",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  activityContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 16,
  },
  emptyActivity: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
  userInfoContainer: {
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  infoLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  verified: {
    color: "#10b981",
  },
  unverified: {
    color: "#ef4444",
  },
});
