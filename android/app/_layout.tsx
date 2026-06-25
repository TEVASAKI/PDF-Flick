import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{ title: '設定', headerBackTitle: '戻る' }}
        />
        <Stack.Screen
          name="trash"
          options={{ title: 'ゴミ箱', headerBackTitle: '戻る' }}
        />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
