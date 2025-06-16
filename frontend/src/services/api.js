// src/services/api.js
// File: src/services/api.js

// IMPORTANT: Ganti dengan URL backend Anda
const BASE_URL = "http://localhost:5000/api/"; // Sesuaikan dengan IP Anda
// Untuk testing bisa gunakan: 'https://jsonplaceholder.typicode.com'
// Atau: 'http://localhost:3000/api' jika backend local

class APIService {
  async request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;

    const config = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 10000, // 10 seconds timeout
      ...options,
    };

    try {
      console.log(`🔄 API Request: ${config.method} ${url}`);
      console.log("📤 Request config:", config);

      const response = await fetch(url, config);

      console.log(`📥 Response status: ${response.status}`);
      console.log(`📥 Response headers:`, response.headers);

      const data = await response.json();
      console.log("📦 Response data:", data);

      if (!response.ok) {
        throw new Error(
          data.message || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return data;
    } catch (error) {
      console.error("❌ API Request Error:", error);

      // Handle different types of errors
      if (
        error.name === "TypeError" &&
        error.message === "Network request failed"
      ) {
        throw new Error(
          "Tidak dapat terhubung ke server. Pastikan backend berjalan dan URL sudah benar."
        );
      } else if (
        error.name === "TypeError" &&
        error.message.includes("fetch")
      ) {
        throw new Error(
          "Koneksi internet bermasalah atau server tidak dapat diakses."
        );
      } else {
        throw error;
      }
    }
  }

  async get(endpoint, token = null) {
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return this.request(endpoint, {
      method: "GET",
      headers,
    });
  }

  async post(endpoint, data, token = null) {
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return this.request(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });
  }

  // Test connection method
  async testConnection() {
    try {
      const response = await this.get("/health");
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

const apiService = new APIService();

// Auth API
export const authAPI = {
  // Test backend connection
  async testConnection() {
    try {
      console.log("🔍 Testing backend connection...");
      const result = await apiService.testConnection();
      console.log("🔍 Connection test result:", result);
      return result;
    } catch (error) {
      console.error("🔍 Connection test failed:", error);
      return {
        success: false,
        error: error.message || "Connection test failed",
      };
    }
  },

  async register(userData) {
    try {
      console.log("📝 Registering user:", userData.email);
      const response = await apiService.post("/auth/register", userData);
      console.log("✅ Registration successful");
      return response;
    } catch (error) {
      console.error("❌ Registration failed:", error);
      return {
        success: false,
        message: error.message || "Registrasi gagal. Coba lagi nanti.",
      };
    }
  },

  async login(email, password) {
    try {
      console.log("🔐 Logging in user:", email);
      const response = await apiService.post("/auth/login", {
        email,
        password,
      });
      console.log("✅ Login successful");
      return response;
    } catch (error) {
      console.error("❌ Login failed:", error);
      return {
        success: false,
        message:
          error.message || "Login gagal. Periksa email dan password Anda.",
      };
    }
  },

  async verifyEmail(email, code) {
    try {
      console.log("📧 Verifying email:", email);
      const response = await apiService.post("/auth/verify-email", {
        email,
        code,
      });
      console.log("✅ Email verification successful");
      return response;
    } catch (error) {
      console.error("❌ Email verification failed:", error);
      return {
        success: false,
        message:
          error.message ||
          "Verifikasi email gagal. Periksa kode yang dimasukkan.",
      };
    }
  },

  async verifyWhatsApp(whatsappNumber, code) {
    try {
      console.log("📱 Verifying WhatsApp:", whatsappNumber);
      const response = await apiService.post("/auth/verify-whatsapp", {
        whatsappNumber,
        code,
      });
      console.log("✅ WhatsApp verification successful");
      return response;
    } catch (error) {
      console.error("❌ WhatsApp verification failed:", error);
      return {
        success: false,
        message: error.message || "Verifikasi WhatsApp gagal.",
      };
    }
  },

  async getProfile(token) {
    try {
      console.log("👤 Getting user profile");
      const response = await apiService.get("/auth/me", token);
      console.log("✅ Profile retrieved successfully");
      return response;
    } catch (error) {
      console.error("❌ Get profile failed:", error);
      return {
        success: false,
        message: error.message || "Gagal mengambil profil user.",
      };
    }
  },
};

export default apiService;
