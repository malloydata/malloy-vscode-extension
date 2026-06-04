/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

module.exports = {
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx'],
  setupFilesAfterEnv: ['jest-expect-message'],
  testMatch: ['**/?(*.)spec.(ts|js)?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {tsconfig: '<rootDir>/tsconfig.json'}],
  },
  testTimeout: 100000,
  verbose: true,
  testEnvironment: 'node',
};
