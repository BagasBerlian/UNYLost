// File: frontend/src/screens/ReportFoundScreen.js - Enhanced Version
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

const { width } = Dimensions.get("window");

export default function ReportFoundScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
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

  const categories = [
    "Dompet/Tas",
    "Elektronik",
    "Kendaraan",
    "Aksesoris",
    "Dokumen",
    "Alat Tulis",
    "Pakaian",
    "Lainnya",
  ];

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleImagePicker = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert("Izin dibutuhkan", "Akses ke galeri foto diperlukan!");
        return;
      }

      // Coba multiple selection terlebih dahulu (untuk Web dan device yang support)
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"], // Array of strings, bukan konstanta
          allowsMultipleSelection: true,
          selectionLimit: 5,
          quality: 0.8,
          allowsEditing: false,
        });

        if (!result.canceled && result.assets) {
          const newImages = result.assets.slice(0, 5 - formData.images.length);
          setFormData((prev) => ({
            ...prev,
            images: [...prev.images, ...newImages],
          }));
        }
      } catch (multipleError) {
        // Fallback ke single selection jika multiple tidak didukung
        console.log(
          "Multiple selection not supported, falling back to single selection"
        );

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: false,
          quality: 0.8,
          allowsEditing: true,
          aspect: [4, 3],
        });

        if (!result.canceled && result.assets) {
          const newImage = result.assets[0];
          if (formData.images.length < 5) {
            setFormData((prev) => ({
              ...prev,
              images: [...prev.images, newImage],
            }));
          } else {
            Alert.alert("Maksimal", "Maksimal 5 foto dapat diunggah");
          }
        }
      }
    } catch (error) {
      console.error("Error picking images:", error);
      Alert.alert("Error", "Gagal memilih gambar");
    }
  };

  const removeImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData((prev) => ({ ...prev, foundDate: selectedDate }));
    }
  };

  const handleTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime) {
      setFormData((prev) => ({ ...prev, foundTime: selectedTime }));
    }
  };

  const validateForm = () => {
    const errors = [];

    if (!formData.itemName.trim()) errors.push("Nama barang harus diisi");
    if (!formData.description.trim()) errors.push("Deskripsi harus diisi");
    if (!formData.category) errors.push("Kategori harus dipilih");
    if (!formData.locationFound.trim())
      errors.push("Lokasi ditemukan harus diisi");
    if (formData.images.length === 0)
      errors.push("Minimal 1 foto harus diunggah");

    return errors.length === 0;
  };

  const validateFormWithAlert = () => {
    const errors = [];

    if (!formData.itemName.trim()) errors.push("Nama barang harus diisi");
    if (!formData.description.trim()) errors.push("Deskripsi harus diisi");
    if (!formData.category) errors.push("Kategori harus dipilih");
    if (!formData.locationFound.trim())
      errors.push("Lokasi ditemukan harus diisi");
    if (formData.images.length === 0)
      errors.push("Minimal 1 foto harus diunggah");

    if (errors.length > 0) {
      Alert.alert("Form Tidak Valid", errors.join("\n"));
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateFormWithAlert()) return;

    setLoading(true);
    try {
      const userToken = await AsyncStorage.getItem("userToken");
      if (!userToken) {
        Alert.alert("Error", "Session expired. Please login again.");
        return;
      }

      // Prepare form data
      const formDataToSend = new FormData();

      // Add text fields
      formDataToSend.append("itemName", formData.itemName.trim());
      formDataToSend.append("description", formData.description.trim());
      formDataToSend.append("category", formData.category);
      formDataToSend.append("locationFound", formData.locationFound.trim());
      formDataToSend.append(
        "foundDate",
        formData.foundDate.toISOString().split("T")[0]
      );
      formDataToSend.append(
        "foundTime",
        formData.foundTime.toTimeString().split(" ")[0]
      );

      // Add images
      formData.images.forEach((image, index) => {
        formDataToSend.append("images", {
          uri: image.uri,
          type: "image/jpeg",
          name: `found_item_${index}.jpg`,
        });
      });

      // API call to backend
      const response = await fetch(
        "http://192.168.100.193:5000/api/items/found",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${userToken}`,
            "Content-Type": "multipart/form-data",
          },
          body: formDataToSend,
        }
      );

      const result = await response.json();

      if (response.ok) {
        Alert.alert(
          "Sukses!",
          "Laporan penemuan barang berhasil dikirim. Sistem akan mencari kecocokan dengan laporan kehilangan.",
          [
            {
              text: "OK",
              onPress: () => {
                navigation.navigate("ReportSuccess", {
                  type: "found",
                  reportId: result.data?.id,
                  matchesCount: result.data?.matchesCount || 0,
                });
              },
            },
          ]
        );
      } else {
        throw new Error(result.message || "Gagal mengirim laporan");
      }
    } catch (error) {
      console.error("Submit error:", error);
      Alert.alert(
        "Error",
        error.message || "Gagal mengirim laporan. Silakan coba lagi."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>LAPORKAN PENEMUAN</Text>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <View style={styles.infoIcon}>
              <Ionicons name="information-circle" size={20} color="#3b82f6" />
            </View>
            <Text style={styles.infoText}>
              Silakan isi detail barang yang kamu temukan dengan lengkap agar
              pemilik dapat mengidentifikasi barangnya.
            </Text>
          </View>

          {/* Upload Photos Section */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Unggah Foto Barang <Text style={styles.required}>*</Text>
            </Text>
            <Text style={styles.sublabel}>Minimal 1 foto, maksimal 5 foto</Text>

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
              placeholder="Contoh: Dompet Kulit Coklat"
              value={formData.itemName}
              onChangeText={(text) => handleInputChange("itemName", text)}
              maxLength={100}
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Deskripsi Detail <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Jelaskan detail seperti warna, merek, kondisi, isi (jika ada), ciri khusus, dll."
              multiline
              numberOfLines={4}
              value={formData.description}
              onChangeText={(text) => handleInputChange("description", text)}
              maxLength={500}
            />
            <Text style={styles.charCount}>
              {formData.description.length}/500 karakter
            </Text>
          </View>

          {/* Category */}
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
                style={styles.picker}
              >
                <Picker.Item label="Pilih kategori barang" value="" />
                {categories.map((cat) => (
                  <Picker.Item key={cat} label={cat} value={cat} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Location Found */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Lokasi Ditemukan <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Contoh: Gedung FMIPA Lantai 2, dekat lift"
              value={formData.locationFound}
              onChangeText={(text) => handleInputChange("locationFound", text)}
              maxLength={200}
            />
          </View>

          {/* Date Found */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Tanggal Ditemukan <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateTimeText}>
                {formData.foundDate.toLocaleDateString("id-ID", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
              <Ionicons name="calendar" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Time Found */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Waktu Ditemukan <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={styles.dateTimeText}>
                {formData.foundTime.toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                WIB
              </Text>
              <Ionicons name="time" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              !validateForm() && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={loading || !validateForm()}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="white" />
                <Text style={styles.submitText}>Kirim Laporan</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Date/Time Pickers */}
        {showDatePicker && (
          <DateTimePicker
            value={formData.foundDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={formData.foundTime}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    paddingTop: Platform.OS === "ios" ? 50 : 30,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  backButton: {
    marginRight: 15,
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  infoBanner: {
    flexDirection: "row",
    backgroundColor: "#eff6ff",
    padding: 15,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 25,
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: "#1e40af",
    lineHeight: 20,
  },
  section: {
    marginBottom: 25,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  sublabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 12,
  },
  required: {
    color: "#ef4444",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    backgroundColor: "white",
    color: "#374151",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "right",
    marginTop: 5,
  },
  pickerContainer: {
    position: "relative",
  },
  pickerIcon: {
    position: "absolute",
    right: 15,
    top: 15,
    zIndex: 1,
  },
  picker: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 0,
  },
  dateTimeButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 15,
    backgroundColor: "white",
  },
  dateTimeText: {
    fontSize: 16,
    color: "#374151",
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  imageContainer: {
    position: "relative",
    width: (width - 60) / 3,
    height: (width - 60) / 3,
    marginBottom: 10,
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  removeButton: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "white",
    borderRadius: 10,
  },
  addImageButton: {
    width: (width - 60) / 3,
    height: (width - 60) / 3,
    borderWidth: 2,
    borderColor: "#d1d5db",
    borderStyle: "dashed",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  addImageText: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 5,
  },
  addImageSubText: {
    fontSize: 10,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 2,
  },
  submitButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#10b981",
    paddingVertical: 18,
    borderRadius: 12,
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: "#9ca3af",
  },
  submitText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
