import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import { dts } from 'rollup-plugin-dts';

const external = [
  'axios',
  'graphql',
  'graphql-request',
  'ws',
  'eventemitter3',
  'retry',
  'circuit-breaker-js',
  'zod',
];

export default [
  // Build configuration
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
      {
        file: 'dist/index.esm.js',
        format: 'es',
        sourcemap: true,
      },
    ],
    external,
    plugins: [
      resolve({
        preferBuiltins: true,
        browser: false,
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        exclude: ['**/*.test.ts', '**/*.spec.ts'],
      }),
    ],
  },
  // Type definitions
  {
    input: 'dist/index.d.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es',
    },
    plugins: [dts()],
    external: [/\.css$/],
  },
];