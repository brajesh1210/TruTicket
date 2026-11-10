import React from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { colors, fontSize, radius, space } from "../theme";

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
};

export function Field({ label, error, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.text.muted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  label: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    marginBottom: space.xs,
  },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bg.border,
    backgroundColor: colors.bg.card,
    color: colors.text.primary,
    paddingHorizontal: space.md,
    fontSize: fontSize.md,
  },
  inputError: { borderColor: colors.status.danger },
  error: {
    color: colors.status.danger,
    fontSize: fontSize.sm,
    marginTop: space.xs,
  },
});
