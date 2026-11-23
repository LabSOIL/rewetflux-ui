// @vitest-environment node
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { build } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const configFile = resolve(here, '../../vite.config.ts');
const probeId = '\0virtual:env-probe';

// Scenario: the bundle must not carry the build process environment.
// Expected behaviour: a module reading `process.env` is emitted without the probe value or the
// `PATH` / `HOME` entries of the building process.
describe('client bundle environment', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not inline the build process environment', async () => {
    vi.stubEnv('RF_PROBE', 'probe-value');
    const result = await build({
      configFile,
      logLevel: 'silent',
      plugins: [
        {
          name: 'env-probe',
          resolveId: (id) => (id === 'virtual:env-probe' ? probeId : null),
          load: (id) =>
            id === probeId
              ? 'globalThis.probe = process.env.RF_PROBE; globalThis.all = process.env;'
              : null,
        },
      ],
      build: { write: false, sourcemap: false, rollupOptions: { input: 'virtual:env-probe' } },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output);
    const code = outputs
      .filter((o) => o.type === 'chunk')
      .map((o) => o.code)
      .join('\n');
    // Boolean assertions keep a failing run from printing the environment.
    expect(code.includes('probe-value')).toBe(false);
    expect(/\b(PATH|HOME)"?\s*:/.test(code)).toBe(false);
  });
});
