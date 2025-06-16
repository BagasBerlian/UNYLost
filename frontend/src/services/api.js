// File: frontend/src/services/api.js - FIXED HEADERS AND BODY PARSING
import API_CONFIG from "../config/api";

class APIService {
  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    console.log(`🌐 API Base URL: ${this.baseURL}`);
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    // Ensure proper headers for JSON requests
    const defaultHeaders = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      console.log(`🌐 API Request: ${config.method || "GET"} ${url}`);
      console.log(`📤 Request headers:`, config.headers);

      if (config.body) {
        console.log(`📤 Request body (string):`, config.body);
        try {
          const parsedBody = JSON.parse(config.body);
          console.log(`📤 Request data (parsed):`, parsedBody);
        } catch (e) {
          console.log(`📤 Request body (raw):`, config.body);
        }
      } else {
        console.log(`📤 Request data: No body`);
      }

      const response = await fetch(url, config);

      console.log(`📥 Response status: ${response.status}`);
      console.log(
        `📥 Response headers:`,
        Object.fromEntries(response.headers.entries())
      );

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.log(`📥 Response text:`, text);
        throw new Error(`Server returned non-JSON response: ${text}`);
      }

      console.log(`📥 Response data:`, data);

      if (!response.ok) {
        throw new Error(
          data.message ||
            `HTTP Error: ${response.status} ${response.statusText}`
        );
      }

      return data;
    } catch (error) {
      console.error(`❌ API Error for ${url}:`, error);

      if (
        error.name === "TypeError" &&
        error.message.includes("Network request failed")
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
      console.log("📝 Registration data being sent:", userData);

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
      const loginData = { email, password };
      console.log("🔐 Login data being sent:", loginData);

      const response = await apiService.post("/auth/login", loginData);
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
      const verifyData = { email, code };
      console.log("📧 Email verification data being sent:", verifyData);

      const response = await apiService.post("/auth/verify-email", verifyData);
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

  async verifyWhatsapp(phone) {
    try {
      console.log("📱 Verifying WhatsApp:", phone);

      // Debug: log the exact data being sent
      const requestData = { phone };
      console.log("📤 WhatsApp verification request data:", requestData);

      // Use the real endpoint now
      const response = await apiService.post(
        "/auth/verify-whatsapp",
        requestData
      );
      console.log("✅ WhatsApp verification successful");
      return response;
    } catch (error) {
      console.error("❌ WhatsApp verification failed:", error);
      return {
        success: false,
        message:
          error.message ||
          "Verifikasi WhatsApp gagal. Periksa nomor yang dimasukkan.",
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
        message: error.message || "Gagal mengambil profil pengguna.",
      };
    }
  },

  async getDashboard(token) {
    try {
      console.log("📊 Getting dashboard data");
      const response = await apiService.get("/dashboard", token);
      console.log("✅ Dashboard data retrieved successfully");
      return response;
    } catch (error) {
      console.error("❌ Get dashboard failed:", error);
      return {
        success: false,
        message: error.message || "Gagal mengambil data dashboard.",
      };
    }
  },

  async logout(token) {
    try {
      console.log("🚪 Logging out user");
      // For now, just return success since we don't have a logout endpoint yet
      return { success: true, message: "Logout berhasil" };
    } catch (error) {
      console.error("❌ Logout failed:", error);
      return {
        success: false,
        message: error.message || "Logout gagal.",
      };
    }
  },
};

export default apiService;
