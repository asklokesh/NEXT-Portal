import { ScaffolderTemplate, VisualComponent, Connection, TemplateStep, TemplateParameter } from './types';

export class VisualTemplateBuilder {
  private static instance: VisualTemplateBuilder;
  private canvas: VisualCanvas;
  private componentLibrary: ComponentLibrary;
  private stateManager: BuilderStateManager;

  private constructor() {
    this.canvas = new VisualCanvas();
    this.componentLibrary = new ComponentLibrary();
    this.stateManager = new BuilderStateManager();
  }

  static getInstance(): VisualTemplateBuilder {
    if (!this.instance) {
      this.instance = new VisualTemplateBuilder();
    }
    return this.instance;
  }

  /**
   * Initialize visual builder with existing template
   */
  async initializeFromTemplate(template?: ScaffolderTemplate): Promise<void> {
    if (template?.visual) {
      await this.canvas.loadComponents(template.visual.components);
      await this.canvas.loadConnections(template.visual.connections);
    } else if (template?.spec.steps) {
      // Convert traditional steps to visual components
      const components = await this.convertStepsToVisual(template.spec.steps);
      await this.canvas.loadComponents(components);
    } else {
      // Start with empty canvas
      await this.canvas.clear();
    }

    this.stateManager.initialize(template);
  }

  /**
   * Get available component types for the palette
   */
  getComponentPalette(): ComponentPaletteItem[] {
    return this.componentLibrary.getAllComponents();
  }

  /**
   * Add component to canvas
   */
  async addComponent(type: string, position: { x: number; y: number }, data?: any): Promise<string> {
    const component = await this.componentLibrary.createComponent(type, position, data);
    const componentId = await this.canvas.addComponent(component);
    
    this.stateManager.addOperation({
      type: 'ADD_COMPONENT',
      componentId,
      component
    });

    return componentId;
  }

  /**
   * Update component properties
   */
  async updateComponent(componentId: string, updates: Partial<VisualComponent>): Promise<void> {
    const oldComponent = this.canvas.getComponent(componentId);
    await this.canvas.updateComponent(componentId, updates);
    
    this.stateManager.addOperation({
      type: 'UPDATE_COMPONENT',
      componentId,
      oldComponent,
      updates
    });
  }

  /**
   * Remove component from canvas
   */
  async removeComponent(componentId: string): Promise<void> {
    const component = this.canvas.getComponent(componentId);
    const connections = this.canvas.getConnectionsForComponent(componentId);
    
    await this.canvas.removeComponent(componentId);
    
    this.stateManager.addOperation({
      type: 'REMOVE_COMPONENT',
      componentId,
      component,
      connections
    });
  }

  /**
   * Create connection between components
   */
  async createConnection(sourceId: string, targetId: string, type?: string): Promise<string> {
    const connection: Connection = {
      id: `conn_${Date.now()}`,
      source: sourceId,
      target: targetId,
      type: type || 'success'
    };

    const connectionId = await this.canvas.addConnection(connection);
    
    this.stateManager.addOperation({
      type: 'ADD_CONNECTION',
      connectionId,
      connection
    });

    return connectionId;
  }

  /**
   * Remove connection
   */
  async removeConnection(connectionId: string): Promise<void> {
    const connection = this.canvas.getConnection(connectionId);
    await this.canvas.removeConnection(connectionId);
    
    this.stateManager.addOperation({
      type: 'REMOVE_CONNECTION',
      connectionId,
      connection
    });
  }

  /**
   * Validate visual template
   */
  async validate(): Promise<ValidationResult> {
    const components = this.canvas.getAllComponents();
    const connections = this.canvas.getAllConnections();
    
    const validator = new VisualTemplateValidator();
    return await validator.validate(components, connections);
  }

