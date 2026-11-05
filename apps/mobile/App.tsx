/**
 * TruTicket Mobile App — Entry Point
 * React Native + Expo + TypeScript
 */
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import React from "react";

import { SplashScreen } from "./src/screens/SplashScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { ExploreScreen } from "./src/screens/ExploreScreen";
import { EventDetailScreen } from "./src/screens/EventDetailScreen";
import { MyTicketsScreen } from "./src/screens/MyTicketsScreen";
import { TicketDetailScreen } from "./src/screens/TicketDetailScreen";
import { ScannerScreen } from "./src/screens/ScannerScreen";
import { AuthProvider } from "./src/services/auth";

const Stack = createStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Explore" component={ExploreScreen} />
            <Stack.Screen name="EventDetail" component={EventDetailScreen} />
            <Stack.Screen name="MyTickets" component={MyTicketsScreen} />
            <Stack.Screen name="TicketDetail" component={TicketDetailScreen} />
            <Stack.Screen name="Scanner" component={ScannerScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </AuthProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}