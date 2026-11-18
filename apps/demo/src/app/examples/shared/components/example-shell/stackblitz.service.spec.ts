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

  it.each(['15.5.0-rc.1', '16.0.0-dev'])(
    'keeps prerelease %s local instead of offering a remote project',
    (version) => {
      DEMO_LIBRARY_VERSIONS['signaltree'] = version;
      const service = new StackblitzService();
      expect(service.available).toBe(false);
      service.open({ title: 'Candidate', files: {} });
      expect(sdk.openProject).not.toHaveBeenCalled();
    }
  );
  it.each(['15.4.8', '15.4.9'])(
    'prepares a zoneless Angular sandbox for the selected stable release %s',
    (version) => {
      // Manifest generation is not a registry publication check.
      DEMO_LIBRARY_VERSIONS['signaltree'] = version;
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
      expect(manifest.dependencies['@signal-tree/angular']).toBe(version);
      expect(project.files['src/app/app.component.ts']).toContain(
        'onDestroy(() => this.tree.destroy())'
      );
      expect(project.files['src/main.ts']).toContain(
        'provideZonelessChangeDetection()'
      );
    }
  );
});
