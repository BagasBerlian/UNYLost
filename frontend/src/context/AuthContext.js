import React, { createContext, useContext, useReducer, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authAPI } from "../services/api";

const AuthContext = createContext();

const initialState = {
  user: null,
  token: null,
  isLoading: false,
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
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const token = await AsyncStorage.getItem("userToken");
      const userData = await AsyncStorage.getItem("userData");

      if (token && userData) {
        dispatch({
          type: "LOGIN_SUCCESS",
          payload: {
            token,
            user: JSON.parse(userData),
          },
        });
      }
    } catch (error) {
      console.log("Auth check error:", error);
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
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
        return { success: false, message: response.message };
      }
    } catch (error) {
      console.log("Login error:", error);
      return { success: false, message: "Terjadi kesalahan saat login" };
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const register = async (userData) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const response = await authAPI.register(userData);
      return response;
    } catch (error) {
      console.log("Register error:", error);
      return { success: false, message: "Terjadi kesalahan saat registrasi" };
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const verifyEmail = async (email, code) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const response = await authAPI.verifyEmail(email, code);
      return response;
    } catch (error) {
      console.log("Verification error:", error);
      return { success: false, message: "Terjadi kesalahan saat verifikasi" };
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem("userToken");
      await AsyncStorage.removeItem("userData");
      dispatch({ type: "LOGOUT" });
    } catch (error) {
      console.log("Logout error:", error);
    }
  };

  const value = {
    ...state,
    login,
    register,
    verifyEmail,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
