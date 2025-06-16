const BASE_URL = "http://localhost:5000/api"; // Ganti dengan URL backend Anda

class APIService {
  async request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;

    const config = {
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Network error");
      }

      return data;
    } catch (error) {
      console.error("API Request Error:", error);
      throw error;
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
}

const apiService = new APIService();

// Auth API
export const authAPI = {
  async register(userData) {
    try {
      const response = await apiService.post("/auth/register", userData);
      return response;
    } catch (error) {
      return {
        success: false,
        message: error.message || "Registrasi gagal",
      };
    }
  },

  async login(email, password) {
    try {
      const response = await apiService.post("/auth/login", {
        email,
        password,
      });
      return response;
    } catch (error) {
      return {
        success: false,
        message: error.message || "Login gagal",
      };
    }
  },

  async verifyEmail(email, code) {
    try {
      const response = await apiService.post("/auth/verify-email", {
        email,
        code,
      });
      return response;
    } catch (error) {
      return {
        success: false,
        message: error.message || "Verifikasi gagal",
      };
    }
  },

  async verifyWhatsApp(whatsappNumber, code) {
    try {
      const response = await apiService.post("/auth/verify-whatsapp", {
        whatsappNumber,
        code,
      });
      return response;
    } catch (error) {
      return {
        success: false,
        message: error.message || "Verifikasi WhatsApp gagal",
      };
    }
  },

  async getProfile(token) {
    try {
      const response = await apiService.get("/auth/me", token);
      return response;
    } catch (error) {
      return {
        success: false,
        message: error.message || "Gagal mengambil profil",
      };
    }
  },
};

export default apiService;
