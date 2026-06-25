// jest/setup.js
// npm audit fix により react-native 0.86.0 がネストインストールされた。
// そのバージョンの NativeModules.js が global.__fbBatchedBridgeConfig を
// 必須としており、未設定時に Invariant Violation を投げる。
// setupFiles では jest.mock() は使えないため、global 変数で直接対処する。

// 空のブリッジ設定を提供して NativeModules.js の invariant を回避
global.__fbBatchedBridgeConfig = {
  remoteModuleConfig: [],
};

// nativeModuleProxy を設定すると NativeModules.js はこちらを優先して使用する
// モジュール名に応じて適切な定数を返すプロキシを提供する
global.nativeModuleProxy = new Proxy({}, {
  get: (_target, prop) => {
    if (prop === 'DeviceInfo') {
      return {
        getConstants: () => ({
          Dimensions: {
            window: { width: 390, height: 844, scale: 3, fontScale: 1 },
            screen: { width: 390, height: 844, scale: 3, fontScale: 1 },
          },
        }),
      };
    }
    if (prop === 'PlatformConstants') {
      return {
        getConstants: () => ({
          isTesting: true,
          reactNativeVersion: { major: 0, minor: 81, patch: 5 },
          forceTouchAvailable: false,
          interfaceIdiom: 'phone',
          osVersion: '17.0',
          systemName: 'iOS',
        }),
      };
    }
    if (typeof prop === 'string') {
      return { getConstants: () => ({}) };
    }
    return undefined;
  },
});
