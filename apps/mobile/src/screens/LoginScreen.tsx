/**
 * Login / Signup Screen
 */
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const navigation = useNavigation();

  const handleAuth = async () => {
    try {
      const action = isSignup ? "signup" : "signin";
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/auth/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role: "attendee" }),
      });
      const data = await response.json();
      if (response.ok) {
        navigation.replace("Explore");
      } else {
        Alert.alert("Error", data.error || "Authentication failed");
      }
    } catch (e) {
      Alert.alert("Error", "Network error");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{isSignup ? "Create Account" : "Welcome Back"}</Text>
        <Text style={styles.subtitle}>Join TruTicket for fair ticketing</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleAuth}>
          <Text style={styles.buttonText}>{isSignup ? "Sign Up" : "Sign In"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toggle}
          onPress={() => setIsSignup(!isSignup)}
        >
          <Text style={styles.toggleText}>
            {isSignup ? "Already have an account?" : "Don't have an account?"}
            {" "}
            <Text style={styles.toggleLink}>{isSignup ? "Sign In" : "Sign Up"}</Text>
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.demoBtn} onPress={() => navigation.replace("Explore")}>
        <Text style={styles.demoBtnText}>Continue as Demo</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090D",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#12121A",
    borderRadius: 16,
    padding: 32,
  },
  title: {
    color: "#F5F5F7",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    color: "#A1A1AA",
    fontSize: 14,
    marginBottom: 24,
  },
  input: {
    backgroundColor: "#1A1A25",
    color: "#F5F5F7",
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 14,
  },
  button: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  toggle: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 24,
  },
  toggleText: {
    color: "#A1A1AA",
    fontSize: 14,
  },
  toggleLink: {
    color: "#2563EB",
    fontWeight: "600",
  },
  demoBtn: {
    marginTop: 16,
  },
  demoBtnText: {
    color: "#6B7280",
    fontSize: 14,
  },
});