import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveProjectId } from '../src/config.ts';

const originalProjectId = process.env.DO_PROJECT_ID;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalProjectId === undefined) delete process.env.DO_PROJECT_ID;
  else process.env.DO_PROJECT_ID = originalProjectId;
});

describe('DigitalOcean project selection', () => {
  it('fails closed when DO_PROJECT_ID is unset instead of querying the default project', async () => {
    delete process.env.DO_PROJECT_ID;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(resolveProjectId()).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uses only the explicitly configured project id', async () => {
    process.env.DO_PROJECT_ID = 'benefitbridge-project-id';
    await expect(resolveProjectId()).resolves.toBe('benefitbridge-project-id');
  });
});