  /**
   * Convert visual design to template specification
   */
  async generateTemplate(): Promise<ScaffolderTemplate> {
    const components = this.canvas.getAllComponents();
    const connections = this.canvas.getAllConnections();
    
    const converter = new VisualToSpecConverter();
    const spec = await converter.convert(components, connections);
    
    const template: ScaffolderTemplate = {
      id: `visual-template-${Date.now()}`,
      name: 'Visual Template',
      description: 'Template created with visual builder',
      version: '1.0.0',
      category: 'Visual',
      tags: ['visual', 'drag-drop'],
      author: {
        name: 'Visual Builder',
        email: 'visual@saas-idp.com'
      },
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        downloads: 0,
        rating: 0,
        complexity: this.calculateComplexity(components),
        estimatedTime: this.estimateExecutionTime(components)
      },
      spec,
      visual: {
        components,
        connections
      }
    };

    return template;
  }

  /**
   * Undo last operation
   */
  async undo(): Promise<void> {
    const operation = this.stateManager.undo();
    if (operation) {
      await this.applyOperation(operation, true);
    }
  }

  /**
   * Redo last undone operation
   */
  async redo(): Promise<void> {
    const operation = this.stateManager.redo();
    if (operation) {
      await this.applyOperation(operation, false);
    }
  }

  /**
   * Auto-arrange components using AI layout algorithm
   */
  async autoArrange(): Promise<void> {
    const components = this.canvas.getAllComponents();
    const connections = this.canvas.getAllConnections();
    
    const layoutEngine = new AILayoutEngine();
    const newLayout = await layoutEngine.arrange(components, connections);
    
    for (const component of newLayout) {
      await this.canvas.updateComponent(component.id, {
        position: component.position
      });
    }
  }

  /**
   * Smart connect - AI-powered connection suggestions
   */
  async suggestConnections(componentId: string): Promise<ConnectionSuggestion[]> {
    const component = this.canvas.getComponent(componentId);
    const allComponents = this.canvas.getAllComponents();
    const existingConnections = this.canvas.getAllConnections();
    
    const suggestionEngine = new ConnectionSuggestionEngine();
    return await suggestionEngine.suggest(component, allComponents, existingConnections);
  }

  /**
   * Export visual template as various formats
   */
  async export(format: 'json' | 'yaml' | 'backstage' | 'image'): Promise<string | Blob> {
    const template = await this.generateTemplate();
    const exporter = new TemplateExporter();
    
    switch (format) {
      case 'json':
        return JSON.stringify(template, null, 2);
      case 'yaml':
        return exporter.toYAML(template);
      case 'backstage':
        return exporter.toBackstageYAML(template);
      case 'image':
        return await this.canvas.exportAsImage();
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Private helper methods
  private async convertStepsToVisual(steps: TemplateStep[]): Promise<VisualComponent[]> {
    const components: VisualComponent[] = [];
    let yOffset = 100;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const component: VisualComponent = {
        id: `step_${step.id}`,
        type: this.mapActionToComponentType(step.action),
        position: { x: 200, y: yOffset },
        data: {
          name: step.name,
          action: step.action,
          input: step.input,
          stepIndex: i
        },
        size: { width: 200, height: 80 }
      };

      components.push(component);
      yOffset += 120;
    }

    return components;
  }

  private mapActionToComponentType(action: string): string {
    const actionMap: Record<string, string> = {
      'github:repo:create': 'repository',
      'fetch:template': 'template',
      'fs:rename': 'file-operation',
      'fs:delete': 'file-operation',
      'publish:github': 'deployment',
      'publish:gitlab': 'deployment',
      'catalog:register': 'catalog'
    };

    return actionMap[action] || 'action';
  }

  private calculateComplexity(components: VisualComponent[]): 'simple' | 'medium' | 'complex' {
    const componentCount = components.length;
    if (componentCount <= 5) return 'simple';
    if (componentCount <= 15) return 'medium';
    return 'complex';
  }

  private estimateExecutionTime(components: VisualComponent[]): string {
    const baseTime = components.length * 30; // 30 seconds per component
    
    if (baseTime < 300) return '< 5 minutes';
    if (baseTime < 900) return '5-15 minutes';
    if (baseTime < 1800) return '15-30 minutes';
    return '30+ minutes';
  }

  private async applyOperation(operation: BuilderOperation, reverse: boolean): Promise<void> {
    switch (operation.type) {
      case 'ADD_COMPONENT':
        if (reverse) {
          await this.canvas.removeComponent(operation.componentId);
        } else {
          await this.canvas.addComponent(operation.component);
        }
        break;
      case 'REMOVE_COMPONENT':
        if (reverse) {
          await this.canvas.addComponent(operation.component);
          for (const conn of operation.connections) {
            await this.canvas.addConnection(conn);
          }
        } else {
          await this.canvas.removeComponent(operation.componentId);
        }
        break;
      case 'UPDATE_COMPONENT':
        if (reverse) {
          await this.canvas.updateComponent(operation.componentId, operation.oldComponent);
        } else {
          await this.canvas.updateComponent(operation.componentId, operation.updates);
        }
        break;
      case 'ADD_CONNECTION':
        if (reverse) {
          await this.canvas.removeConnection(operation.connectionId);
        } else {
          await this.canvas.addConnection(operation.connection);
        }
        break;
      case 'REMOVE_CONNECTION':
        if (reverse) {
          await this.canvas.addConnection(operation.connection);
        } else {
          await this.canvas.removeConnection(operation.connectionId);
        }
        break;
    }
  }
}

