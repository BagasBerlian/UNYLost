import React, { useState, useEffect, useRef } from "react";
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
import { useAuth } from "../../context/AuthContext";

const { width, height } = Dimensions.get("window");

export default function VerificationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { verifyEmail, isLoading } = useAuth();

  const { email, fromRegister } = route.params || {};

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [errors, setErrors] = useState("");

  const inputRefs = useRef([]);

  useEffect(() => {
    startCountdown();
  }, []);

  const startCountdown = () => {
    setCanResend(false);
    setCountdown(60);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCodeChange = (value, index) => {
    // Only allow numbers
    if (!/^[0-9]*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setErrors("");

    // Auto move to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto verify when all 6 digits are entered
    if (
      newCode.every((digit) => digit !== "") &&
      newCode.join("").length === 6
    ) {
      handleVerification(newCode.join(""));
    }
  };

  const handleKeyPress = (e, index) => {
    // Move to previous input on backspace
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerification = async (verificationCode = null) => {
    const finalCode = verificationCode || code.join("");

    if (finalCode.length !== 6) {
      setErrors("Masukkan kode verifikasi 6 digit");
      return;
    }

    const result = await verifyEmail(email, finalCode);

    if (result.success) {
      Alert.alert(
        "Verifikasi Berhasil",
        "Email Anda telah berhasil diverifikasi!",
        [
          {
            text: "OK",
            onPress: () => {
              if (fromRegister) {
                navigation.navigate("Login");
              } else {
                navigation.goBack();
              }
            },
          },
        ]
      );
    } else {
      setErrors(result.message || "Kode verifikasi tidak valid");
      // Clear code on error
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
  };

  const handleResendCode = () => {
    if (!canResend) return;

    // Simulate resend API call
    startCountdown();
    setCode(["", "", "", "", "", ""]);
    setErrors("");
    inputRefs.current[0]?.focus();

    Alert.alert(
      "Kode Dikirim",
      "Kode verifikasi baru telah dikirim ke email Anda"
    );
  };

  const formatEmail = (email) => {
    if (!email) return "";
    const [username, domain] = email.split("@");
    const maskedUsername =
      username.length > 3 ? `${username.substring(0, 3)}***` : `${username}***`;
    return `${maskedUsername}@${domain}`;
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
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Email Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="mail" size={40} color="#3478f6" />
            </View>
          </View>

          {/* Title and Description */}
          <Text style={styles.title}>Verifikasi Akun Anda</Text>
          <Text style={styles.description}>
            Masukkan 6 digit kode yang kami kirimkan ke{"\n"}
            <Text style={styles.emailText}>{formatEmail(email)}</Text>
          </Text>

          {/* Code Input */}
          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={[
                  styles.codeInput,
                  digit ? styles.codeInputFilled : null,
                  errors ? styles.codeInputError : null,
                ]}
                value={digit}
                onChangeText={(value) => handleCodeChange(value, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="numeric"
                maxLength={1}
                textAlign="center"
                selectTextOnFocus
              />
            ))}
          </View>

          {/* Error Message */}
          {errors ? <Text style={styles.errorText}>{errors}</Text> : null}

          {/* Verify Button */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (isLoading || code.join("").length !== 6) &&
                styles.verifyButtonDisabled,
            ]}
            onPress={() => handleVerification()}
            disabled={isLoading || code.join("").length !== 6}
          >
            <Text style={styles.verifyButtonText}>
              {isLoading ? "Memverifikasi..." : "Verifikasi"}
            </Text>
          </TouchableOpacity>

          {/* Resend Section */}
          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Tidak menerima kode? </Text>
            <TouchableOpacity onPress={handleResendCode} disabled={!canResend}>
              <Text
                style={[
                  styles.resendLink,
                  !canResend && styles.resendLinkDisabled,
                ]}
              >
                {canResend ? "Kirim Ulang" : `Kirim Ulang (${countdown}s)`}
              </Text>
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
    marginBottom: 40,
  },
  backButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#e0f2fe",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1f2937",
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 24,
  },
  emailText: {
    color: "#1f2937",
    fontWeight: "600",
  },
  codeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  codeInput: {
    width: 45,
    height: 55,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    marginHorizontal: 4,
  },
  codeInputFilled: {
    borderColor: "#3478f6",
    backgroundColor: "#f0f8ff",
  },
  codeInputError: {
    borderColor: "#ef4444",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  verifyButton: {
    backgroundColor: "#3478f6",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 80,
    alignItems: "center",
    marginBottom: 32,
  },
  verifyButtonDisabled: {
    backgroundColor: "#9ca3af",
  },
  verifyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  resendContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  resendText: {
    color: "#6b7280",
    fontSize: 14,
  },
  resendLink: {
    color: "#3478f6",
    fontSize: 14,
    fontWeight: "600",
  },
  resendLinkDisabled: {
    color: "#9ca3af",
  },
});
