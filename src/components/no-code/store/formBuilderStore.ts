/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { produce } from 'immer';
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import type { 
 FormBuilderState, 
 FormField, 
 FieldPosition,
 ValidationResult,
 PreviewData,
 BackstageSchema 
} from '../types';

interface FormBuilderStore extends FormBuilderState {
 // Actions
 addField: (field: FormField) => void;
 updateField: (fieldId: string, updates: Partial<FormField>) => void;
 deleteField: (fieldId: string) => void;
 selectField: (fieldId: string | null) => void;
 moveField: (fieldId: string, position: FieldPosition) => void;
 duplicateField: (fieldId: string) => void;
 reorderFields: (fieldIds: string[]) => void;
 
 // Canvas actions
 setCanvasSize: (size: { width: number; height: number }) => void;
 setGridSize: (size: number) => void;
 toggleSnapToGrid: () => void;
 toggleShowGrid: () => void;
 setZoom: (zoom: number) => void;
 setMode: (mode: 'design' | 'preview' | 'code') => void;
 
 // State management
 clearForm: () => void;
 loadForm: (schema: BackstageSchema) => void;
 getFormData: () => FormField[];
 getSelectedField: () => FormField | null;
 
 // Validation
 validateForm: () => ValidationResult;
 validateField: (fieldId: string) => ValidationResult;
 
 // Preview
 generatePreview: () => PreviewData;
 
 // Undo/Redo
 undo: () => void;
 redo: () => void;
 canUndo: () => boolean;
 canRedo: () => boolean;
}

// Initial state
const initialState: FormBuilderState = {
 fields: [],
 selectedFieldId: null,
 canvasSize: { width: 1200, height: 800 },
 gridSize: 20,
 snapToGrid: true,
 showGrid: true,
 zoom: 1,
 mode: 'design',
};

// History management for undo/redo
interface HistoryState {
 past: FormBuilderState[];
 present: FormBuilderState;
 future: FormBuilderState[];
}

const _createHistoryState = (present: FormBuilderState): HistoryState => ({
 past: [],
 present,
 future: [],
});