// Supporting classes
class VisualCanvas {
  private components: Map<string, VisualComponent> = new Map();
  private connections: Map<string, Connection> = new Map();

  async loadComponents(components: VisualComponent[]): Promise<void> {
    this.components.clear();
    for (const component of components) {
      this.components.set(component.id, component);
    }
  }

  async loadConnections(connections: Connection[]): Promise<void> {
    this.connections.clear();
    for (const connection of connections) {
      this.connections.set(connection.id, connection);
    }
  }

  async clear(): Promise<void> {
    this.components.clear();
    this.connections.clear();
  }

  async addComponent(component: VisualComponent): Promise<string> {
    this.components.set(component.id, component);
    return component.id;
  }

  async updateComponent(componentId: string, updates: Partial<VisualComponent>): Promise<void> {
    const existing = this.components.get(componentId);
    if (existing) {
      this.components.set(componentId, { ...existing, ...updates });
    }
  }

  async removeComponent(componentId: string): Promise<void> {
    this.components.delete(componentId);
    // Remove associated connections
    const toRemove = Array.from(this.connections.values())
      .filter(conn => conn.source === componentId || conn.target === componentId)
      .map(conn => conn.id);
    
    for (const id of toRemove) {
      this.connections.delete(id);
    }
  }

  getComponent(componentId: string): VisualComponent | undefined {
    return this.components.get(componentId);
  }

  getAllComponents(): VisualComponent[] {
    return Array.from(this.components.values());
  }

  async addConnection(connection: Connection): Promise<string> {
    this.connections.set(connection.id, connection);
    return connection.id;
  }

  async removeConnection(connectionId: string): Promise<void> {
    this.connections.delete(connectionId);
  }

  getConnection(connectionId: string): Connection | undefined {
    return this.connections.get(connectionId);
  }

  getAllConnections(): Connection[] {
    return Array.from(this.connections.values());
  }

  getConnectionsForComponent(componentId: string): Connection[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.source === componentId || conn.target === componentId);
  }

  async exportAsImage(): Promise<Blob> {
    // Simulate image export - in real implementation, would use canvas or svg
    const data = JSON.stringify({
      components: this.getAllComponents(),
      connections: this.getAllConnections()
    });
    
    return new Blob([data], { type: 'application/json' });
  }
}

class ComponentLibrary {
  private components: ComponentPaletteItem[] = [
    {
      type: 'input',
      name: 'Input Parameter',
      icon: 'input',
      description: 'Collect user input',
      category: 'Input',
      defaultData: { required: true }
    },
    {
      type: 'repository',
      name: 'Create Repository',
      icon: 'git-branch',
      description: 'Create a new repository',
      category: 'Source Control',
      defaultData: { private: true }
    },
    {
      type: 'template',
      name: 'Fetch Template',
      icon: 'file-template',
      description: 'Fetch and process template files',
      category: 'Generation'
    },
    {
      type: 'action',
      name: 'Custom Action',
      icon: 'play',
      description: 'Execute custom action',
      category: 'Action'
    },
    {
      type: 'condition',
      name: 'Condition',
      icon: 'git-branch',
      description: 'Conditional logic',
      category: 'Flow Control'
    },
    {
      type: 'deployment',
      name: 'Deploy',
      icon: 'rocket',
      description: 'Deploy to target environment',
      category: 'Deployment'
    },
    {
      type: 'catalog',
      name: 'Register in Catalog',
      icon: 'book',
      description: 'Register component in service catalog',
      category: 'Catalog'
    },
    {
      type: 'notification',
      name: 'Send Notification',
      icon: 'bell',
      description: 'Send notification to team',
      category: 'Communication'
    }
  ];

