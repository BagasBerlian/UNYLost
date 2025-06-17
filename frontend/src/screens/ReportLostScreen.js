// File: frontend/src/screens/ReportLostScreen.js - FIXED
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
} from "react-native";
// Perubahan dimulai di sini
import Slider from "@react-native-community/slider"; // Memperbaiki impor Slider
// Perubahan selesai
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

export default function ReportLostScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    itemName: "",
    description: "",
    category: "",
    lastSeenLocation: "",
    dateLost: new Date().toISOString().split("T")[0],
    reward: 0,
    images: [],
  });

  const categories = [
    "Elektronik",
    "Aksesoris",
    "Pakaian",
    "Tas/Dompet",
    "Kendaraan",
    "Dokumen",
    "Alat Tulis",
    "Lainnya",
  ];

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRewardChange = (value) => {
    // Round to nearest 50000
    const roundedValue = Math.round(value / 50000) * 50000;
    setFormData((prev) => ({
      ...prev,
      reward: Math.max(0, Math.min(500000, roundedValue)),
    }));
  };

  const handleImagePicker = async () => {
    try {
      // Request permission
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert(
          "Permission Required",
          "Permission to access camera roll is required!"
        );
        return;
      }

      // Check current image count
      if (formData.images.length >= 5) {
        Alert.alert("Maksimal 5 Foto", "Anda sudah memilih maksimal 5 foto");
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      Alert.alert("Error", "Terjadi kesalahan saat memilih gambar");
    }
  };

  const removeImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const validateForm = () => {
    if (!formData.itemName.trim()) {
      Alert.alert("Error", "Nama barang harus diisi");
      return false;
    }
    if (!formData.description.trim()) {
      Alert.alert("Error", "Deskripsi barang harus diisi");
      return false;
    }
    if (!formData.category) {
      Alert.alert("Error", "Kategori harus dipilih");
      return false;
    }
    if (!formData.lastSeenLocation.trim()) {
      Alert.alert("Error", "Lokasi terakhir terlihat harus diisi");
      return false;
    }
    if (formData.images.length < 2) {
      Alert.alert("Error", "Minimal 2 foto harus diupload");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Create FormData for file upload
      const submitData = new FormData();
      submitData.append("itemName", formData.itemName);
      submitData.append("description", formData.description);
      submitData.append("category", formData.category);
      submitData.append("lastSeenLocation", formData.lastSeenLocation);
      submitData.append("dateLost", formData.dateLost);
      submitData.append("reward", formData.reward.toString());

      // Add images
      formData.images.forEach((img, index) => {
        submitData.append("images", {
          uri: img.uri,
          name: img.name,
          type: img.type,
        });
      });

      const token = await AsyncStorage.getItem("userToken");
      const response = await fetch("http://localhost:5000/api/items/lost", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: submitData,
      });

      const result = await response.json();

      if (response.ok) {
        // Navigate to success page
        navigation.navigate("ReportSuccess", {
          type: "lost",
          reportId: result.itemId,
          matchesCount: result.matchesCount || 0,
        });
      } else {
        Alert.alert("Error", result.message || "Gagal mengirim laporan");
      }
    } catch (error) {
      console.error("Submit error:", error);
      Alert.alert("Error", "Terjadi kesalahan saat mengirim laporan");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
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
        <Text style={styles.headerTitle}>LAPORKAN KEHILANGAN</Text>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <View style={styles.infoIcon}>
          <Ionicons name="information-circle" size={20} color="#3b82f6" />
        </View>
        <Text style={styles.infoText}>
          Silakan isi detail barang yang kamu hilangkan dengan lengkap untuk
          memudahkan proses pencarian.
        </Text>
      </View>

      {/* Form */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Upload Photos */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Unggah Foto Barang <Text style={styles.required}>*</Text> (minimal 2
            foto)
          </Text>

          {/* Image Grid */}
          <View style={styles.imageGrid}>
            {formData.images.map((img, index) => (
              <View key={index} style={styles.imageContainer}>
                <Image source={{ uri: img.uri }} style={styles.image} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeImage(index)}
                >
                  <Ionicons name="close" size={16} color="white" />
                </TouchableOpacity>
              </View>
            ))}

            {/* Add Image Button */}
            {formData.images.length < 5 && (
              <TouchableOpacity
                style={styles.addImageButton}
                onPress={handleImagePicker}
              >
                <Ionicons name="camera" size={24} color="#3b82f6" />
                <Text style={styles.addImageText}>
                  Klik untuk memasukkan foto
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.imageInfo}>
            {formData.images.length} foto dipilih (min. 2)
          </Text>
          <Text style={styles.imageFormat}>Format: JPG, PNG (Maks. 5MB)</Text>
        </View>

        {/* Item Description */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Deskripsi Detail Barang <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.textArea}
            value={formData.description}
            onChangeText={(value) => handleInputChange("description", value)}
            placeholder="Jelaskan detail barang seperti warna, merek, kondisi, dll."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Item Name */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Nama Barang <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={formData.itemName}
            onChangeText={(value) => handleInputChange("itemName", value)}
            placeholder="Contoh: Dompet Hitam"
          />
        </View>

        {/* Last Seen Location */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Lokasi Terakhir <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.inputWithIcon}>
            <Ionicons
              name="location"
              size={20}
              color="#6b7280"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.inputWithIconText}
              value={formData.lastSeenLocation}
              onChangeText={(value) =>
                handleInputChange("lastSeenLocation", value)
              }
              placeholder="Contoh: Gedung FMIPA Lantai 2"
            />
          </View>
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Kategori <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.categoryContainer}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryButton,
                  formData.category === cat && styles.categoryButtonActive,
                ]}
                onPress={() => handleInputChange("category", cat)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    formData.category === cat && styles.categoryTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Date Lost */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Tanggal dan Waktu Ditemukan <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.inputWithIcon}>
            <Ionicons
              name="calendar"
              size={20}
              color="#6b7280"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.inputWithIconText}
              value={`${formData.dateLost} 11:31`}
              onChangeText={(value) => {
                const dateOnly = value.split(" ")[0];
                handleInputChange("dateLost", dateOnly);
              }}
              placeholder="YYYY-MM-DD HH:MM"
            />
          </View>
        </View>

        {/* Reward */}
        <View style={styles.section}>
          <Text style={styles.label}>Hadiah (Opsional)</Text>

          <View style={styles.rewardContainer}>
            <View style={styles.rewardRange}>
              <Text style={styles.rewardRangeText}>Rp. 0</Text>
              <Text style={styles.rewardRangeText}>Rp. 500.000</Text>
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
              thumbStyle={{ backgroundColor: "#3b82f6" }}
            />

            <View style={styles.rewardValueContainer}>
              <Text style={styles.rewardValue}>
                hadiah: {formatCurrency(formData.reward)}
              </Text>
            </View>

            <Text style={styles.rewardNote}>
              Tambahkan reward untuk meningkatkan peluang barang ditemukan
            </Text>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitButtonText}>Kirim Laporan</Text>
          )}
        </TouchableOpacity>

        {/* Bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
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
  infoBanner: {
    backgroundColor: "#eff6ff",
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
    margin: 16,
    padding: 16,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoIcon: {
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: "#1e40af",
    lineHeight: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  required: {
    color: "#ef4444",
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  imageContainer: {
    position: "relative",
    width: (width - 48) / 3 - 5,
    height: 80,
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  removeButton: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#ef4444",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  addImageButton: {
    width: (width - 48) / 3 - 5,
    height: 80,
    borderWidth: 2,
    borderColor: "#3b82f6",
    borderStyle: "dashed",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },
  addImageText: {
    fontSize: 10,
    color: "#3b82f6",
    textAlign: "center",
    marginTop: 4,
  },
  imageInfo: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 2,
  },
  imageFormat: {
    fontSize: 12,
    color: "#6b7280",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "white",
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "white",
    height: 100,
  },
  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "white",
  },
  inputIcon: {
    marginLeft: 12,
  },
  inputWithIconText: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 20,
    backgroundColor: "white",
  },
  categoryButtonActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  categoryText: {
    fontSize: 14,
    color: "#6b7280",
  },
  categoryTextActive: {
    color: "white",
  },
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
  rewardRangeText: {
    fontSize: 12,
    color: "#6b7280",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  rewardValueContainer: {
    alignItems: "center",
    marginTop: 8,
  },
  rewardValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#3b82f6",
  },
  rewardNote: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  bottomPadding: {
    height: 100,
  },
});
