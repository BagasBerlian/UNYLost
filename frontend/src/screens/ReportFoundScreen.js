// File: frontend/src/screens/ReportFoundScreen.js
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
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

// (Asumsi Anda akan menggunakan komponen Picker dan DateTimePicker dari library seperti @react-native-community/datetimepicker dan @react-native-picker/picker)
// import { Picker } from '@react-native-picker/picker';
// import DateTimePicker from '@react-native-community/datetimepicker';

const { width } = Dimensions.get("window");

export default function ReportFoundScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    itemName: "",
    description: "",
    category: "",
    locationFound: "",
    foundDate: new Date().toISOString().split("T")[0],
    foundTime: new Date().toTimeString().slice(0, 5),
    images: [],
  });

  // State untuk mengontrol visibilitas picker (contoh implementasi)
  const [showDatePicker, setShowDatePicker] = useState(false);

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
    if (!formData.locationFound.trim()) {
      Alert.alert("Error", "Lokasi ditemukan harus diisi");
      return false;
    }
    if (formData.images.length === 0) {
      Alert.alert("Error", "Minimal 1 foto harus diupload");
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
      submitData.append("locationFound", formData.locationFound);
      submitData.append("foundDate", formData.foundDate);
      submitData.append("foundTime", formData.foundTime);

      // Add images
      formData.images.forEach((img, index) => {
        submitData.append("images", {
          uri: img.uri,
          name: img.name,
          type: img.type,
        });
      });

      const token = await AsyncStorage.getItem("userToken");
      // Ganti 'http://localhost:5000' dengan URL backend Anda yang sebenarnya
      const response = await fetch("http://localhost:5000/api/items/found", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // 'Content-Type': 'multipart/form-data' akan diatur secara otomatis oleh fetch saat menggunakan FormData
        },
        body: submitData,
      });

      const result = await response.json();

      if (response.ok) {
        // Navigate to success page
        navigation.navigate("ReportSuccess", {
          type: "found",
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
        <Text style={styles.headerTitle}>LAPORKAN TEMUAN</Text>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <View style={styles.infoIcon}>
          <Ionicons name="information-circle" size={20} color="#3b82f6" />
        </View>
        <Text style={styles.infoText}>
          Silakan isi detail barang yang kamu temukan dengan lengkap untuk
          memudahkan proses pengembalian.
        </Text>
      </View>

      {/* Form */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Upload Photos */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Unggah Foto Barang <Text style={styles.required}>*</Text> (minimal 1
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
                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}

            {/* Add Image Button */}
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

        {/* Item Name */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Nama Barang <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: Dompet Kulit Coklat"
            value={formData.itemName}
            onChangeText={(text) => handleInputChange("itemName", text)}
          />
        </View>

        {/* Item Description */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Deskripsi Detail Barang <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Jelaskan detail barang seperti warna, merek, kondisi, isi di dalamnya (jika relevan), dll."
            multiline
            numberOfLines={4}
            value={formData.description}
            onChangeText={(text) => handleInputChange("description", text)}
          />
        </View>

        {/* Location Found */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Lokasi Ditemukan <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: Gedung FMIPA Lantai 2"
            value={formData.locationFound}
            onChangeText={(text) => handleInputChange("locationFound", text)}
          />
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Kategori <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.pickerContainer}>
            {/* Implementasi Picker yang sebenarnya mungkin memerlukan library terpisah */}
            <TextInput
              style={styles.input}
              placeholder="Pilih kategori barang"
              value={formData.category}
              editable={false} // Atau gunakan komponen Picker
            />
            <Ionicons
              name="chevron-down"
              size={20}
              color="#6b7280"
              style={styles.pickerIcon}
            />
            {/* <Picker
              selectedValue={formData.category}
              onValueChange={(itemValue) => handleInputChange('category', itemValue)}
              style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0 }}
            >
              <Picker.Item label="Pilih kategori barang" value="" />
              {categories.map(cat => <Picker.Item key={cat} label={cat} value={cat} />)}
            </Picker> */}
          </View>
        </View>

        {/* Found Date & Time */}
        <View
          style={[
            styles.section,
            { flexDirection: "row", justifyContent: "space-between" },
          ]}
        >
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.label}>
              Tanggal Ditemukan <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.dateInputContainer}
              onPress={() => setShowDatePicker(true)}
            >
              <TextInput
                style={styles.input}
                value={formData.foundDate}
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
            <Text style={styles.label}>
              Waktu Ditemukan <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity style={styles.dateInputContainer}>
              <TextInput
                style={styles.input}
                value={formData.foundTime}
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

        {/* Submit Button */}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    backgroundColor: "#3b82f6",
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    elevation: 4,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  infoIcon: {
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: "#1e3a8a",
  },
  content: {
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  required: {
    color: "#ef4444",
  },
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
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  imageContainer: {
    position: "relative",
    marginRight: 10,
    marginBottom: 10,
  },
  image: {
    width: (width - 32 - 40) / 4, // Adjust size based on container padding and margins
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
    width: (width - 32) / 1.5,
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
  addImageSubText: {
    color: "#9ca3af",
    fontSize: 12,
  },
  pickerContainer: {
    justifyContent: "center",
  },
  pickerIcon: {
    position: "absolute",
    right: 12,
  },
  dateInputContainer: {
    justifyContent: "center",
  },
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
  submitButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
});
