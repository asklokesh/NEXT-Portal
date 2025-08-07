'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface FeatureToggles {
 dashboard: boolean;
 serviceCatalog: boolean;
 relationships: boolean;
 create: boolean;
 templates: boolean;
 plugins: boolean;
 workflows: boolean;
 deployments: boolean;
 kubernetes: boolean;
 healthMonitor: boolean;
 soundcheck: boolean;
 techRadar: boolean;
 analytics: boolean;
 costTracking: boolean;
 monitoring: boolean;
 activity: boolean;
 documentation: boolean;
 apiDocs: boolean;
 teams: boolean;
}

interface FeatureTogglesContextType {
 toggles: FeatureToggles;
 updateToggle: (feature: keyof FeatureToggles, enabled: boolean) => void;
 resetToDefaults: () => void;
}

const DEFAULT_TOGGLES: FeatureToggles = {
 dashboard: true,
 serviceCatalog: true,
 relationships: true,
 create: true,
 templates: true,
 plugins: true,
 workflows: true,
 deployments: true,
 kubernetes: true,
 healthMonitor: true,
 soundcheck: true,
 techRadar: true,
 analytics: true,
 costTracking: true,
 monitoring: true,
 activity: true,
 documentation: true,
 apiDocs: true,
 teams: true,
};

const FeatureTogglesContext = createContext<FeatureTogglesContextType | undefined>(undefined);

export function FeatureTogglesProvider({ children }: { children: React.ReactNode }) {
 const [toggles, setToggles] = useState<FeatureToggles>(DEFAULT_TOGGLES);

 // Load toggles from localStorage on mount
 useEffect(() => {
 const stored = localStorage.getItem('feature-toggles');
 if (stored) {
 try {
 const parsed = JSON.parse(stored);
 setToggles({ ...DEFAULT_TOGGLES, ...parsed });
 } catch (error) {
 console.error('Failed to parse feature toggles:', error);
 }
 }
 }, []);

 // Save toggles to localStorage whenever they change
 useEffect(() => {
 localStorage.setItem('feature-toggles', JSON.stringify(toggles));
 }, [toggles]);

 const updateToggle = (feature: keyof FeatureToggles, enabled: boolean) => {
 setToggles(prev => ({
 ...prev,
 [feature]: enabled
 }));
 };

 const resetToDefaults = () => {
 setToggles(DEFAULT_TOGGLES);
 localStorage.removeItem('feature-toggles');
 };

 return (
 <FeatureTogglesContext.Provider value={{ toggles, updateToggle, resetToDefaults }}>
 {children}
 </FeatureTogglesContext.Provider>
 );
}

export function useFeatureToggles() {
 const context = useContext(FeatureTogglesContext);
 if (!context) {
 throw new Error('useFeatureToggles must be used within a FeatureTogglesProvider');
 }
 return context;
}