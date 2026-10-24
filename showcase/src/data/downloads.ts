// The signed v0.1.0-preview install discs, from the release thread. While this is empty the overview's Download
// section shows only the ways to install that work today; fill it and the table appears above them.
export const RELEASE = 'v0.1.0-preview';
export const DOWNLOADS: { file: string; edition: string; arch: string; machine: string; size: string; sha256: string; url: string; mirror?: string }[] = [
  { file: 'gurtos-server-x86_64.iso', edition: 'Server', arch: 'x86_64', machine: 'A PC, server or cloud VM (Intel or AMD)', size: '1.34 GB', sha256: '159753d9a02e546f215c9553512c0bfb43e3b4b3f82f1fc92569a8eef1796a07', url: 'https://github.com/benz16107/calhacks13/releases/download/v0.1.0-preview/gurtos-server-x86_64.iso', mirror: 'https://sjc1.vultrobjects.com/gurtos/v0.1.0-preview/gurtos-server-x86_64.iso' },
  { file: 'gurtos-server-arm64.iso', edition: 'Server', arch: 'arm64', machine: 'An Apple silicon Mac (UTM or Parallels) or an arm64 server', size: '1.34 GB', sha256: 'c9444fe07f2405c21e23ba700b1e8bac97517a630f1a21d6ede61210e08c8b28', url: 'https://github.com/benz16107/calhacks13/releases/download/v0.1.0-preview/gurtos-server-arm64.iso', mirror: 'https://sjc1.vultrobjects.com/gurtos/v0.1.0-preview/gurtos-server-arm64.iso' },
];
