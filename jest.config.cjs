module.exports = {
  testTimeout: 60000,
  projects: [
    {
      displayName: 'api',
      modulePathIgnorePatterns: ['<rootDir>/apps/web/.next/'],
      testEnvironment: 'node',
      testMatch: ['<rootDir>/apps/api/test/**/*.spec.ts'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: {
              target: 'ES2022',
              module: 'commonjs',
              experimentalDecorators: true,
              emitDecoratorMetadata: true,
              esModuleInterop: true,
              skipLibCheck: true,
              types: ['node', 'jest'],
            },
          },
        ],
        '^.+\\.js$': '<rootDir>/scripts/jest-js-transform.cjs',
      },
      transformIgnorePatterns: ['/node_modules/(?!@nestjs/)'],
    },
    {
      displayName: 'ui',
      modulePathIgnorePatterns: ['<rootDir>/apps/web/.next/'],
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/apps/web/**/*.test.tsx'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: {
              target: 'ES2022',
              module: 'commonjs',
              jsx: 'react-jsx',
              esModuleInterop: true,
              skipLibCheck: true,
              baseUrl: '.',
              paths: { '@/*': ['apps/web/*'] },
              types: ['node', 'jest', '@testing-library/jest-dom'],
            },
          },
        ],
      },
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/apps/web/$1' },
      setupFilesAfterEnv: ['@testing-library/jest-dom'],
    },
  ],
};
