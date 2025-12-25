import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/test/**/*.test.ts'],
        exclude: ['node_modules', 'out'],
        coverage: {
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules', 'out', 'src/test']
        }
    }
});