export const useFormBuilderStore = create<FormBuilderStore>()(
 devtools(
 subscribeWithSelector(
 immer((set, get) => ({
 ...initialState,
 
 // Field management
 addField: (field: FormField) => {
 set((state) => {
 // Ensure unique ID
 const existingIds = state.fields.map(f => f.id);
 let uniqueId = field.id;
 let counter = 1;
 
 while (existingIds.includes(uniqueId)) {
 uniqueId = `${field.id}_${counter}`;
 counter++;
 }
 
 const newField = { ...field, id: uniqueId };
 
 // Auto-position if no position specified
 if (!newField.position || (newField.position.x === 0 && newField.position.y === 0)) {
 const occupiedPositions = state.fields.map(f => f.position);
 newField.position = findAvailablePosition(occupiedPositions, state.gridSize);
 }
 
 state.fields.push(newField);
 state.selectedFieldId = newField.id;
 });
 },
 
 updateField: (fieldId: string, updates: Partial<FormField>) => {
 set((state) => {
 const fieldIndex = state.fields.findIndex(f => f.id === fieldId);
 if (fieldIndex !== -1) {
 Object.assign(state.fields[fieldIndex], updates);
 }
 });
 },
 
 deleteField: (fieldId: string) => {
 set((state) => {
 state.fields = state.fields.filter(f => f.id !== fieldId);
 if (state.selectedFieldId === fieldId) {
 state.selectedFieldId = null;
 }
 });
 },
 
 selectField: (fieldId: string | null) => {
 set((state) => {
 state.selectedFieldId = fieldId;
 });
 },
 
 moveField: (fieldId: string, position: FieldPosition) => {
 set((state) => {
 const field = state.fields.find(f => f.id === fieldId);
 if (field) {
 if (state.snapToGrid) {
 position.x = Math.round(position.x / state.gridSize) * state.gridSize;
 position.y = Math.round(position.y / state.gridSize) * state.gridSize;
 }
 field.position = position;
 }
 });
 },
 
 duplicateField: (fieldId: string) => {
 set((state) => {
 const field = state.fields.find(f => f.id === fieldId);
 if (field) {
 const duplicatedField = produce(field, (draft) => {
 draft.id = `${field.id}_copy_${Date.now()}`;
 draft.position = {
 ...field.position,
 x: field.position.x + state.gridSize * 2,
 y: field.position.y + state.gridSize * 2,
 };
 });
 
 state.fields.push(duplicatedField);
 state.selectedFieldId = duplicatedField.id;
 }
 });
 },
 
 reorderFields: (fieldIds: string[]) => {
 set((state) => {
 const reorderedFields = fieldIds
 .map(id => state.fields.find(f => f.id === id))
 .filter(Boolean) as FormField[];
 
 state.fields = reorderedFields;
 });
 },
 
 // Canvas actions
 setCanvasSize: (size: { width: number; height: number }) => {
 set((state) => {
 state.canvasSize = size;
 });
 },
 
 setGridSize: (size: number) => {
 set((state) => {
 state.gridSize = Math.max(10, Math.min(50, size));
 });
 },
 
 toggleSnapToGrid: () => {
 set((state) => {
 state.snapToGrid = !state.snapToGrid;
 });
 },
 
 toggleShowGrid: () => {
 set((state) => {
 state.showGrid = !state.showGrid;
 });
 },
 
 setZoom: (zoom: number) => {
 set((state) => {
 state.zoom = Math.max(0.25, Math.min(4, zoom));
 });
 },
 
 setMode: (mode: 'design' | 'preview' | 'code') => {
 set((state) => {
 state.mode = mode;
 });
 },
 
 // State management
 clearForm: () => {
 set((state) => {
 state.fields = [];
 state.selectedFieldId = null;
 });
 },
 
 loadForm: (schema: BackstageSchema) => {
 set((state) => {
 state.fields = schema.fields;
 state.selectedFieldId = null;
 });
 },
 
 getFormData: () => {
 return get().fields;
 },
 
 getSelectedField: () => {
 const state = get();
 return state.fields.find(f => f.id === state.selectedFieldId) || null;
 },
 
 // Validation
 validateForm: (): ValidationResult => {
 const state = get();
 const errors: any[] = [];
 const warnings: any[] = [];
 
 // Validate each field
 state.fields.forEach((field) => {
 const fieldValidation = validateField(field);
 errors.push(...fieldValidation.errors);
 warnings.push(...fieldValidation.warnings);
 });
 
 // Check for overlapping fields
 const overlaps = findOverlappingFields(state.fields);
 overlaps.forEach(({ field1, field2 }) => {
 warnings.push({
 fieldId: field1.id,
 fieldPath: field1.id,
 message: `Field overlaps with ${field2.label || field2.id}`,
 severity: 'warning' as const,
 });
 });
 
 return {
 valid: errors.length === 0,
 errors,
 warnings,
 };
 },
 
 validateField: (fieldId: string): ValidationResult => {
 const state = get();
 const field = state.fields.find(f => f.id === fieldId);
 
 if (!field) {
 return { valid: false, errors: [], warnings: [] };
 }
 
 return validateField(field);
 },
 
 // Preview generation
 generatePreview: (): PreviewData => {
 const state = get();
 return generatePreviewData(state.fields);
 },
 
 // Undo/Redo (placeholder - would need full history implementation)
 undo: () => {
 // TODO: Implement with proper history management
 console.log('Undo not yet implemented');
 },
 
 redo: () => {
 // TODO: Implement with proper history management
 console.log('Redo not yet implemented');
 },
 
 canUndo: () => false,
 canRedo: () => false,
 }))
 ),
 { name: 'form-builder-store' }
 )
);

