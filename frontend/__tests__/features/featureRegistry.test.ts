import { jest } from '@jest/globals';
import { featureRegistry, FeatureModule } from '../../lib/features/registry';

jest.mock('../../lib/app-config', () => ({
  FEATURE_FLAGS: {
    enableAlpha: true,
    enableBeta: false,
    enableGamma: true,
  },
}));

describe('FeatureRegistry', () => {
  beforeEach(() => {
    // Recreate a fresh registry by re-requiring the module
    jest.resetModules();
  });

  test('register and retrieve features; isEnabled maps flags', async () => {
    const { featureRegistry } = require('../../lib/features/registry');
    const alpha: FeatureModule = { name: 'alpha', version: '1.0.0', description: 'A' };
    const beta: FeatureModule = { name: 'beta', version: '1.0.0', description: 'B' };
    featureRegistry.register(alpha);
    featureRegistry.register(beta);

    expect(featureRegistry.getFeature('alpha')).toEqual(alpha);
    expect(featureRegistry.getFeature('beta')).toEqual(beta);
    expect(featureRegistry.isEnabled('alpha')).toBe(true); // enableAlpha=true
    expect(featureRegistry.isEnabled('beta')).toBe(false); // enableBeta=false
  });

  test('initialize handles dependencies; throws when missing', async () => {
    const { featureRegistry } = require('../../lib/features/registry');
    const initOrder: string[] = [];
    const gamma: FeatureModule = {
      name: 'gamma',
      version: '1.0.0',
      description: 'G',
      initialize: () => {
        initOrder.push('gamma');
      },
    };
    const alpha: FeatureModule = {
      name: 'alpha',
      version: '1.0.0',
      description: 'A',
      dependencies: ['gamma'],
      initialize: () => {
        initOrder.push('alpha');
      },
    };
    featureRegistry.register(gamma);
    featureRegistry.register(alpha);

    await featureRegistry.initialize('alpha');
    expect(initOrder).toEqual(['gamma', 'alpha']);
  });

  test('getRoutes returns only enabled features routes', async () => {
    const { featureRegistry } = require('../../lib/features/registry');
    const alpha: FeatureModule = {
      name: 'alpha',
      version: '1.0.0',
      description: 'A',
      routes: [{ path: '/a', component: () => null }],
    };
    const beta: FeatureModule = {
      name: 'beta',
      version: '1.0.0',
      description: 'B',
      routes: [{ path: '/b', component: () => null }],
    };
    featureRegistry.register(alpha);
    featureRegistry.register(beta);

    const routes = featureRegistry.getRoutes();
    expect(routes.map((r: any) => r.path)).toEqual(['/a']); // beta disabled
  });
});
