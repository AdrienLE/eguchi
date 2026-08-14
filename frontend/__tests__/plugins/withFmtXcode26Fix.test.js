const { addFmtXcode26FixToPodfile } = require('../../plugins/withFmtXcode26Fix');

describe('withFmtXcode26Fix config plugin', () => {
  const podfile = `target 'EguchiEarTrainer' do
  post_install do |installer|
    react_native_post_install(installer)
  end
end
`;

  test('adds the fmt patch inside post_install', () => {
    const patched = addFmtXcode26FixToPodfile(podfile);

    expect(patched).toContain('# Eguchi: Xcode 26 fmt consteval workaround');
    expect(patched).toContain("installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h'");
    expect(patched.indexOf('fmt_base')).toBeLessThan(patched.indexOf('react_native_post_install'));
  });

  test('is idempotent across repeated prebuilds', () => {
    const once = addFmtXcode26FixToPodfile(podfile);
    expect(addFmtXcode26FixToPodfile(once)).toBe(once);
  });

  test('fails closed when the generated Podfile shape changes', () => {
    expect(() => addFmtXcode26FixToPodfile("target 'App' do\nend\n")).toThrow(
      'Could not find the Podfile post_install block'
    );
  });
});
