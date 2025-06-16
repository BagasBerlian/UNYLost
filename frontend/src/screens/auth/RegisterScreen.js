// File: frontend/src/screens/auth/RegisterScreen.js - FIXED VERSION
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import { authAPI } from "../../services/api";

const { width, height } = Dimensions.get("window");

export default function RegisterScreen() {
  const navigation = useNavigation();
  const { isLoading } = useAuth();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    whatsappNumber: "",
    agreeNotification: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [whatsappVerified, setWhatsappVerified] = useState(false);
  const [isVerifyingWhatsapp, setIsVerifyingWhatsapp] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "Nama depan harus diisi";
    } else if (formData.firstName.length < 2) {
      newErrors.firstName = "Nama depan minimal 2 karakter";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Nama belakang harus diisi";
    } else if (formData.lastName.length < 2) {
      newErrors.lastName = "Nama belakang minimal 2 karakter";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email harus diisi";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Format email tidak valid";
    }

    if (!formData.password.trim()) {
      newErrors.password = "Password harus diisi";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password minimal 6 karakter";
    }

    if (!formData.whatsappNumber.trim()) {
      newErrors.whatsappNumber = "Nomor WhatsApp harus diisi";
    } else if (
      !/^(\+62|62|0)8[1-9][0-9]{6,11}$/.test(formData.whatsappNumber)
    ) {
      newErrors.whatsappNumber = "Format nomor WhatsApp tidak valid";
    }

    if (!whatsappVerified) {
      newErrors.whatsappNumber = "Nomor WhatsApp harus diverifikasi";
    }

    if (!formData.agreeNotification) {
      newErrors.agreeNotification =
        "Harus menyetujui untuk menerima notifikasi";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleVerifyWhatsapp = async () => {
    if (!formData.whatsappNumber.trim()) {
      setErrors({ ...errors, whatsappNumber: "Nomor WhatsApp harus diisi" });
      return;
    }

    if (!/^(\+62|62|0)8[1-9][0-9]{6,11}$/.test(formData.whatsappNumber)) {
      setErrors({
        ...errors,
        whatsappNumber: "Format nomor WhatsApp tidak valid",
      });
      return;
    }

    setIsVerifyingWhatsapp(true);
    try {
      console.log("🔍 Verifying WhatsApp:", formData.whatsappNumber);

      const response = await authAPI.verifyWhatsapp(formData.whatsappNumber);

      if (response.success) {
        setWhatsappVerified(true);
        setErrors({ ...errors, whatsappNumber: null });
        Alert.alert("Berhasil", "Nomor WhatsApp terverifikasi!");
      } else {
        Alert.alert("Gagal", response.message || "Verifikasi WhatsApp gagal");
      }
    } catch (error) {
      console.error("WhatsApp verification error:", error);
      Alert.alert("Error", "Gagal memverifikasi nomor WhatsApp");
    } finally {
      setIsVerifyingWhatsapp(false);
    }
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    try {
      console.log("📝 Starting registration with data:", {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        whatsappNumber: formData.whatsappNumber,
        agreeNotification: formData.agreeNotification,
      });

      const response = await authAPI.register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        whatsappNumber: formData.whatsappNumber,
        agreeNotification: formData.agreeNotification,
      });

      if (response.success) {
        Alert.alert(
          "Registrasi Berhasil!",
          "Kode verifikasi telah dikirim ke email Anda. Silakan cek inbox atau spam folder.",
          [
            {
              text: "OK",
              onPress: () => {
                navigation.navigate("Verification", {
                  email: formData.email,
                  userData: response.data.user,
                });
              },
            },
          ]
        );
      } else {
        Alert.alert("Registrasi Gagal", response.message);
      }
    } catch (error) {
      console.error("Registration error:", error);
      Alert.alert("Error", "Terjadi kesalahan saat registrasi");
    }
  };

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: null });
    }

    // Reset WhatsApp verification if number changes
    if (field === "whatsappNumber" && whatsappVerified) {
      setWhatsappVerified(false);
    }
  };

  const toggleAgreeNotification = () => {
    setFormData({
      ...formData,
      agreeNotification: !formData.agreeNotification,
    });
    if (errors.agreeNotification) {
      setErrors({ ...errors, agreeNotification: null });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          <Text style={styles.title}>Buat Akun</Text>
          <Text style={styles.subtitle}>
            Daftar untuk mulai menggunakan UNYLost
          </Text>

          {/* Name Fields */}
          <View style={styles.nameContainer}>
            <View style={[styles.nameInputContainer, { marginRight: 10 }]}>
              <Text style={styles.inputLabel}>Nama Depan</Text>
              <View
                style={[
                  styles.inputWrapper,
                  errors.firstName && styles.inputError,
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={20}
                  color="#9CA3AF"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="Nama depan"
                  value={formData.firstName}
                  onChangeText={(text) => handleInputChange("firstName", text)}
                  autoCapitalize="words"
                />
              </View>
              {errors.firstName && (
                <Text style={styles.errorText}>{errors.firstName}</Text>
              )}
            </View>

            <View style={[styles.nameInputContainer, { marginLeft: 10 }]}>
              <Text style={styles.inputLabel}>Nama Belakang</Text>
              <View
                style={[
                  styles.inputWrapper,
                  errors.lastName && styles.inputError,
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={20}
                  color="#9CA3AF"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="Nama belakang"
                  value={formData.lastName}
                  onChangeText={(text) => handleInputChange("lastName", text)}
                  autoCapitalize="words"
                />
              </View>
              {errors.lastName && (
                <Text style={styles.errorText}>{errors.lastName}</Text>
              )}
            </View>
          </View>

          {/* Email Field */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <View
              style={[styles.inputWrapper, errors.email && styles.inputError]}
            >
              <Ionicons
                name="mail-outline"
                size={20}
                color="#9CA3AF"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder="email@uny.ac.id"
                value={formData.email}
                onChangeText={(text) => handleInputChange("email", text)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}
          </View>

          {/* Password Field */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <View
              style={[
                styles.inputWrapper,
                errors.password && styles.inputError,
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#9CA3AF"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder="Minimal 6 karakter"
                value={formData.password}
                onChangeText={(text) => handleInputChange("password", text)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#9CA3AF"
                />
              </TouchableOpacity>
            </View>
            {errors.password && (
              <Text style={styles.errorText}>{errors.password}</Text>
            )}
          </View>

          {/* WhatsApp Field */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Nomor WhatsApp</Text>
            <View
              style={[
                styles.inputWrapper,
                errors.whatsappNumber && styles.inputError,
              ]}
            >
              <Ionicons
                name="logo-whatsapp"
                size={20}
                color="#9CA3AF"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder="+6281234567890"
                value={formData.whatsappNumber}
                onChangeText={(text) =>
                  handleInputChange("whatsappNumber", text)
                }
                keyboardType="phone-pad"
              />
              {whatsappVerified ? (
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              ) : (
                <TouchableOpacity
                  style={[
                    styles.verifyButton,
                    isVerifyingWhatsapp && styles.verifyButtonDisabled,
                  ]}
                  onPress={handleVerifyWhatsapp}
                  disabled={isVerifyingWhatsapp}
                >
                  <Text style={styles.verifyButtonText}>
                    {isVerifyingWhatsapp ? "..." : "Verifikasi"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {errors.whatsappNumber && (
              <Text style={styles.errorText}>{errors.whatsappNumber}</Text>
            )}
          </View>

          {/* Agreement Checkbox */}
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={toggleAgreeNotification}
            disabled={!whatsappVerified}
          >
            <View
              style={[
                styles.checkbox,
                formData.agreeNotification && styles.checkboxChecked,
                !whatsappVerified && styles.checkboxDisabled,
              ]}
            >
              {formData.agreeNotification && (
                <Ionicons name="checkmark" size={12} color="#fff" />
              )}
            </View>
            <Text
              style={[
                styles.checkboxText,
                !whatsappVerified && styles.checkboxTextDisabled,
              ]}
            >
              Saya setuju untuk menerima notifikasi melalui WhatsApp dan email
              terkait barang hilang yang saya cari atau temukan.
            </Text>
          </TouchableOpacity>
          {errors.agreeNotification && (
            <Text style={styles.errorText}>{errors.agreeNotification}</Text>
          )}

          {/* Register Button */}
          <TouchableOpacity
            style={[
              styles.registerButton,
              (isLoading || !whatsappVerified || !formData.agreeNotification) &&
                styles.registerButtonDisabled,
            ]}
            onPress={handleRegister}
            disabled={
              isLoading || !whatsappVerified || !formData.agreeNotification
            }
          >
            <Text style={styles.registerButtonText}>
              {isLoading ? "Mendaftarkan..." : "Daftar"}
            </Text>
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Sudah punya akun? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text style={styles.loginLink}>Masuk</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 50,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  formSection: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 32,
  },
  nameContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  nameInputContainer: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputError: {
    borderColor: "#ef4444",
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#1f2937",
  },
  eyeIcon: {
    padding: 4,
  },
  verifyButton: {
    backgroundColor: "#3478f6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  verifyButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  verifyButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#d1d5db",
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#3478f6",
    borderColor: "#3478f6",
  },
  checkboxDisabled: {
    backgroundColor: "#f3f4f6",
    borderColor: "#e5e7eb",
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  checkboxTextDisabled: {
    color: "#9CA3AF",
  },
  registerButton: {
    backgroundColor: "#3478f6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  registerButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  registerButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginText: {
    fontSize: 14,
    color: "#6b7280",
  },
  loginLink: {
    fontSize: 14,
    color: "#3478f6",
    fontWeight: "600",
  },
});
