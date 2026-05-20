import { Platform } from 'react-native';

export const WEB_APP_MAX_WIDTH = 800;

export const getRootContentFrameStyle = (platformOS = Platform.OS) => ({
  flex: 1,
  width: '100%' as const,
  ...(platformOS === 'web' ? { maxWidth: WEB_APP_MAX_WIDTH } : {}),
});

export const getSettingsPresentation = (platformOS = Platform.OS) =>
  platformOS === 'ios' ? 'fullScreenModal' : 'modal';
