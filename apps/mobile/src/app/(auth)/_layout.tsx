import { Stack } from 'expo-router';

/**
 * Auth group — headers hidden: each screen draws its own full-bleed hero
 * (dark navy with the Weyro logo), so a system header would duplicate the
 * title over it (unslop: quiet chrome).
 */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#06151E' } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
