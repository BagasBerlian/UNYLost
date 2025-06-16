// File: frontend/src/context/AuthContext.js - FINAL STABLE VERSION
import React, { createContext, useContext, useReducer, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authAPI } from "../services/api";

const AuthContext = createContext();

const initialState = {
  user: null,
  token: null,
  isLoading: true, // Start with loading true
  isAuthenticated: false,
};

function authReducer(state, action) {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "LOGIN_SUCCESS":
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case "LOGOUT":
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case "SET_USER":
      return {
        ...state,
        user: action.payload,
      };
    case "INIT_COMPLETE":
      return {
        ...state,
        isLoading: false,
      };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check auth on mount only once
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      console.log("🔍 Checking authentication status...");

      const token = await AsyncStorage.getItem("userToken");
      const userData = await AsyncStorage.getItem("userData");

      console.log("🔑 Token found:", !!token);
      console.log("👤 User data found:", !!userData);

      if (token && userData) {
        try {
          const user = JSON.parse(userData);
          console.log("✅ User authenticated:", user.email);

          dispatch({
            type: "LOGIN_SUCCESS",
            payload: { token, user },
          });

          return;
        } catch (parseError) {
          console.error("❌ Error parsing user data:", parseError);
          // Clear corrupted data
          await AsyncStorage.removeItem("userToken");
          await AsyncStorage.removeItem("userData");
        }
      }

      console.log("❌ No valid authentication found");
    } catch (error) {
      console.error("❌ Auth check error:", error);
    }

    // Always complete initialization
    dispatch({ type: "INIT_COMPLETE" });
  };

  const login = async (email, password) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const response = await authAPI.login(email, password);

      if (response.success) {
        await AsyncStorage.setItem("userToken", response.data.token);
        await AsyncStorage.setItem(
          "userData",
          JSON.stringify(response.data.user)
        );

        dispatch({
          type: "LOGIN_SUCCESS",
          payload: response.data,
        });

        return { success: true };
      } else {
        dispatch({ type: "SET_LOADING", payload: false });
        return { success: false, message: response.message };
      }
    } catch (error) {
      console.log("Login error:", error);
      dispatch({ type: "SET_LOADING", payload: false });
      return { success: false, message: "Terjadi kesalahan saat login" };
    }
  };

  const register = async (userData) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const response = await authAPI.register(userData);

      dispatch({ type: "SET_LOADING", payload: false });

      if (response.success) {
        return { success: true, data: response.data };
      } else {
        return { success: false, message: response.message };
      }
    } catch (error) {
      console.log("Register error:", error);
      dispatch({ type: "SET_LOADING", payload: false });
      return { success: false, message: "Terjadi kesalahan saat registrasi" };
    }
  };

  const logout = async () => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });

      // Clear AsyncStorage
      await AsyncStorage.removeItem("userToken");
      await AsyncStorage.removeItem("userData");

      dispatch({ type: "LOGOUT" });

      return { success: true };
    } catch (error) {
      console.log("Logout error:", error);
      dispatch({ type: "SET_LOADING", payload: false });
      return { success: false, message: "Terjadi kesalahan saat logout" };
    }
  };

  const refreshUser = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) return { success: false };

      const response = await authAPI.getProfile(token);
      if (response.success) {
        await AsyncStorage.setItem(
          "userData",
          JSON.stringify(response.data.user)
        );
        dispatch({ type: "SET_USER", payload: response.data.user });
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      console.log("Refresh user error:", error);
      return { success: false };
    }
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
