import sdk from '@stackblitz/sdk';

import { DEMO_LIBRARY_VERSIONS } from '../../../../library-versions';

import { StackblitzService } from './stackblitz.service';

jest.mock('@stackblitz/sdk', () => ({
  __esModule: true,
  default: { openProject: jest.fn() },
}));

describe('StackblitzService', () => {
  const candidate = DEMO_LIBRARY_VERSIONS['signaltree'];
  afterEach(() => {
    DEMO_LIBRARY_VERSIONS['signaltree'] = candidate;
    jest.clearAllMocks();
  });

  it.each(['16.0.0-dev', '16.0.0-rc.1', '16.0.0-beta.1'])(
    'keeps prerelease %s local until its remote scaffold is verified',
    (version) => {
      DEMO_LIBRARY_VERSIONS['signaltree'] = version;
      const service = new StackblitzService();
      expect(service.available).toBe(false);
      service.open({ title: 'Candidate', files: {} });
      expect(sdk.openProject).not.toHaveBeenCalled();
    }
  );
  it('opens a zoneless Angular project without a Zone.js runtime dependency', () => {
    // Fixture models a published version; candidate access is tested separately.
    DEMO_LIBRARY_VERSIONS['signaltree'] = '15.4.8';
    const service = new StackblitzService();
    expect(service.available).toBe(true);

    service.open({
      title: 'Example',
      files: {
        'src/extra.ts': 'export const extra = true;',
      },
    });

    expect(sdk.openProject).toHaveBeenCalledTimes(1);
    const [project] = jest.mocked(sdk.openProject).mock.calls[0];
    const manifest = JSON.parse(project.files['package.json']) as {
      dependencies: Record<string, string>;
    };

    expect(manifest.dependencies['zone.js']).toBeUndefined();
    expect(manifest.dependencies['@signal-tree/angular']).toBe('15.4.8');
    expect(project.files['src/app/app.component.ts']).toContain(
      'onDestroy(() => this.tree.destroy())'
    );
    expect(project.files['src/main.ts']).toContain(
      'provideZonelessChangeDetection()'
    );
  });
});
