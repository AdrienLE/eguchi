import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
export const exportPracticeRecord = async (record: unknown) => {
  const text = JSON.stringify(record, null, 2);
  const filename = `eguchi-practice-${new Date().toISOString().slice(0, 10)}.json`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  if ((await Sharing.isAvailableAsync()) && FileSystem.cacheDirectory) {
    const uri = FileSystem.cacheDirectory + filename;
    await FileSystem.writeAsStringAsync(uri, text);
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      UTI: 'public.json',
      dialogTitle: 'Share your practice record',
    });
  } else await Share.share({ message: text, title: 'Eguchi practice record' });
};
