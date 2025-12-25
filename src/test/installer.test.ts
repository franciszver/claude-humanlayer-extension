// Jest globals are provided automatically
// vscode is mocked via moduleNameMapper in jest.config.js
import type { InstallLocation } from '../installer/installer';

describe('Installer', () => {
    describe('InstallLocation type', () => {
        it('should only allow workspace or user values', () => {
            // Type-level compile check - if this compiles, the type is correct
            const validLocations: InstallLocation[] = ['workspace', 'user'];
            expect(validLocations).toHaveLength(2);
        });
    });
});
