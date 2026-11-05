/**
 * Splash Screen — Brand entrance
 */
import React, { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";

export function SplashScreen() {
  const navigation = useNavigation();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace("Login");
    }, 2500);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>TT</Text>
      </View>
      <Text style={styles.title}>TruTicket</Text>
      <Text style={styles.subtitle}>Fair access. Genuine tickets. Controlled resale.</Text>
      <ActivityIndicator size="large" color="#2563EB" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090D",
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "bold",
  },
  title: {
    color: "#F5F5F7",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    color: "#A1A1AA",
    fontSize: 14,
    marginBottom: 32,
  },
  spinner: {
    marginTop: 20,
  },
});