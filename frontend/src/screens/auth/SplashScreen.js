// src/screens/auth/SplashScreen.js
// File: src/screens/auth/SplashScreen.js

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  StatusBar,
} from "react-native";
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

    // Tagline animation with delay
    setTimeout(() => {
      Animated.sequence([
        Animated.timing(taglineAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        // Subtle pulse animation for tagline
        Animated.loop(
          Animated.sequence([
            Animated.timing(taglineAnim, {
              toValue: 0.9,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(taglineAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
          { iterations: 2 }
        ),
      ]).start();
    }, 1200);
  };

  const logoRotation = logoRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const magnifyScale = magnifyAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1.2, 1],
  });

  const magnifyRotation = magnifyAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "15deg"],
  });

  const backgroundOpacity = backgroundAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#3478f6" />
      <Animated.View style={[styles.container, { opacity: backgroundOpacity }]}>
        {/* Animated Background Overlay */}
        <Animated.View style={styles.backgroundOverlay} />

        {/* Main Content */}
        <View style={styles.content}>
          {/* Logo Container */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: fadeAnim,
                transform: [
                  { scale: scaleAnim },
                  { translateY: slideAnim },
                  { rotate: logoRotation },
                ],
              },
            ]}
          >
            {/* Main Logo Circle */}
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>UNYLost</Text>

              {/* Animated Magnifying Glass */}
              <Animated.View
                style={[
                  styles.magnifyingGlass,
                  {
                    transform: [
                      { scale: magnifyScale },
                      { rotate: magnifyRotation },
                    ],
                  },
                ]}
              >
                <View style={styles.magnifyLens} />
                <View style={styles.magnifyHandle} />
              </Animated.View>
            </View>
          </Animated.View>

          {/* Tagline */}
          <Animated.View
            style={[
              styles.taglineContainer,
              {
                opacity: taglineAnim,
                transform: [{ scale: taglineAnim }],
              },
            ]}
          >
            <Text style={styles.tagline}>
              "Find the Lost, Return the Found"
            </Text>
          </Animated.View>
        </View>

        {/* Floating Particles Animation */}
        <View style={styles.particlesContainer}>
          {[...Array(6)].map((_, index) => (
            <FloatingParticle key={index} delay={index * 200} />
          ))}
        </View>
      </Animated.View>
    </>
  );
}

// Floating Particle Component
const FloatingParticle = ({ delay }) => {
  const particleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setTimeout(() => {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(particleAnim, {
              toValue: 1,
              duration: 3000,
              useNativeDriver: true,
            }),
            Animated.timing(particleAnim, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 0.6,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0,
              duration: 1500,
              useNativeDriver: true,
            }),
          ]),
        ]),
        { iterations: -1 }
      ).start();
    }, delay);
  }, [delay]);

  const translateY = particleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [height, -100],
  });

  const translateX = particleAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 30, -20],
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          opacity: opacityAnim,
          transform: [{ translateY }, { translateX }],
        },
        {
          left: Math.random() * width,
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#3478f6",
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(52, 120, 246, 0.1)",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    position: "relative",
  },
  logoText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#3478f6",
    textAlign: "center",
    letterSpacing: 1,
  },
  magnifyingGlass: {
    position: "absolute",
    bottom: 20,
    right: 25,
  },
  magnifyLens: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    borderWidth: 4,
    borderColor: "#3478f6",
    backgroundColor: "transparent",
  },
  magnifyHandle: {
    position: "absolute",
    bottom: -8,
    right: -8,
    width: 20,
    height: 4,
    backgroundColor: "#3478f6",
    borderRadius: 2,
    transform: [{ rotate: "45deg" }],
  },
  taglineContainer: {
    alignItems: "center",
  },
  tagline: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    fontStyle: "italic",
    textAlign: "center",
    letterSpacing: 0.5,
    lineHeight: 24,
  },
  particlesContainer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
  },
  particle: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
});
