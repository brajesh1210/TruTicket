/**
 * My Tickets Screen — Wallet view
 */
import React from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";

interface Ticket {
  id: string;
  event: string;
  venue: string;
  date: string;
  type: string;
  status: string;
  qrValid: boolean;
}

export function MyTicketsScreen() {
  const tickets: Ticket[] = [
    { id: "1", event: "College Fest 2026", venue: "Jaipur", date: "15 Nov 2026", type: "General", status: "Active", qrValid: true },
    { id: "2", event: "Music Night Live", venue: "Delhi", date: "20 Nov 2026", type: "VIP", status: "Past", qrValid: false },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Tickets</Text>
      </View>

      <FlatList
        data={tickets}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.ticketCard}>
            <View style={styles.ticketInfo}>
              <Text style={styles.ticketEvent}>{item.event}</Text>
              <Text style={styles.ticketVenue}>{item.venue} • {item.date}</Text>
              <Text style={styles.ticketType}>{item.type}</Text>
              <Text style={[styles.ticketStatus, item.qrValid ? styles.statusActive : styles.statusExpired]}>
                {item.status}
              </Text>
            </View>
            <View style={styles.qrPlaceholder}>
              <Text style={styles.qrText}>QR</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090D",
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    color: "#F5F5F7",
    fontSize: 22,
    fontWeight: "bold",
  },
  ticketCard: {
    backgroundColor: "#12121A",
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ticketInfo: {
    flex: 1,
  },
  ticketEvent: {
    color: "#F5F5F7",
    fontSize: 17,
    fontWeight: "600",
  },
  ticketVenue: {
    color: "#A1A1AA",
    fontSize: 14,
    marginTop: 4,
  },
  ticketType: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 2,
  },
  ticketStatus: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },
  statusActive: {
    color: "#34D399",
  },
  statusExpired: {
    color: "#FB7185",
  },
  qrPlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: "#1A1A25",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2A2A3A",
  },
  qrText: {
    color: "#6B7280",
    fontSize: 12,
  },
});