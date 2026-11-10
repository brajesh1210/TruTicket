import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { Edge, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, space } from "../theme";

type Props = {
  children: React.ReactNode;
  edges?: Edge[];
  style?: ViewStyle;
};

/**
 * Full-height dark screen with safe-area padding. Every screen uses this.
 * Uses the useSafeAreaInsets hook (not the SafeAreaView component) to avoid
 * a children type clash when two copies of @types/react are installed.
 */
export function Screen({ children, edges = ["top", "bottom"], style }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: edges.includes("top") ? insets.top : 0,
          paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
    paddingHorizontal: space.lg,
  },
});
