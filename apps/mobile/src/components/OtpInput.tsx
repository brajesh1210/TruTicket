import React, { useRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fontSize, fontWeight, radius } from "../theme";

const LENGTH = 6;

type Props = {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
};

/** Six boxes backed by one hidden input (works with SMS/autofill on both platforms). */
export function OtpInput({ value, onChange, onComplete }: Props) {
  const inputRef = useRef<TextInput>(null);

  function handleChange(text: string) {
    const digits = text.replace(/\D/g, "").slice(0, LENGTH);
    onChange(digits);
    if (digits.length === LENGTH) onComplete?.(digits);
  }

  const boxes = Array.from({ length: LENGTH }, (_, i) => value[i] ?? "");
  const activeIndex = Math.min(value.length, LENGTH - 1);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.row}>
      {boxes.map((d, i) => (
        <View
          key={i}
          style={[
            styles.box,
            i === activeIndex && styles.boxActive,
            d ? styles.boxFilled : null,
          ]}
        >
          <Text style={styles.digit}>{d}</Text>
        </View>
      ))}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={LENGTH}
        autoFocus
        style={styles.hidden}
        accessibilityLabel="One-time code"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  box: {
    width: 46,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bg.border,
    backgroundColor: colors.bg.card,
    alignItems: "center",
    justifyContent: "center",
  },
  boxActive: { borderColor: colors.brand.cyan },
  boxFilled: { borderColor: colors.brand.cyan },
  digit: {
    color: colors.text.primary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  hidden: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
  },
});
