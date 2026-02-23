const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { resolve } = require('metro-resolver');
const { withUniwindConfig } = require('uniwind/metro');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const projectRoot = __dirname;

const config = {
  watchFolders: [path.resolve(projectRoot, 'packages')],
  resolver: {
    unstable_enableSymlinks: true,
    nodeModulesPaths: [path.resolve(projectRoot, 'node_modules')],
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName.startsWith('@/')) {
        const resolvedPath = path.join(projectRoot, 'src', moduleName.slice(2));
        return resolve(context, resolvedPath, platform);
      }
      return resolve(context, moduleName, platform);
    },
  },
};

const mergedConfig = mergeConfig(getDefaultConfig(projectRoot), config);
module.exports = withUniwindConfig(mergedConfig, {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
});
