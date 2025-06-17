// File: frontend/src/screens/ReportSuccessScreen.js
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

const { width, height } = Dimensions.get("window");

export default function ReportSuccessScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { type, reportId, matchesCount } = route.params || {};

  // Generate report ID if not provided
  const displayReportId = reportId || `UNY${Date.now().toString().slice(-6)}`;

  const isLostReport = type === "lost";
  const isFoundReport = type === "found";

  const handleViewItems = () => {
    navigation.navigate("MyItems");
  };

  const handleBackToHome = () => {
    navigation.navigate("Dashboard");
  };

  return (
    <View style={styles.container}>
      {/* Success Content */}
      <View style={styles.content}>
        {/* Success Icon */}
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={80} color="#10b981" />
        </View>

        {/* Success Title */}
        <Text style={styles.title}>Laporan Berhasil!</Text>

        {/* Success Message */}
        <Text style={styles.message}>
          Terima kasih telah menggunakan{" "}
          <Text style={styles.appName}>UNYLost</Text>.{"\n"}
          Laporan Anda telah berhasil dikirim dan sedang diproses.
        </Text>

        {/* Auto Matching Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={20} color="#3b82f6" />
            <Text style={styles.infoTitle}>Pencocokan Otomatis</Text>
          </View>
          <Text style={styles.infoText}>
            Sistem kami akan mencocokkan laporan Anda dengan laporan lain yang
            relevan. Cek hasil pencocokan di menu "Barang Saya".
          </Text>
        </View>

        {/* Next Steps */}
        <View style={styles.stepsContainer}>
          <Text style={styles.stepsTitle}>Langkah Selanjutnya:</Text>

          <View style={styles.stepsList}>
            <View style={styles.stepItem}>
              <View style={styles.stepDot} />
              <Text style={styles.stepText}>
                Anda akan menerima notifikasi jika ada kecocokan
              </Text>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepDot} />
              <Text style={styles.stepText}>
                Pantau status laporan Anda di menu "Barang Saya"
              </Text>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepDot} />
              <Text style={styles.stepText}>
                Jika ada kecocokan, Anda dapat menghubungi pihak terkait
              </Text>
            </View>
          </View>
        </View>

        {/* Report ID */}
        <View style={styles.reportIdContainer}>
          <Text style={styles.reportIdLabel}>ID Laporan:</Text>
          <Text style={styles.reportId}>#{displayReportId}</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleViewItems}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Lihat Barang Saya</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleBackToHome}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Kembali ke Beranda</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  successIcon: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1f2937",
    textAlign: "center",
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  appName: {
    fontWeight: "600",
    color: "#3b82f6",
  },
  infoCard: {
    backgroundColor: "#eff6ff",
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    width: "100%",
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e40af",
    marginLeft: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#1e40af",
    lineHeight: 20,
  },
  stepsContainer: {
    width: "100%",
    marginBottom: 32,
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 16,
  },
  stepsList: {
    gap: 12,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10b981",
    marginTop: 6,
    marginRight: 12,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  reportIdContainer: {
    alignItems: "center",
  },
  reportIdLabel: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 4,
  },
  reportId: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1f2937",
    fontFamily: "monospace",
  },
  buttonsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#3b82f6",
    fontSize: 16,
    fontWeight: "600",
  },
});
