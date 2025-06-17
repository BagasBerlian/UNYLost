// File: frontend/src/screens/ReportLostScreen.js - Final Version
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  Dimensions,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import Slider from "@react-native-community/slider"; // <-- Import Slider

const { width } = Dimensions.get("window");

export default function ReportLostScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    itemName: "",
    description: "",
    category: "",
    // Disesuaikan untuk Laporan Kehilangan
    lastSeenLocation: "",
    dateLost: new Date(),
    reward: 0, // Ditambahkan untuk Laporan Kehilangan
    images: [],
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const categories = [
    "Dompet/Tas",
    "Elektronik",
    "Kartu Identitas",
    "Kunci",
    "Buku/ATK",
    "Aksesoris",
    "Pakaian",
    "Lainnya",
  ];

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Fungsi untuk handle slider reward
  const handleRewardChange = (value) => {
    const roundedValue = Math.round(value / 50000) * 50000;
    setFormData((prev) => ({
      ...prev,
      reward: Math.max(0, Math.min(500000, roundedValue)),
    }));
  };

  const handleImagePicker = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert("Izin dibutuhkan", "Akses ke galeri foto diperlukan!");
        return;
      }
      if (formData.images.length >= 5) {
        Alert.alert("Maksimal 5 Foto", "Anda sudah memilih maksimal 5 foto");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: 5 - formData.images.length,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}.jpg`,
          type: asset.type || "image/jpeg",
        }));
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, ...newImages],
        }));
      }
    } catch (error) {
      console.error("Image picker error:", error);
      Alert.alert("Error", "Terjadi kesalahan saat memilih gambar.");
    }
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      const newDate = new Date(formData.dateLost);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      handleInputChange("dateLost", newDate);
    }
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(Platform.OS === "ios");
    if (selectedTime) {
      const newTime = new Date(formData.dateLost);
      newTime.setHours(selectedTime.getHours());
      newTime.setMinutes(selectedTime.getMinutes());
      handleInputChange("dateLost", newTime);
    }
  };

  const removeImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleSubmit = async () => {
    /* ... Implementasi submit ... */
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          {/* Teks disesuaikan */}
          <Text style={styles.headerTitle}>LAPORKAN KEHILANGAN</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.infoBanner}>
            <View style={styles.infoIcon}>
              <Ionicons name="information-circle" size={20} color="#3b82f6" />
            </View>
            {/* Teks disesuaikan */}
            <Text style={styles.infoText}>
              Silakan isi detail barang yang kamu hilangkan dengan lengkap untuk
              memudahkan proses pencarian.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Unggah Foto Barang (Opsional)</Text>
            <View style={styles.imageGrid}>
              {formData.images.map((img, index) => (
                <View key={index} style={styles.imageContainer}>
                  <Image source={{ uri: img.uri }} style={styles.image} />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
              {formData.images.length < 5 && (
                <TouchableOpacity
                  style={styles.addImageButton}
                  onPress={handleImagePicker}
                >
                  <Ionicons name="camera" size={32} color="#9ca3af" />
                  <Text style={styles.addImageText}>
                    Klik untuk memasukkan foto
                  </Text>
                  <Text style={styles.addImageSubText}>
                    Format: JPG, PNG (Maks. 5MB)
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>
              Nama Barang <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Contoh: Dompet Hitam"
              value={formData.itemName}
              onChangeText={(text) => handleInputChange("itemName", text)}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>
              Deskripsi Detail Barang <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Jelaskan detail barang seperti warna, merek, kondisi, dll."
              multiline
              value={formData.description}
              onChangeText={(text) => handleInputChange("description", text)}
            />
          </View>

          {/* Teks disesuaikan */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Lokasi Terakhir <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Contoh: Gedung FMIPA Lantai 2"
              value={formData.lastSeenLocation}
              onChangeText={(text) =>
                handleInputChange("lastSeenLocation", text)
              }
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>
              Kategori <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.pickerContainer}>
              <TextInput
                style={styles.input}
                placeholder="Pilih kategori barang"
                value={formData.category}
                editable={false}
              />
              <Ionicons
                name="chevron-down"
                size={20}
                color="#6b7280"
                style={styles.pickerIcon}
              />
              <Picker
                selectedValue={formData.category}
                onValueChange={(itemValue) =>
                  handleInputChange("category", itemValue)
                }
                style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  opacity: 0,
                }}
              >
                <Picker.Item label="Pilih kategori barang" value="" />
                {categories.map((cat) => (
                  <Picker.Item key={cat} label={cat} value={cat} />
                ))}
              </Picker>
            </View>
          </View>

          <View
            style={[
              styles.section,
              { flexDirection: "row", justifyContent: "space-between" },
            ]}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              {/* Teks disesuaikan */}
              <Text style={styles.label}>
                Tanggal Hilang <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.dateInputContainer}
                onPress={() => setShowDatePicker(true)}
              >
                <TextInput
                  style={styles.input}
                  value={formData.dateLost.toLocaleDateString("id-ID")}
                  editable={false}
                />
                <Ionicons
                  name="calendar"
                  size={20}
                  color="#6b7280"
                  style={styles.pickerIcon}
                />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              {/* Teks disesuaikan */}
              <Text style={styles.label}>
                Waktu Hilang <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.dateInputContainer}
                onPress={() => setShowTimePicker(true)}
              >
                <TextInput
                  style={styles.input}
                  value={formData.dateLost.toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  editable={false}
                />
                <Ionicons
                  name="time"
                  size={20}
                  color="#6b7280"
                  style={styles.pickerIcon}
                />
              </TouchableOpacity>
            </View>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={formData.dateLost}
              mode="date"
              display="default"
              onChange={onDateChange}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={formData.dateLost}
              mode="time"
              is24Hour={true}
              display="default"
              onChange={onTimeChange}
            />
          )}

          {/* Bagian Reward ditambahkan di sini */}
          <View style={styles.section}>
            <Text style={styles.label}>Hadiah (Opsional)</Text>
            <View style={styles.rewardContainer}>
              <View style={styles.rewardRange}>
                <Text style={styles.rewardRangeText}>Rp 0</Text>
                <Text style={styles.rewardRangeText}>Rp 500.000</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={500000}
                step={50000}
                value={formData.reward}
                onValueChange={handleRewardChange}
                minimumTrackTintColor="#3b82f6"
                maximumTrackTintColor="#d1d5db"
                thumbTintColor="#3b82f6"
              />
              <View style={styles.rewardValueContainer}>
                <Text style={styles.rewardValue}>
                  hadiah: {formatCurrency(formData.reward)}
                </Text>
              </View>
              <Text style={styles.rewardNote}>
                Tambahkan reward untuk meningkatkan peluang barang ditemukan.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Kirim Laporan</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    backgroundColor: "#3b82f6",
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    elevation: 4,
  },
  backButton: { padding: 8, marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "white" },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    padding: 16,
    marginVertical: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  infoIcon: { marginRight: 12 },
  infoText: { flex: 1, fontSize: 14, color: "#1e3a8a" },
  content: { paddingHorizontal: 16 },
  section: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: "600", color: "#1f2937", marginBottom: 8 },
  required: { color: "#ef4444" },
  input: {
    backgroundColor: "white",
    borderColor: "#d1d5db",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#1f2937",
  },
  textArea: { height: 100, textAlignVertical: "top" },
  imageGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  imageContainer: { position: "relative", marginRight: 10, marginBottom: 10 },
  image: {
    width: (width - 32 - 40) / 4,
    height: (width - 32 - 40) / 4,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
  },
  removeButton: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "white",
    borderRadius: 12,
  },
  addImageButton: {
    width: width - 32,
    height: 120,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#d1d5db",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    padding: 10,
  },
  addImageText: {
    marginTop: 4,
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "500",
  },
  addImageSubText: { color: "#9ca3af", fontSize: 12 },
  pickerContainer: { justifyContent: "center" },
  pickerIcon: { position: "absolute", right: 12 },
  dateInputContainer: { justifyContent: "center" },
  submitButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 40,
    elevation: 2,
  },
  submitButtonText: { color: "white", fontSize: 18, fontWeight: "bold" },
  // Gaya baru untuk Reward Section
  rewardContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  rewardRange: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  rewardRangeText: { fontSize: 12, color: "#6b7280" },
  slider: { width: "100%", height: 40 },
  rewardValueContainer: { alignItems: "center", marginTop: 8 },
  rewardValue: { fontSize: 18, fontWeight: "600", color: "#3b82f6" },
  rewardNote: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
  },
});
