import React, { useState, useRef, useEffect } from "react";
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
import { useNavigation, useRoute } from "@react-navigation/native";
import { authAPI } from "../../services/api";

const { width, height } = Dimensions.get("window");

export default function VerificationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { email, userData } = route.params || {};

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");

  const inputRefs = useRef([]);

  useEffect(() => {
    if (!email) {
      Alert.alert("Error", "Email tidak ditemukan", [
        { text: "OK", onPress: () => navigation.navigate("Register") },
      ]);
    }
  }, [email]);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleCodeChange = (text, index) => {
    if (text.length > 1) {
      // If pasted multiple characters, distribute them
      const chars = text.split("").slice(0, 6);
      const newCode = [...code];
      chars.forEach((char, i) => {
        if (index + i < 6) {
          newCode[index + i] = char;
        }
      });
      setCode(newCode);

      // Focus on the next empty input or the last one
      const nextIndex = Math.min(index + chars.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
      // Single character input
      const newCode = [...code];
      newCode[index] = text;
      setCode(newCode);

      // Auto-focus next input
      if (text && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }

    // Clear error when user starts typing
    if (error) {
      setError("");
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const verificationCode = code.join("");

    if (verificationCode.length !== 6) {
      setError("Kode verifikasi harus 6 digit");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      console.log("📧 Verifying email with code:", verificationCode);

      const response = await authAPI.verifyEmail(email, verificationCode);

      if (response.success) {
        Alert.alert(
          "Verifikasi Berhasil!",
          "Email Anda telah terverifikasi. Silakan login untuk melanjutkan.",
          [
            {
              text: "Login Sekarang",
              onPress: () => {
                // Use navigate instead of reset since we're in Auth stack
                navigation.navigate("Login");
              },
            },
          ]
        );
      } else {
        setError(response.message || "Kode verifikasi tidak valid");
      }
    } catch (error) {
      console.error("Verification error:", error);
      setError("Terjadi kesalahan saat verifikasi");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;

    setIsResending(true);
    setError("");

    try {
      console.log("📧 Resending verification code to:", email);

      // For now, we'll simulate resending
      // In production, you might have a separate resend endpoint
      setTimeout(() => {
        setIsResending(false);
        setCountdown(60); // 60 seconds cooldown
        Alert.alert(
          "Berhasil",
          "Kode verifikasi baru telah dikirim ke email Anda"
        );
      }, 2000);
    } catch (error) {
      console.error("Resend error:", error);
      setError("Gagal mengirim ulang kode");
      setIsResending(false);
    }
  };

  const clearCode = () => {
    setCode(["", "", "", "", "", ""]);
    setError("");
    inputRefs.current[0]?.focus();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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

        {/* Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconWrapper}>
            <Ionicons name="mail-outline" size={48} color="#3478f6" />
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>Verifikasi Email</Text>
          <Text style={styles.subtitle}>
            Kode verifikasi telah dikirim ke{"\n"}
            <Text style={styles.emailText}>{email}</Text>
          </Text>

          {/* Code Input */}
          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={[
                  styles.codeInput,
                  digit && styles.codeInputFilled,
                  error && styles.codeInputError,
                ]}
                value={digit}
                onChangeText={(text) => handleCodeChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="numeric"
                maxLength={1}
                selectTextOnFocus
                textAlign="center"
              />
            ))}
          </View>

          {/* Error Message */}
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Verify Button */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (isLoading || code.join("").length !== 6) &&
                styles.verifyButtonDisabled,
            ]}
            onPress={handleVerify}
            disabled={isLoading || code.join("").length !== 6}
          >
            <Text style={styles.verifyButtonText}>
              {isLoading ? "Memverifikasi..." : "Verifikasi"}
            </Text>
          </TouchableOpacity>

          {/* Helper Text */}
          <Text style={styles.helperText}>
            Masukkan 6 digit kode yang dikirim ke email Anda
          </Text>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            {/* Clear Code */}
            <TouchableOpacity style={styles.actionButton} onPress={clearCode}>
              <Ionicons name="refresh-outline" size={16} color="#6b7280" />
              <Text style={styles.actionText}>Hapus Kode</Text>
            </TouchableOpacity>

            {/* Resend Code */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                (countdown > 0 || isResending) && styles.actionButtonDisabled,
              ]}
              onPress={handleResendCode}
              disabled={countdown > 0 || isResending}
            >
              <Ionicons
                name="send-outline"
                size={16}
                color={countdown > 0 ? "#9ca3af" : "#6b7280"}
              />
              <Text
                style={[
                  styles.actionText,
                  (countdown > 0 || isResending) && styles.actionTextDisabled,
                ]}
              >
                {isResending
                  ? "Mengirim..."
                  : countdown > 0
                  ? `Kirim ulang (${formatTime(countdown)})`
                  : "Kirim Ulang Kode"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Additional Info */}
          <View style={styles.infoContainer}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color="#6b7280"
            />
            <Text style={styles.infoText}>
              Tidak menerima kode? Periksa folder spam atau{"\n"}
              pastikan email yang dimasukkan benar
            </Text>
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
    marginBottom: 40,
  },
  backButton: {
    padding: 8,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    backgroundColor: "#eff6ff",
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
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
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1f2937",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  emailText: {
    fontWeight: "600",
    color: "#3478f6",
  },
  codeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    fontSize: 20,
    fontWeight: "600",
    color: "#1f2937",
    backgroundColor: "#f9fafb",
  },
  codeInputFilled: {
    borderColor: "#3478f6",
    backgroundColor: "#eff6ff",
  },
  codeInputError: {
    borderColor: "#ef4444",
    backgroundColor: "#fef2f2",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 14,
    marginLeft: 6,
    flex: 1,
  },
  verifyButton: {
    backgroundColor: "#3478f6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  verifyButtonDisabled: {
    backgroundColor: "#9ca3af",
  },
  verifyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  helperText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f9fafb",
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionText: {
    fontSize: 14,
    color: "#6b7280",
    marginLeft: 6,
  },
  actionTextDisabled: {
    color: "#9ca3af",
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f0f9ff",
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#3478f6",
  },
  infoText: {
    fontSize: 12,
    color: "#6b7280",
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
});
