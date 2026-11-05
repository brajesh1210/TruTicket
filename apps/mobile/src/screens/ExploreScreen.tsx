/**
 * Explore / Home Screen — Event discovery
 */
import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";

interface Event {
  id: string;
  title: string;
  venue: string;
  date: string;
  coverImageUrl?: string;
}

export function ExploreScreen() {
  const [events, setEvents] = useState<Event[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data — replace with Supabase fetch
    setEvents([
      { id: "1", title: "College Fest 2026", venue: "Jaipur, Rajasthan", date: "15 Nov 2026", coverImageUrl: undefined },
      { id: "2", title: "Music Night Live", venue: "Delhi, India", date: "20 Nov 2026", coverImageUrl: undefined },
    ]);
    setLoading(false);
  }, []);

  const filtered = events.filter(e => e.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore Events</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search events, cities..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2563EB" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.eventCard}>
              <View style={styles.cardContent}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <Text style={styles.eventVenue}>{item.venue}</Text>
                <Text style={styles.eventDate}>{item.date}</Text>
              </View>
              <Text style={styles.buyBtn}>Buy Ticket</Text>
            </TouchableOpacity>
          )}
        />
      )}
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
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: "#12121A",
    color: "#F5F5F7",
    padding: 14,
    borderRadius: 10,
    fontSize: 14,
  },
  eventCard: {
    backgroundColor: "#12121A",
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardContent: {
    flex: 1,
  },
  eventTitle: {
    color: "#F5F5F7",
    fontSize: 18,
    fontWeight: "600",
  },
  eventVenue: {
    color: "#A1A1AA",
    fontSize: 14,
    marginTop: 4,
  },
  eventDate: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 2,
  },
  buyBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buyBtnText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
});