import fs from 'fs';
import path from 'path';

describe('training screen surface', () => {
  const source = fs.readFileSync(path.join(__dirname, '../app/(tabs)/index.tsx'), 'utf8');

  test('keeps the playroom fixed instead of scrollable', () => {
    expect(source).toContain('scrollEnabled={false}');
    expect(source).toContain('bounces={false}');
    expect(source).toContain('alwaysBounceVertical={false}');
    expect(source).toContain('overScrollMode="never"');
  });
});
