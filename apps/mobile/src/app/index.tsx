import React from "react";
import { Redirect } from "expo-router";
import { useAuth } from "../auth/session";

/** Entry point: signed-in users go to the app, everyone else sees onboarding first. */
export default function Index() {
  const { session, ready } = useAuth();
  if (!ready) return null; // wait until the saved sign-in is read
  if (session) return <Redirect href="/(tabs)" />;
  return <Redirect href="/onboarding" />;
}
