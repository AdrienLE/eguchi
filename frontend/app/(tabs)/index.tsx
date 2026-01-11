import { StyleSheet, ScrollView, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

const SPEC_PATH = 'SPEC.md';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        testID="eguchi-spec-placeholder"
      >
        <ThemedText type="title" style={styles.title}>
          Eguchi Ear-Training Playground
        </ThemedText>
        <ThemedText style={styles.paragraph}>
          This screen is intentionally left in a planning state. Before building UI or wiring APIs,
          read through the Eguchi specification and capture any open questions or research tasks.
        </ThemedText>
        <View style={styles.callout}>
          <ThemedText type="subtitle">
            Next stop: {SPEC_PATH}
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            The spec outlines pedagogy principles, offline audio requirements, and session
            structure. Treat it as the product source of truth when designing screens and data
            flows.
          </ThemedText>
          <ThemedText style={styles.todo}>
            TODO: replace this placeholder once the onboarding and training flows from the spec are
            translated into UI journeys.
          </ThemedText>
        </View>
        <ThemedText style={styles.paragraph}>
          Suggested first steps:
        </ThemedText>
        <ThemedText style={styles.listItem}>
          • Define the core navigation map (practice sessions, curriculum, progress tracking).
        </ThemedText>
        <ThemedText style={styles.listItem}>
          • Inventory required audio assets and plan how they’ll ship with the offline bundle.
        </ThemedText>
        <ThemedText style={styles.listItem}>
          • Capture technical questions from the spec directly in NOTION/issue tracker before
            coding.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
    gap: 16,
  },
  title: { textAlign: 'center' },
  paragraph: { fontSize: 16, lineHeight: 22 },
  listItem: { fontSize: 16, lineHeight: 22, marginLeft: 12 },
  callout: {
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  todo: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
