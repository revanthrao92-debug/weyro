import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen options={{ title: 'Login', headerShown: false }} name="login" />
      <Stack.Screen options={{ title: 'Register', headerShown: false }} name="register" />
      <Stack.Screen
        options={{ title: 'Reset Password', headerShown: false }}
        name="reset-password"
      />
      <Stack.Screen
        options={{ title: 'Forgot Password', headerShown: false }}
        name="forgot-password"
      />
    </Stack>
  );
}