  getAllComponents(): ComponentPaletteItem[] {
    return this.components;
  }

  async createComponent(type: string, position: { x: number; y: number }, data?: any): Promise<VisualComponent> {
    const template = this.components.find(c => c.type === type);
    if (!template) {
      throw new Error(`Unknown component type: ${type}`);
    }

    return {
      id: `${type}_${Date.now()}`,
      type,
      position,
      data: { ...template.defaultData, ...data },
      size: { width: 200, height: 80 }
    };
  }
}

class BuilderStateManager {
  private operations: BuilderOperation[] = [];
  private currentIndex = -1;
  private maxHistorySize = 50;

  initialize(template?: ScaffolderTemplate): void {
    this.operations = [];
    this.currentIndex = -1;
  }

  addOperation(operation: BuilderOperation): void {
    // Remove any operations after current index (when we're in the middle of undo/redo chain)
    this.operations = this.operations.slice(0, this.currentIndex + 1);
    
    // Add new operation
    this.operations.push(operation);
    this.currentIndex++;
    
    // Limit history size
    if (this.operations.length > this.maxHistorySize) {
      this.operations = this.operations.slice(-this.maxHistorySize);
      this.currentIndex = this.operations.length - 1;
    }
  }

  undo(): BuilderOperation | null {
    if (this.currentIndex >= 0) {
      const operation = this.operations[this.currentIndex];
      this.currentIndex--;
      return operation;
    }
    return null;
  }

  redo(): BuilderOperation | null {
    if (this.currentIndex < this.operations.length - 1) {
      this.currentIndex++;
      return this.operations[this.currentIndex];
    }
    return null;
  }

  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.operations.length - 1;
  }
}

// Additional classes and interfaces
interface ComponentPaletteItem {
  type: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  defaultData?: any;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface BuilderOperation {
  type: 'ADD_COMPONENT' | 'REMOVE_COMPONENT' | 'UPDATE_COMPONENT' | 'ADD_CONNECTION' | 'REMOVE_CONNECTION';
  componentId?: string;
  component?: VisualComponent;
  oldComponent?: Partial<VisualComponent>;
  updates?: Partial<VisualComponent>;
  connectionId?: string;
  connection?: Connection;
  connections?: Connection[];
}

interface ConnectionSuggestion {
  targetId: string;
  type: string;
  confidence: number;
  reason: string;
}

class VisualTemplateValidator {
  async validate(components: VisualComponent[], connections: Connection[]): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for orphaned components
    const connectedIds = new Set([
      ...connections.map(c => c.source),
      ...connections.map(c => c.target)
    ]);

    for (const component of components) {
      if (!connectedIds.has(component.id) && components.length > 1) {
        warnings.push(`Component "${component.data?.name || component.id}" is not connected`);
      }
    }

    // Check for cycles
    if (this.hasCycles(components, connections)) {
      errors.push('Template contains circular dependencies');
    }

