const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod } = require('@expo/config-plugins');

const PLUGIN_MARKER = '# Eguchi: Xcode 26 fmt consteval workaround';
const POST_INSTALL_ANCHOR = '  post_install do |installer|\n';
const FMT_PATCH = `
    ${PLUGIN_MARKER}
    # fmt 11.0.2 enables consteval for Apple Clang, but Xcode 26.4 enforces
    # stricter call-site rules. React Native fixes this in newer releases.
    fmt_base = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      fmt_source = File.read(fmt_base)
      fmt_apple_check = '#elif defined(__apple_build_version__) && __apple_build_version__ < 14000029L'
      fmt_xcode_26_check = '#elif defined(__apple_build_version__)'
      if fmt_source.include?(fmt_apple_check)
        File.chmod(0644, fmt_base)
        File.write(fmt_base, fmt_source.sub(fmt_apple_check, fmt_xcode_26_check))
        Pod::UI.puts 'Patched fmt consteval detection for Xcode 26'.green
      end
    end
`;

const addFmtXcode26FixToPodfile = contents => {
  if (contents.includes(PLUGIN_MARKER)) {
    return contents;
  }
  if (!contents.includes(POST_INSTALL_ANCHOR)) {
    throw new Error('Could not find the Podfile post_install block for the Xcode 26 fmt fix.');
  }
  return contents.replace(POST_INSTALL_ANCHOR, `${POST_INSTALL_ANCHOR}${FMT_PATCH}`);
};

const withFmtXcode26Fix = config =>
  withDangerousMod(config, [
    'ios',
    async modConfig => {
      const podfilePath = path.join(modConfig.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfilePath, 'utf8');
      fs.writeFileSync(podfilePath, addFmtXcode26FixToPodfile(contents));
      return modConfig;
    },
  ]);

module.exports = withFmtXcode26Fix;
module.exports.addFmtXcode26FixToPodfile = addFmtXcode26FixToPodfile;
