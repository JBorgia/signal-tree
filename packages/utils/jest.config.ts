export default {
  displayName: 'utils',
  preset: '../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};
