import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Body, Card, Heading, Page, usePalette } from './ui';
import PracticeDiagram from './PracticeDiagram';
const DETAILS = [
  {
    title: 'How do we introduce a new friend?',
    body: 'Play the new chord, show its animal or colored card, and say its color. Let your child copy. Then invite a response after each new presentation. They may point, speak, lift a card, or tap. A parent can tap for them.',
  },
  {
    title: 'What if my child hesitates?',
    body: 'Gently name the color and show its animal. Tap the answer, then mark “I helped” during feedback. If they only listen, hold the speech-bubble “No response” control for one second (or tap if you changed it in Practice controls). Avoid repeated guessing or higher/lower clues.',
  },
  {
    title: 'Replay or take more time?',
    body: 'Tap the speaker to replay. After an answer, the next sound follows automatically. Tap pause for more time to help, then resume when ready. Nothing is marked wrong just because your child takes time.',
  },
  {
    title: 'How much practice?',
    body: 'Four or five short sessions a day, with ten presentations while using one or two animals, then thirty with larger sets. Leave at least 15 minutes after a session, and do no more than two in an hour. Stop early when needed. Missed practice never carries over to tomorrow.',
  },
  {
    title: 'Sound and equipment',
    body: 'Use a quiet room, a clear speaker, and a comfortable volume. Each chord uses its prescribed notes, played together for about three seconds in a fixed register. The app supplies all fourteen chords. Individual-note training comes later.',
  },
  {
    title: 'Tired, distracted, or unwell?',
    body: 'Stop if your child is upset or unwilling. Parent settings → Daily routine → Make today a rest day pauses reminders. An optional note helps the AI distinguish tiredness or distraction from listening difficulty.',
  },
  {
    title: 'When do we move on?',
    body: 'When signed in, the server can review synced practice every two weeks and introduce one new sound when the book-based evidence supports it. See Practice record for the explanation. You can pause AI reviews or override the animal plan in Parent settings. New sounds are introduced gently; the later note-name phase needs parent or teacher guidance.',
  },
  {
    title: 'What does the record tell us?',
    body: 'It keeps independent responses, help, replays, spacing, early stops, and your notes. The first sound in each session is marked separately. With one available answer, responses show participation only. With multiple animals, the record also keeps which sounds were confused.',
  },
  {
    title: 'About this program',
    body: 'This is an independent, parent-led adaptation of the Eguchi method for young children. Pictures replace flags and the app supplies a fixed piano sound. The chord-and-color phase is included. Individual-note training and official teacher supervision are not. Outcomes vary; perfect pitch is not guaranteed.',
  },
];
export default function ParentGuide() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const p = usePalette();
  return (
    <Page title="Parent guide" subtitle="The essentials, always available offline.">
      <Card>
        <Heading>A small listening routine</Heading>
        <PracticeDiagram />
        <Body>Fourteen colors and animals · 4–5 short sessions a day.</Body>
        <Body muted>At least 15 minutes apart. Stop when your child needs a break.</Body>
      </Card>
      <Card>
        {DETAILS.map((item, index) => (
          <View
            key={item.title}
            style={{
              gap: 10,
              borderTopWidth: index ? 1 : 0,
              borderColor: p.borderMuted,
              paddingTop: index ? 12 : 0,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: expanded === item.title }}
              onPress={() => setExpanded(value => (value === item.title ? null : item.title))}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 18, fontWeight: '600', color: p.text }}>
                {expanded === item.title ? '−' : '+'} {item.title}
              </Text>
            </Pressable>
            {expanded === item.title && <Body>{item.body}</Body>}
          </View>
        ))}
      </Card>
    </Page>
  );
}
