import type { LessonId } from './program';
export interface ParentLesson {
  id: LessonId;
  title: string;
  summary: string;
  paragraphs: string[];
  acknowledgement: string;
}
export const PARENT_LESSONS: ParentLesson[] = [
  {
    id: 'purpose',
    title: 'One sound. One red friend.',
    summary: 'Build a familiar sound before introducing choices.',
    paragraphs: [
      'Begin with just Red: the red fox and one piano chord, C major. The child learns the sound as a whole. There is no need to learn note names, sing the notes, or understand music theory.',
      'Sit together. You operate the session and help your child respond. They can point, tap the fox, say “Red,” or lift a red card. Record what actually happened; a parent can tap on the child’s behalf.',
      'This is a parent-led adaptation of the Eguchi method. The fox stands in for the traditional red flag. Using only one friend builds familiarity; success here is not a test of perfect pitch.',
    ],
    acknowledgement: 'I will practice with my child and use Red consistently.',
  },
  {
    id: 'routine',
    title: 'Small moments, spread through the day',
    summary: 'Four or five brief sessions, with time between them.',
    paragraphs: [
      'Aim for four or five short sessions each day. Start with ten presentations of Red per session, usually around two or three minutes. The app starts with a four-session routine; you can choose five in Parent settings.',
      'Leave at least 15 minutes after a session before starting another. Do no more than two sessions in an hour. Attach practice to ordinary moments, such as breakfast, coming home, and the evening routine.',
      'The daily display counts full sessions and also keeps a record of sessions you stop early. Missed practice never becomes extra work tomorrow. Rest during illness, and do not squeeze sessions together to catch up.',
    ],
    acknowledgement: 'I understand the short, spaced routine.',
  },
  {
    id: 'sound',
    title: 'Prepare the listening space',
    summary: 'A clear piano sound at a comfortable volume.',
    paragraphs: [
      'Use a quiet space and a device or speaker that plays the piano clearly. Turn off background music, television, and other sounds. Set a comfortable volume with the parent sound check before inviting your child.',
      'The app uses the same middle-register piano chord every time: C4, E4, and G4 played together and held for about three seconds. Do not shift the octave, play its notes one at a time, or add a tune before it.',
      'If you use a piano alongside the app, keep the keys out of the child’s view and play those three notes together with even strength. A piano is not needed for this initial app-based phase. Later parts of the program will need additional preparation.',
    ],
    acknowledgement: 'I have checked the sound and prepared a quiet space.',
  },
  {
    id: 'respond',
    title: 'Show, listen, and help gently',
    summary: 'Teach the association without turning it into a guessing game.',
    paragraphs: [
      'For the first introduction, play the chord, show the red fox or a red card, and say “Red.” Let your child copy you. In the following presentations, play the chord and give them a chance to respond.',
      'If your child hesitates, is unsure, or gives another answer, help right away: calmly say “Red,” point to Red, and play the chord again. Do not make them struggle, count repeated guesses, or compare the sound as higher or lower.',
      'Choose “Needed help” when you supplied the answer. Choose “No response” when they just listened or did not join in. The app records help and replays separately. It has no countdown, loss screen, or automatic difficulty increase.',
    ],
    acknowledgement: 'I will give the answer calmly when help is needed.',
  },
  {
    id: 'care',
    title: 'Keep it comfortable',
    summary: 'Connection and willingness matter more than a score.',
    paragraphs: [
      'Invite practice as a small shared activity. Be warm and encouraging without making rewards depend on getting an answer right. Avoid testing your child for an audience or asking them to prove their ability.',
      'Stop if your child is tired, distressed, or unwilling. It is fine to finish a session early. Use the parent note to distinguish distraction, tiredness, and listening quietly from a sound-recognition difficulty.',
      'For this phase, record whether the response was independent or helped. Do not interpret ten taps on the only available fox as mastery. There are no streak penalties and no pressure to finish a daily target when rest is needed.',
    ],
    acknowledgement: 'I will stop when my child needs a break.',
  },
  {
    id: 'review',
    title: 'Stay with Red until a review',
    summary: 'Two weeks is a check-in, not an automatic promotion.',
    paragraphs: [
      'Begin with Red alone. The first check-in becomes due two weeks after your first recorded practice. The app keeps the session spacing, participation, help, replays, interruptions, and your observations for that review.',
      'Official lessons use a teacher’s judgment. An automated assessment is not available in this version. When the check-in is due, your practice record can be shared for review; the app will continue offering Red and will not unlock the next chord.',
      'The full method later adds chords in a prescribed sequence, handles particular patterns of confusion, and introduces individual notes. Those stages are not included yet. Absolute-pitch development varies between children; this app does not guarantee an outcome.',
    ],
    acknowledgement: 'I understand that a review is needed before moving on.',
  },
];
export const PARENT_FAQ = [
  {
    title: 'My child responds by speaking or pointing.',
    body: 'That is fine. Record “Independent response” if they identified Red without your help. A parent may tap for them. Use “Needed help” if you prompted the answer, and “No response” if they only listened.',
  },
  {
    title: 'We missed a day or need a rest day.',
    body: 'Pause today from the home screen. Today’s reminders stop; the practice record keeps the gap. Return to the ordinary routine when your child is ready, without catch-up sessions.',
  },
  {
    title: 'My child keeps pressing the fox.',
    body: 'A new presentation needs a fresh piano sound. Wait for the sound, record one response, then move on together. Repeated taps do not create extra trials.',
  },
  {
    title: 'The sound does not play.',
    body: 'Check the device volume and speaker connection, then retry. An audio failure does not count as a presentation. Stop and reopen the session if playback remains unreliable.',
  },
  {
    title: 'Who is this initial program for?',
    body: 'This is designed for young children practicing with an adult. Progress and outcomes vary. Focus on a comfortable daily routine rather than a deadline or a promise of perfect pitch.',
  },
  {
    title: 'What does “first sound” mean in the record?',
    body: 'The first presentation in a session is recorded separately because later responses may be influenced by sounds just heard. In this one-chord phase even that first response is not a discrimination test. The parent check records whether there was recent music or piano practice.',
  },
];
