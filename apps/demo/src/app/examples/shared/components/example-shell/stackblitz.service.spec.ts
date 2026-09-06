import sdk from '@stackblitz/sdk';

import { StackblitzService } from './stackblitz.service';

jest.mock('@stackblitz/sdk', () => ({
  __esModule: true,
  default: { openProject: jest.fn() },
}));

describe('StackblitzService', () => {
  it('opens a zoneless Angular project without a Zone.js runtime dependency', () => {
    const service = new StackblitzService();

    service.open({
      title: 'Example',
      files: {
        'src/app/app.component.ts': 'export class AppComponent {}',
      },
    });

    expect(sdk.openProject).toHaveBeenCalledTimes(1);
    const [project] = jest.mocked(sdk.openProject).mock.calls[0];
    const manifest = JSON.parse(project.files['package.json']) as {
      dependencies: Record<string, string>;
    };

    expect(manifest.dependencies['zone.js']).toBeUndefined();
    expect(project.files['src/main.ts']).toContain(
      'provideZonelessChangeDetection()'
    );
  });
});
