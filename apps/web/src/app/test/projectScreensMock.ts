// The Ask screens load with the Project screen's code (features/project/projectScreens.ts). Tests
// that time that code mock the Project screen and leave the Ask screens out, so the code a push
// waits for is only what they mocked.
export async function projectScreensWithoutAsk() {
  const { ProjectScreen } = await import('../../features/project/ProjectScreen');
  return { ProjectScreen, ChatsScreen: () => null, ChatScreen: () => null };
}