    // Validate component configurations
    for (const component of components) {
      const componentErrors = await this.validateComponent(component);
      errors.push(...componentErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private hasCycles(components: VisualComponent[], connections: Connection[]): boolean {
    // Simple cycle detection using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const adjacencyList = new Map<string, string[]>();

    // Build adjacency list
    for (const component of components) {
      adjacencyList.set(component.id, []);
    }

    for (const connection of connections) {
      const targets = adjacencyList.get(connection.source) || [];
      targets.push(connection.target);
      adjacencyList.set(connection.source, targets);
    }

    // DFS to detect cycles
    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const component of components) {
      if (!visited.has(component.id)) {
        if (dfs(component.id)) return true;
      }
    }

    return false;
  }

  private async validateComponent(component: VisualComponent): Promise<string[]> {
    const errors: string[] = [];

    // Validate based on component type
    switch (component.type) {
      case 'input':
        if (!component.data?.name) {
          errors.push(`Input component ${component.id} missing name`);
        }
        break;
      case 'repository':
        if (!component.data?.repoName && !component.data?.name) {
          errors.push(`Repository component ${component.id} missing repository name`);
        }
        break;
      case 'template':
        if (!component.data?.url && !component.data?.templatePath) {
          errors.push(`Template component ${component.id} missing template source`);
        }
        break;
    }

    return errors;
  }
}

class VisualToSpecConverter {
  async convert(components: VisualComponent[], connections: Connection[]): Promise<{
    parameters: TemplateParameter[];
    steps: TemplateStep[];
    outputs: any[];
  }> {
    const parameters: TemplateParameter[] = [];
    const steps: TemplateStep[] = [];
    const outputs: any[] = [];

    // Sort components by execution order based on connections
    const orderedComponents = this.topologicalSort(components, connections);

    // Convert components to parameters and steps
    for (const component of orderedComponents) {
      if (component.type === 'input') {
        parameters.push(this.convertToParameter(component));
      } else {
        steps.push(this.convertToStep(component));
      }

      // Add outputs if component produces them
      const componentOutputs = this.extractOutputs(component);
      outputs.push(...componentOutputs);
    }

    return { parameters, steps, outputs };
  }

