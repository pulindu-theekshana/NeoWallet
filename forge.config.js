const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    name: 'NeoWallet',
    executableName: 'NeoWallet',

    // The app icon (.ico extension is added automatically for Windows)
    icon: './assets/icon',

    // Extra files to include alongside your app (NOT inside asar)
    // These land in the "resources/" folder of the installed app
    extraResource: [
      './backend/dist/flask_backend.exe',   // ← the bundled Python server
      './assets/icon.ico',                   // ← icon (for the window titlebar)
    ],
  },

  rebuildConfig: {},

  makers: [
    {
      // Windows installer (creates ExpenseTrackSetup.exe)
      name: '@electron-forge/maker-squirrel',
      config: {
        name:        'NeoWallet',
        setupExe:    'NeoWalletSetup.exe',
        setupIcon:   './assets/icon.ico',
        authors:     'Your Name',
        description: 'Personal Expense Tracker',
        // noMsi: true,  // Uncomment if you don't want an .msi file
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],

  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};