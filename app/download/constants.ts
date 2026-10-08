const GITHUB_RELEASE_BASE =
  "https://github.com/chesdasareybot-coder/donoharm-app/releases/latest/download";

export const downloadLinks = {
  macos: `${GITHUB_RELEASE_BASE}/donoharm-universal.dmg`,
  windows: `${GITHUB_RELEASE_BASE}/DoNoHarm_1.0.0_x64-setup.exe`,
  linuxAppImage: `${GITHUB_RELEASE_BASE}/donoharm-linux-x64.AppImage`,
  linuxArm64AppImage: `${GITHUB_RELEASE_BASE}/donoharm-linux-arm64.AppImage`,
  linuxDeb: `${GITHUB_RELEASE_BASE}/donoharm-linux-x64.deb`,
  linuxArm64Deb: `${GITHUB_RELEASE_BASE}/donoharm-linux-arm64.deb`,
};
