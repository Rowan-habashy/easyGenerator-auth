module.exports = {
  rootDir: 'src',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json', diagnostics: { ignoreCodes: [151002] } }] },
  moduleFileExtensions: ['js', 'json', 'ts'],
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!test/**', '!main.ts', '!**/*.module.ts', '!**/*.schema.ts', '!**/*.repository.ts'],
  coverageDirectory: '<rootDir>/../coverage',
  clearMocks: true,
}