// Helper functions
function findAvailablePosition(
 occupiedPositions: FieldPosition[], 
 gridSize: number
): FieldPosition {
 const defaultWidth = gridSize * 6; // 6 grid units wide
 const defaultHeight = gridSize * 2; // 2 grid units tall
 
 for (let y = 0; y < 2000; y += gridSize) {
 for (let x = 0; x < 1200; x += gridSize) {
 const candidate = { x, y, width: defaultWidth, height: defaultHeight };
 
 const overlaps = occupiedPositions.some(pos => 
 doPositionsOverlap(candidate, pos)
 );
 
 if (!overlaps) {
 return candidate;
 }
 }
 }
 
 // Fallback: stack vertically
 const maxY = Math.max(0, ...occupiedPositions.map(p => p.y + p.height));
 return { 
 x: 0, 
 y: maxY + gridSize, 
 width: defaultWidth, 
 height: defaultHeight 
 };
}

function doPositionsOverlap(pos1: FieldPosition, pos2: FieldPosition): boolean {
 return !(
 pos1.x + pos1.width <= pos2.x ||
 pos2.x + pos2.width <= pos1.x ||
 pos1.y + pos1.height <= pos2.y ||
 pos2.y + pos2.height <= pos1.y
 );
}

function findOverlappingFields(fields: FormField[]): Array<{ field1: FormField; field2: FormField }> {
 const overlaps: Array<{ field1: FormField; field2: FormField }> = [];
 
 for (let i = 0; i < fields.length; i++) {
 for (let j = i + 1; j < fields.length; j++) {
 if (doPositionsOverlap(fields[i].position, fields[j].position)) {
 overlaps.push({ field1: fields[i], field2: fields[j] });
 }
 }
 }
 
 return overlaps;
}

function validateField(field: FormField): ValidationResult {
 const errors: any[] = [];
 const warnings: any[] = [];
 
 // Basic validation
 if (!field.label) {
 errors.push({
 fieldId: field.id,
 fieldPath: `${field.id}.label`,
 message: 'Field label is required',
 severity: 'error' as const,
 });
 }
 
 if (!field.backstageMapping) {
 warnings.push({
 fieldId: field.id,
 fieldPath: `${field.id}.backstageMapping`,
 message: 'No Backstage mapping specified',
 severity: 'warning' as const,
 });
 }
 
 // Type-specific validation
 switch (field.type) {
 case 'select':
 const selectField = field as any;
 if (!selectField.options || selectField.options.length === 0) {
 errors.push({
 fieldId: field.id,
 fieldPath: `${field.id}.options`,
 message: 'Select field requires at least one option',
 severity: 'error' as const,
 });
 }
 break;
 
 case 'array':
 const arrayField = field as any;
 if (arrayField.maxItems && arrayField.minItems && arrayField.maxItems < arrayField.minItems) {
 errors.push({
 fieldId: field.id,
 fieldPath: `${field.id}.items`,
 message: 'Maximum items cannot be less than minimum items',
 severity: 'error' as const,
 });
 }
 break;
 }
 
 return {
 valid: errors.length === 0,
 errors,
 warnings,
 };
}

function generatePreviewData(fields: FormField[]): PreviewData {
 // Convert fields to Backstage entity structure
 const backstageEntity: Record<string, unknown> = {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {},
 spec: {},
 };
 
 fields.forEach((field) => {
 if (field.backstageMapping) {
 setNestedProperty(backstageEntity, field.backstageMapping, field.defaultValue || '');
 }
 });
 
 // Generate YAML
 const yaml = `# Generated by Backstage IDP Wrapper
apiVersion: ${backstageEntity.apiVersion}
kind: ${backstageEntity.kind}
metadata:
${Object.entries(backstageEntity.metadata as object)
 .map(([key, value]) => ` ${key}: ${JSON.stringify(value)}`)
 .join('\n')}
spec:
${Object.entries(backstageEntity.spec as object)
 .map(([key, value]) => ` ${key}: ${JSON.stringify(value)}`)
 .join('\n')}`;
 
 return {
 yaml,
 json: backstageEntity,
 backstageEntity,
 };
}

function setNestedProperty(obj: Record<string, unknown>, path: string, value: unknown): void {
 const keys = path.split('.');
 let current = obj;
 
 for (let i = 0; i < keys.length - 1; i++) {
 const key = keys[i];
 if (!(key in current) || typeof current[key] !== 'object') {
 current[key] = {};
 }
 current = current[key] as Record<string, unknown>;
 }
 
 current[keys[keys.length - 1]] = value;
}