  private topologicalSort(components: VisualComponent[], connections: Connection[]): VisualComponent[] {
    const sorted: VisualComponent[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();
    const adjacencyList = new Map<string, string[]>();

    // Build adjacency list
    for (const component of components) {
      adjacencyList.set(component.id, []);
    }

    for (const connection of connections) {
      const targets = adjacencyList.get(connection.source) || [];
      targets.push(connection.target);
      adjacencyList.set(connection.source, targets);
    }

    const visit = (componentId: string) => {
      if (temp.has(componentId)) {
        throw new Error('Cycle detected in template');
      }
      if (visited.has(componentId)) return;

      temp.add(componentId);
      const neighbors = adjacencyList.get(componentId) || [];
      for (const neighbor of neighbors) {
        visit(neighbor);
      }
      temp.delete(componentId);
      visited.add(componentId);

      const component = components.find(c => c.id === componentId);
      if (component) {
        sorted.unshift(component);
      }
    };

    for (const component of components) {
      if (!visited.has(component.id)) {
        visit(component.id);
      }
    }

    return sorted;
  }

  private convertToParameter(component: VisualComponent): TemplateParameter {
    return {
      name: component.data.name || component.id,
      title: component.data.title || component.data.name || 'Parameter',
      description: component.data.description || 'Generated parameter',
      type: component.data.type || 'string',
      required: component.data.required || false,
      default: component.data.default,
      validation: component.data.validation,
      ui: component.data.ui
    };
  }

  private convertToStep(component: VisualComponent): TemplateStep {
    return {
      id: component.id,
      name: component.data.name || `Step ${component.id}`,
      action: component.data.action || this.mapComponentTypeToAction(component.type),
      input: component.data.input || component.data
    };
  }

  private mapComponentTypeToAction(type: string): string {
    const actionMap: Record<string, string> = {
      repository: 'github:repo:create',
      template: 'fetch:template',
      deployment: 'publish:github',
      catalog: 'catalog:register',
      notification: 'notification:send'
    };

    return actionMap[type] || 'debug:log';
  }

  private extractOutputs(component: VisualComponent): any[] {
    const outputs: any[] = [];

    if (component.type === 'repository') {
      outputs.push({
        name: 'repositoryUrl',
        description: 'Repository URL',
        type: 'url',
        value: `\${{ steps.${component.id}.output.remoteUrl }}`
      });
    }

    return outputs;
  }
}

class AILayoutEngine {
  async arrange(components: VisualComponent[], connections: Connection[]): Promise<VisualComponent[]> {
    // Implement force-directed layout algorithm
    const arranged = [...components];
    
    // Simple grid layout for now - can be enhanced with more sophisticated algorithms
    const gridSize = Math.ceil(Math.sqrt(components.length));
    const cellWidth = 250;
    const cellHeight = 120;

    arranged.forEach((component, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      
      component.position = {
        x: 50 + col * cellWidth,
        y: 50 + row * cellHeight
      };
    });

    return arranged;
  }
}

class ConnectionSuggestionEngine {
  async suggest(
    component: VisualComponent,
    allComponents: VisualComponent[],
    existingConnections: Connection[]
  ): Promise<ConnectionSuggestion[]> {
    const suggestions: ConnectionSuggestion[] = [];

    // Get components that could connect to this one
    const potentialTargets = allComponents.filter(c => 
      c.id !== component.id && 
      this.canConnect(component, c) &&
      !this.isAlreadyConnected(component.id, c.id, existingConnections)
    );

    for (const target of potentialTargets) {
      const suggestion = this.analyzePotentialConnection(component, target);
      if (suggestion.confidence > 0.3) {
        suggestions.push({
          ...suggestion,
          targetId: target.id
        });
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  private canConnect(source: VisualComponent, target: VisualComponent): boolean {
    // Define connection rules
    const rules: Record<string, string[]> = {
      input: ['template', 'action', 'repository'],
      repository: ['template', 'catalog', 'deployment'],
      template: ['deployment', 'catalog', 'notification'],
      action: ['template', 'deployment', 'notification'],
      deployment: ['catalog', 'notification'],
      catalog: ['notification']
    };

    return rules[source.type]?.includes(target.type) || false;
  }

  private isAlreadyConnected(sourceId: string, targetId: string, connections: Connection[]): boolean {
    return connections.some(c => c.source === sourceId && c.target === targetId);
  }

  private analyzePotentialConnection(source: VisualComponent, target: VisualComponent): Omit<ConnectionSuggestion, 'targetId'> {
    let confidence = 0.5;
    let reason = `${source.type} can connect to ${target.type}`;

    // Boost confidence based on semantic analysis
    if (source.type === 'input' && target.type === 'template') {
      confidence = 0.9;
      reason = 'Input parameters commonly feed into template processing';
    } else if (source.type === 'repository' && target.type === 'catalog') {
      confidence = 0.8;
      reason = 'Created repositories should be registered in the catalog';
    } else if (source.type === 'template' && target.type === 'deployment') {
      confidence = 0.7;
      reason = 'Generated code often needs deployment';
    }

    return {
      type: 'success',
      confidence,
      reason
    };
  }
}

class TemplateExporter {
  toYAML(template: ScaffolderTemplate): string {
    // Convert template to YAML format
    const yamlTemplate = {
      apiVersion: 'scaffolder.backstage.io/v1beta3',
      kind: 'Template',
      metadata: {
        name: template.name.toLowerCase().replace(/\s+/g, '-'),
        title: template.name,
        description: template.description,
        tags: template.tags
      },
      spec: {
        owner: template.author.email,
        type: 'service',
        parameters: this.convertParametersToBackstage(template.spec.parameters),
        steps: this.convertStepsToBackstage(template.spec.steps)
      }
    };

    // Convert to YAML string (simplified - would use yaml library in real implementation)
    return JSON.stringify(yamlTemplate, null, 2);
  }

  toBackstageYAML(template: ScaffolderTemplate): string {
    return this.toYAML(template);
  }

  private convertParametersToBackstage(parameters: TemplateParameter[]): any[] {
    return parameters.map(param => ({
      title: param.title,
      required: param.required ? [param.name] : undefined,
      properties: {
        [param.name]: {
          type: param.type,
          description: param.description,
          default: param.default,
          enum: param.enum,
          'ui:widget': param.ui?.widget
        }
      }
    }));
  }

  private convertStepsToBackstage(steps: TemplateStep[]): any[] {
    return steps.map(step => ({
      id: step.id,
      name: step.name,
      action: step.action,
      input: step.input
    }));
  }
}