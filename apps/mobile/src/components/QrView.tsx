import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { encode } from "uqr";

type Props = {
  value: string;
  size?: number; // total width and height in px
  color?: string;
  backgroundColor?: string;
};

/**
 * Pure-JS QR renderer (uqr) drawn with Views. No native module, so it works in
 * the existing dev build and in Expo Go without a rebuild.
 */
export function QrView({ value, size = 220, color = "#000000", backgroundColor = "#FFFFFF" }: Props) {
  const matrix = useMemo(() => {
    const qr = encode(value, { ecc: "M", boostEcc: true });
    return qr.data as (boolean | number)[][];
  }, [value]);

  const quiet = 2; // quiet zone in modules
  const modules = matrix.length + quiet * 2;
  const cell = size / modules;

  return (
    <View style={[styles.box, { width: size, height: size, backgroundColor }]}>
      {matrix.map((row, y) =>
        row.map((on, x) =>
          on ? (
            <View
              key={`${x}-${y}`}
              style={{
                position: "absolute",
                left: (x + quiet) * cell,
                top: (y + quiet) * cell,
                width: cell + 0.5,
                height: cell + 0.5,
                backgroundColor: color,
              }}
            />
          ) : null,
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: "relative" },
});
