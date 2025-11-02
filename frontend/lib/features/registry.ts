import { FEATURE_FLAGS } from '../app-config';

export interface FeatureModule {
  name: string;
  version: string;
  description: string;
  dependencies?: string[];
  components?: Record<string, any>;
  hooks?: Record<string, Function>;
  services?: Record<string, any>;
  routes?: { path: string; component: any; exact?: boolean; private?: boolean }[];
  initialize?: () => Promise<void> | void;
  cleanup?: () => Promise<void> | void;
}

class FeatureRegistry {
  private features = new Map<string, FeatureModule>();
  private initialized = new Set<string>();

  register(feature: FeatureModule): void {
    this.features.set(feature.name, feature);
  }

  async initialize(featureName: string): Promise<void> {
    const feature = this.features.get(featureName);
    if (!feature) {
      console.warn(`Feature ${featureName} not found`);
      return;
    }
    if (this.initialized.has(featureName)) return;

    if (feature.dependencies) {
      for (const dep of feature.dependencies) {
        if (!this.isEnabled(dep)) {
          throw new Error(`Feature ${featureName} requires ${dep} to be enabled`);
        }
        await this.initialize(dep);
      }
    }

    await feature.initialize?.();
    this.initialized.add(featureName);
  }

  async cleanup(featureName: string): Promise<void> {
    const feature = this.features.get(featureName);
    await feature?.cleanup?.();
    this.initialized.delete(featureName);
  }

  getFeature(name: string): FeatureModule | undefined {
    return this.features.get(name);
  }

  getEnabledFeatures(): FeatureModule[] {
    return Array.from(this.features.values()).filter(f => this.isEnabled(f.name));
  }

  isEnabled(featureName: string): boolean {
    const flagKey =
      `enable${featureName.charAt(0).toUpperCase()}${featureName.slice(1)}` as keyof typeof FEATURE_FLAGS;
    return (FEATURE_FLAGS[flagKey] as boolean) ?? false;
  }

  getComponent(featureName: string, componentName: string): any | undefined {
    const feature = this.features.get(featureName);
    return feature?.components?.[componentName];
  }

  getHook(featureName: string, hookName: string): Function | undefined {
    const feature = this.features.get(featureName);
    return feature?.hooks?.[hookName];
  }

  getService(featureName: string, serviceName: string): any {
    const feature = this.features.get(featureName);
    return feature?.services?.[serviceName];
  }

  getRoutes() {
    return this.getEnabledFeatures().flatMap(f => f.routes || []);
  }
}

export const featureRegistry = new FeatureRegistry();
