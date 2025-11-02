/**
 * Feature Module System
 *
 * This system allows for modular feature development where each feature
 * can be easily enabled/disabled and comes with its own components,
 * hooks, and configuration.
 */

import React from 'react';
import { featureRegistry } from './registry';

// Feature interface that all features must implement
export interface FeatureModule {
  name: string;
  version: string;
  description: string;
  dependencies?: string[];
  components?: Record<string, React.ComponentType<any>>;
  hooks?: Record<string, Function>;
  services?: Record<string, any>;
  routes?: FeatureRoute[];
  initialize?: () => Promise<void> | void;
  cleanup?: () => Promise<void> | void;
}

export interface FeatureRoute {
  path: string;
  component: React.ComponentType<any>;
  exact?: boolean;
  private?: boolean;
}

// Feature registry to manage all features
export { featureRegistry };

// Helper hook for using features in components
export const useFeature = (featureName: string) => {
  const isEnabled = featureRegistry.isEnabled(featureName);
  const feature = featureRegistry.getFeature(featureName);

  return {
    isEnabled,
    feature,
    getComponent: (name: string) => featureRegistry.getComponent(featureName, name),
    getHook: (name: string) => featureRegistry.getHook(featureName, name),
    getService: (name: string) => featureRegistry.getService(featureName, name),
  };
};

// Helper function to conditionally render feature components
export const FeatureGate: React.FC<{
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ feature, children, fallback = null }) => {
  const isEnabled = featureRegistry.isEnabled(feature);
  return isEnabled ? <>{children}</> : <>{fallback}</>;
};

// Initialize all enabled features
export const initializeEnabledFeatures = async (): Promise<void> => {
  const enabledFeatures = featureRegistry.getEnabledFeatures();

  for (const feature of enabledFeatures) {
    try {
      await featureRegistry.initialize(feature.name);
    } catch (error) {
      console.error(`Failed to initialize feature ${feature.name}:`, error);
    }
  }
};
