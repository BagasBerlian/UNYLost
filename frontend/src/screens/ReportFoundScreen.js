// File: frontend/src/screens/ReportFoundScreen.js
// Screen untuk melaporkan barang temuan

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_CONFIG } from "../config/api";

export default function ReportFoundScreen({ navigation }) {
  const [formData, setFormData] = useState({
    itemName: "",
    description: "",
    category: "",
    locationFound: "",
    foundDate: new Date(),
    foundTime: new Date(),
    images: [],
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Categories sesuai backend
  const categories = [
    { value: "electronics", label: "Elektronik", icon: "phone-portrait" },
    { value: "documents", label: "Dokumen", icon: "document" },
    { value: "clothing", label: "Pakaian", icon: "shirt" },
    { value: "accessories", label: "Aksesoris", icon: "watch" },
    { value: "books", label: "Buku", icon: "book" },
    { value: "keys", label: "Kunci", icon: "key" },
    { value: "others", label: "Lainnya", icon: "ellipsis-horizontal" },
  ];

  // Handle input change
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle date change
  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData((prev) => ({
        ...prev,
        foundDate: selectedDate,
      }));
    }
  };

  // Handle time change
  const handleTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime) {
      setFormData((prev) => ({
        ...prev,
        foundTime: selectedTime,
      }));
    }
  };

  // Handle image picker
  const handleImagePicker = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photo library"
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        const newImage = {
          uri: result.assets[0].uri,
          type: result.assets[0].type || "image/jpeg",
          name: result.assets[0].fileName || `image_${Date.now()}.jpg`,
        };

        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, newImage],
        }));
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Gagal mengambil gambar");
    }
  };

  // Remove image
  const removeImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  // Validate form
  const validateForm = () => {
    if (!formData.itemName.trim()) {
      Alert.alert("Validation Error", "Nama barang harus diisi");
      return false;
    }

    if (formData.itemName.trim().length < 3) {
      Alert.alert("Validation Error", "Nama barang minimal 3 karakter");
      return false;
    }

    if (!formData.description.trim()) {
      Alert.alert("Validation Error", "Deskripsi harus diisi");
      return false;
    }

    if (formData.description.trim().length < 10) {
      Alert.alert("Validation Error", "Deskripsi minimal 10 karakter");
      return false;
    }

    if (!formData.category) {
      Alert.alert("Validation Error", "Kategori harus dipilih");
      return false;
    }

    if (!formData.locationFound.trim()) {
      Alert.alert("Validation Error", "Lokasi temuan harus diisi");
      return false;
    }

    if (formData.locationFound.trim().length < 3) {
      Alert.alert("Validation Error", "Lokasi temuan minimal 3 karakter");
      return false;
    }

    return true;
  };

  // Submit form
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Prepare form data
      const submitData = new FormData();

      submitData.append("itemName", formData.itemName.trim());
      submitData.append("description", formData.description.trim());
      submitData.append("category", formData.category);
      submitData.append("locationFound", formData.locationFound.trim());
      submitData.append(
        "foundDate",
        formData.foundDate.toISOString().split("T")[0]
      );
      submitData.append(
        "foundTime",
        formData.foundTime.toTimeString().slice(0, 5)
      );

      // Add images
      formData.images.forEach((image, index) => {
        submitData.append("images", {
          uri: image.uri,
          type: image.type,
          name: image.name,
        });
      });

      console.log("📤 Submitting found item report...");

      const response = await fetch(`${API_CONFIG.BASE_URL}/items/found`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        body: submitData,
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || "Gagal mengirim laporan");
      }

      console.log(
        "✅ Found item report submitted successfully:",
        responseData.data.id
      );

      Alert.alert(
        "Berhasil!",
        "Laporan barang temuan berhasil dikirim. Sistem akan mencari kecocokan dengan barang hilang.",
        [
          {
            text: "OK",
            onPress: () => {
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      console.error("❌ Error submitting found item:", error);

      let errorMessage = "Gagal mengirim laporan";
      if (error.message.includes("token")) {
        errorMessage = "Sesi berakhir, silakan login kembali";
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert("Error", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format date untuk display
  const formatDate = (date) => {
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  // Format time untuk display
  const formatTime = (time) => {
    return time.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
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
        <Text style={styles.headerTitle}>Laporkan Barang Temuan</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Info Section */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#2563eb" />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>
              Bantu Orang Menemukan Barangnya
            </Text>
            <Text style={styles.infoDescription}>
              Laporkan barang yang Anda temukan dengan detail yang lengkap.
              Sistem AI akan mencocokkan dengan laporan barang hilang.
            </Text>
          </View>
        </View>

        {/* Upload Photos Section */}
        <View style={styles.section}>
          <Text style={styles.label}>Foto Barang Temuan</Text>
          <Text style={styles.sublabel}>
            Tambahkan foto untuk membantu pemilik mengenali barangnya
          </Text>

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
                <Text style={styles.addImageText}>Tambah Foto</Text>
                <Text style={styles.addImageSubText}>JPG, PNG (Max 5MB)</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Item Name */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Nama Barang <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: Dompet Hitam"
            value={formData.itemName}
            onChangeText={(text) => handleInputChange("itemName", text)}
            maxLength={100}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Deskripsi Detail Barang <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Jelaskan detail barang seperti warna, merek, kondisi, isi yang ada di dalamnya, dll."
            value={formData.description}
            onChangeText={(text) => handleInputChange("description", text)}
            maxLength={1000}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>
            {formData.description.length}/1000 karakter
          </Text>
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Kategori Barang <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.categoryGrid}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={[
                  styles.categoryButton,
                  formData.category === cat.value &&
                    styles.categoryButtonActive,
                ]}
                onPress={() => handleInputChange("category", cat.value)}
              >
                <Ionicons
                  name={cat.icon}
                  size={24}
                  color={formData.category === cat.value ? "white" : "#6b7280"}
                />
                <Text
                  style={[
                    styles.categoryText,
                    formData.category === cat.value &&
                      styles.categoryTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Location Found */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Lokasi Tempat Menemukan <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: Perpustakaan UNY Lantai 2"
            value={formData.locationFound}
            onChangeText={(text) => handleInputChange("locationFound", text)}
            maxLength={200}
          />
        </View>

        {/* Date and Time Found */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Tanggal & Waktu Menemukan <Text style={styles.required}>*</Text>
          </Text>

          <View style={styles.dateTimeRow}>
            {/* Date Picker */}
            <TouchableOpacity
              style={[styles.input, styles.dateTimeInput]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar" size={20} color="#6b7280" />
              <Text style={styles.dateTimeText}>
                {formatDate(formData.foundDate)}
              </Text>
            </TouchableOpacity>

            {/* Time Picker */}
            <TouchableOpacity
              style={[styles.input, styles.dateTimeInput]}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time" size={20} color="#6b7280" />
              <Text style={styles.dateTimeText}>
                {formatTime(formData.foundTime)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Date Picker Modal */}
          {showDatePicker && (
            <DateTimePicker
              value={formData.foundDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          )}

          {/* Time Picker Modal */}
          {showTimePicker && (
            <DateTimePicker
              value={formData.foundTime}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={handleTimeChange}
            />
          )}
        </View>

        {/* Submit Button */}
        <View style={styles.submitSection}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              isSubmitting && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="checkmark-circle" size={24} color="white" />
            )}
            <Text style={styles.submitButtonText}>
              {isSubmitting ? "Mengirim..." : "Laporkan Barang Temuan"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.submitNote}>
            Dengan mengirim laporan ini, Anda setuju untuk dihubungi jika ada
            yang mengklaim barang tersebut.
          </Text>
        </View>
      </ScrollView>
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
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
    marginRight: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  infoCard: {
    backgroundColor: "#eff6ff",
    borderLeftWidth: 4,
    borderLeftColor: "#2563eb",
    padding: 16,
    marginVertical: 16,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e40af",
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 14,
    color: "#3730a3",
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  required: {
    color: "#ef4444",
  },
  sublabel: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 12,
  },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#374151",
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  charCount: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "right",
    marginTop: 4,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  imageContainer: {
    position: "relative",
    width: 100,
    height: 100,
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  removeButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "white",
    borderRadius: 10,
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderWidth: 2,
    borderColor: "#d1d5db",
    borderStyle: "dashed",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  addImageText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
    fontWeight: "500",
  },
  addImageSubText: {
    fontSize: 10,
    color: "#9ca3af",
    textAlign: "center",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  categoryButton: {
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 16,
    minWidth: 80,
    flex: 1,
  },
  categoryButtonActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  categoryText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 8,
    textAlign: "center",
    fontWeight: "500",
  },
  categoryTextActive: {
    color: "white",
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 12,
  },
  dateTimeInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  dateTimeText: {
    fontSize: 16,
    color: "#374151",
    marginLeft: 8,
  },
  submitSection: {
    paddingVertical: 24,
  },
  submitButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  submitButtonDisabled: {
    backgroundColor: "#9ca3af",
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  submitNote: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 16,
  },
});
