import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Dimensions, Animated } from "react-native";
import { useNavigation } from "@react-navigation/native";

const { width, height } = Dimensions.get("window");

export default function SplashScreen() {
  const navigation = useNavigation();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoRotateAnim = useRef(new Animated.Value(0)).current;
  const magnifyAnim = useRef(new Animated.Value(0)).current;
  const taglineAnim = useRef(new Animated.Value(0)).current;
  const backgroundAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    startAnimations();

    // Navigate to login after animations complete
    const timer = setTimeout(() => {
      // Use replace to prevent going back to splash
      navigation.replace("Login");
    }, 3500);

    return () => clearTimeout(timer);
  }, [navigation]);

  const startAnimations = () => {
    // Background gradient animation
    Animated.timing(backgroundAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: false,
    }).start();

    // Main logo animation sequence
    Animated.sequence([
      // First: Scale and fade in the main logo
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),

      // Second: Rotate logo with bounce
      Animated.spring(logoRotateAnim, {
        toValue: 1,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),

      // Third: Animate magnifying glass
      Animated.spring(magnifyAnim, {
        toValue: 1,
        tension: 60,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    // Animate tagline with delay
    setTimeout(() => {
      Animated.timing(taglineAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }, 1500);
  };

  const logoRotate = logoRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const magnifyScale = magnifyAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1.2, 1],
  });

  const backgroundOpacity = backgroundAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  return (
    <Animated.View style={[styles.container, { opacity: backgroundOpacity }]}>
      {/* Background Gradient Effect */}
      <View style={styles.backgroundGradient} />

      {/* Logo Container */}
      <View style={styles.logoContainer}>
        <Animated.View
          style={[
            styles.logoWrapper,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { translateY: slideAnim },
                { rotate: logoRotate },
              ],
            },
          ]}
        >
          {/* Main Logo Circle */}
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>UNY</Text>
          </View>

          {/* Magnifying Glass Animation */}
          <Animated.View
            style={[
              styles.magnifyingGlass,
              {
                transform: [{ scale: magnifyScale }],
              },
            ]}
          >
            <View style={styles.magnifyCircle} />
            <View style={styles.magnifyHandle} />
          </Animated.View>
        </Animated.View>

        {/* App Name */}
        <Animated.Text
          style={[
            styles.appName,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          Lost
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text
          style={[
            styles.tagline,
            {
              opacity: taglineAnim,
            },
          ]}
        >
          Find the Lost, Return the Found
        </Animated.Text>
      </View>

      {/* Bottom Text */}
      <Animated.View
        style={[
          styles.bottomContainer,
          {
            opacity: taglineAnim,
          },
        ]}
      >
        <Text style={styles.versionText}>v1.0.0</Text>
        <Text style={styles.universityText}>Universitas Negeri Yogyakarta</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#3478f6",
    justifyContent: "center",
    alignItems: "center",
  },
  backgroundGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#3478f6",
    opacity: 0.9,
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  logoText: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#3478f6",
    textAlign: "center",
  },
  magnifyingGlass: {
    position: "absolute",
    top: -10,
    right: -10,
  },
  magnifyCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: "#fff",
    backgroundColor: "transparent",
  },
  magnifyHandle: {
    position: "absolute",
    bottom: -8,
    right: -8,
    width: 3,
    height: 12,
    backgroundColor: "#fff",
    borderRadius: 2,
    transform: [{ rotate: "45deg" }],
  },
  appName: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 12,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  tagline: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
    fontStyle: "italic",
    opacity: 0.9,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bottomContainer: {
    position: "absolute",
    bottom: 60,
    alignItems: "center",
  },
  versionText: {
    fontSize: 12,
    color: "#fff",
    opacity: 0.7,
    marginBottom: 4,
  },
  universityText: {
    fontSize: 12,
    color: "#fff",
    opacity: 0.7,
    textAlign: "center",
  },
});
