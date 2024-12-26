import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

export default [
    // Main build configuration
    {
        input: 'src/index.ts',
        output: [
            {
                file: 'dist/three-skeleton-optimizer-index.es.js',
                format: 'es'
            },
            {
                file: 'dist/three-skeleton-optimizer-index.umd.js',
                format: 'umd',
                name: 'ThreeSkeletonOptimizer',
            }
        ],
        plugins: [
            typescript({
                tsconfig: './tsconfig.json',
                // declarationDir: './dist'
            })
        ],
        external: ['three'] // Add any external dependencies here
    },
    // Types build configuration
    {
        input: 'src/index.ts',
        output: {
            file: 'dist/index.d.ts',
            format: 'es'
        },
        plugins: [dts()]
    }
];