import { Colors } from '@/constants/Colors';

export type EguchiColorScheme = 'light' | 'dark' | null | undefined;

export const getEguchiTheme = (colorScheme: EguchiColorScheme) => {
  const isDark = colorScheme === 'dark';
  const base = Colors[isDark ? 'dark' : 'light'];

  return {
    isDark,
    text: base.text,
    tint: base.tint,
    icon: base.icon,
    background: base.background,
    appBackground: isDark ? '#0A0F12' : '#F5F7F8',
    surface: isDark ? '#1B2227' : '#FFFFFF',
    surfaceMuted: isDark ? '#232C32' : '#F8FAFA',
    surfaceElevated: isDark ? '#20282E' : '#FFFFFF',
    border: isDark ? '#394850' : '#D3D3D3',
    borderMuted: isDark ? '#2F3B42' : '#E1E5E8',
    track: isDark ? '#303A41' : '#E1E5E8',
    lockedSurface: isDark ? '#161C20' : '#F3F5F6',
    lockedBorder: isDark ? '#303A41' : '#D7DDE2',
    lockedFill: isDark ? '#3B464D' : '#D3D9DE',
    subtleText: isDark ? '#C8D0D5' : '#4B5560',
    successSurface: isDark ? '#102A1E' : '#E9F7EF',
    successBorder: isDark ? '#2D6B45' : '#9CD7B0',
    successText: isDark ? '#9FE0B5' : '#166534',
    dangerSurface: isDark ? '#331A17' : '#FEF3F2',
    dangerBorder: isDark ? '#7A2E28' : '#FDA29B',
    dangerText: isDark ? '#FFB4AA' : '#7A271A',
    modalBackdrop: isDark ? 'rgba(2, 6, 10, 0.72)' : 'rgba(16, 24, 40, 0.58)',
  };
};
