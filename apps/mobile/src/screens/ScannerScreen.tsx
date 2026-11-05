/**
 * Gate Scanner Screen — Camera viewfinder + scan result
 */
import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Camera } from "expo-camera";

export function ScannerScreen() {
  const [permission, setPermission] = useState<? boolean>(null);
  const [scanned, setScanned] = useState(false);

  const handleCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setPermission(status === "granted");
  };

  const handleBarCodeScanned = (data: string) => {
    setScanned(true);
    Alert.alert("Scan Result", `Ticket: ${data}\nStatus: VALID (Demo)`);
  };

  if (permission === null) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.button} onPress={handleCameraPermission}>
          <Text style={styles.buttonText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permission) {
    return <View style={styles.container}><Text style={styles.text}>Camera access required</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Camera style={styles.camera} onBarCodeScanned={handleBarCodeScanned}>
        <View style={styles.overlay}>
          <View style={styles.scanLine} />
          <Text style={styles.instruction}>Position QR code inside the frame</Text>
        </View>
        {scanned && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultText}>SCAN COMPLETE</Text>
            <TouchableOpacity style={styles.resetBtn} onPress={() => setScanned(false)}>
              <Text style={styles.resetText}>Scan Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </Camera>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  scanLine: {
    width: 250,
    height: 4,
    backgroundColor: "#34D399",
    borderRadius: 2,
    marginBottom: 24,
  },
  instruction: {
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "center",
  },
  resultContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  resultText: {
    color: "#34D399",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  resetBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  resetText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#2563EB",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    margin: 24,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  text: {
    color: "#FFFFFF",
    textAlign: "center",
    margin: 24,
  },
});