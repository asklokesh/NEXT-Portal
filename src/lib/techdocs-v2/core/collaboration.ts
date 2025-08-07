/**
 * TechDocs v2 Real-time Collaborative Editing System
 * Revolutionary operational transform-based collaborative editing
 */

import { EventEmitter } from 'events';
import {
  CollaborationState,
  CollaborativeUser,
  ChangeEvent,
  TextOperation,
  UserCursor,
  Comment,
  Suggestion,
  OperationType,
  TechDocument,
  DocumentBlock,
} from '../types';

export class CollaborativeEditingEngine extends EventEmitter {
  private documents: Map<string, CollaborationDocument> = new Map();
  private operationBuffer: Map<string, OperationBuffer> = new Map();
  private conflictResolver: ConflictResolver;
  private transformEngine: OperationalTransformEngine;
  private presenceManager: PresenceManager;

  constructor() {
    super();
    this.conflictResolver = new ConflictResolver();
    this.transformEngine = new OperationalTransformEngine();
    this.presenceManager = new PresenceManager();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Setup WebSocket connections for real-time sync
    await this.setupRealtimeConnections();
    
    // Initialize conflict resolution strategies
    await this.initializeConflictResolution();
    
    // Setup presence tracking
    await this.initializePresenceTracking();
    
    // Initialize operation buffering
    await this.initializeOperationBuffering();
    
    this.emit('collaboration:ready');
  }

  /**
   * Initialize collaborative editing for a document
   */
  async initializeDocument(
    documentId: string,
    document: TechDocument,
    userId: string
  ): Promise<CollaborationState> {
    const collaborativeDoc: CollaborationDocument = {
      id: documentId,
      document,
      state: document.collaboration,
      operationHistory: [],
      stateVector: new Map(),
      version: 0,
      lastSnapshot: Date.now(),
    };

    this.documents.set(documentId, collaborativeDoc);
    
    // Initialize operation buffer for this document
    this.operationBuffer.set(documentId, new OperationBuffer(documentId));
    
    // Add user to active users
    await this.addActiveUser(documentId, userId);
    
    this.emit('document:collaboration-initialized', { documentId, userId });
    
    return collaborativeDoc.state;
  }

  /**
   * Apply collaborative operation with conflict resolution
   */
  async applyOperation(
    documentId: string,
    operation: CollaborativeOperation
  ): Promise<OperationResult> {
    const startTime = Date.now();
    const collaborativeDoc = this.documents.get(documentId);
    
    if (!collaborativeDoc) {
      throw new Error(`Document ${documentId} not initialized for collaboration`);
    }

    try {
      // Transform operation against concurrent operations
      const transformedOperation = await this.transformEngine.transform(
        operation,
        collaborativeDoc
      );

      // Apply operation to document
      const result = await this.applyOperationToDocument(
        collaborativeDoc,
        transformedOperation
      );

      // Update operation history
      collaborativeDoc.operationHistory.push(transformedOperation);
      collaborativeDoc.version++;

      // Broadcast to other users
      await this.broadcastOperation(documentId, transformedOperation, operation.userId);

      // Update user presence
      await this.updateUserPresence(documentId, operation.userId, {
        lastActivity: new Date(),
        currentBlock: transformedOperation.blockId,
      });

      const processingTime = Date.now() - startTime;
      
      this.emit('operation:applied', {
        documentId,
        operation: transformedOperation,
        result,
        processingTime,
      });

      return result;
      
    } catch (error) {
      this.emit('operation:error', { error, documentId, operation });
      throw new Error(`Operation failed: ${error.message}`);
    }
  }

  /**
   * Handle cursor movement and selection
   */
  async updateCursor(
    documentId: string,
    userId: string,
    cursor: UserCursor
  ): Promise<void> {
    const collaborativeDoc = this.documents.get(documentId);
    if (!collaborativeDoc) return;

    // Update cursor in collaboration state
    const existingCursorIndex = collaborativeDoc.state.cursors.findIndex(
      c => c.userId === userId
    );

    if (existingCursorIndex >= 0) {
      collaborativeDoc.state.cursors[existingCursorIndex] = cursor;
    } else {
      collaborativeDoc.state.cursors.push(cursor);
    }

    // Broadcast cursor update
    await this.broadcastCursorUpdate(documentId, cursor, userId);
    
    this.emit('cursor:updated', { documentId, userId, cursor });
  }

  /**
   * Add comment to document
   */
  async addComment(
    documentId: string,
    userId: string,
    blockId: string,
    content: string,
    replyToId?: string
  ): Promise<Comment> {
    const collaborativeDoc = this.documents.get(documentId);
    if (!collaborativeDoc) {
      throw new Error(`Document ${documentId} not found`);
    }

    const comment: Comment = {
      id: this.generateId(),
      userId,
      blockId,
      content,
      resolved: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      replies: [],
    };

    if (replyToId) {
      // Find parent comment and add as reply
      const parentComment = collaborativeDoc.state.comments.find(c => c.id === replyToId);
      if (parentComment) {
        parentComment.replies.push(comment);
      }
    } else {
      collaborativeDoc.state.comments.push(comment);
    }

    // Broadcast comment addition
    await this.broadcastCommentUpdate(documentId, comment, 'added');
    
    this.emit('comment:added', { documentId, comment });
    
    return comment;
  }

  /**
   * Add suggestion for content improvement
   */
  async addSuggestion(
    documentId: string,
    userId: string,
    suggestion: Omit<Suggestion, 'id' | 'userId' | 'createdAt' | 'status'>
  ): Promise<Suggestion> {
    const collaborativeDoc = this.documents.get(documentId);
    if (!collaborativeDoc) {
      throw new Error(`Document ${documentId} not found`);
    }

    const fullSuggestion: Suggestion = {
      ...suggestion,
      id: this.generateId(),
      userId,
      status: 'pending',
      createdAt: new Date(),
    };

    collaborativeDoc.state.suggestions.push(fullSuggestion);

    // Broadcast suggestion
    await this.broadcastSuggestionUpdate(documentId, fullSuggestion, 'added');
    
    this.emit('suggestion:added', { documentId, suggestion: fullSuggestion });
    
    return fullSuggestion;
  }

  /**
   * Accept or reject a suggestion
   */
  async handleSuggestion(
    documentId: string,
    suggestionId: string,
    action: 'accept' | 'reject',
    userId: string
  ): Promise<void> {
    const collaborativeDoc = this.documents.get(documentId);
    if (!collaborativeDoc) {
      throw new Error(`Document ${documentId} not found`);
    }

    const suggestion = collaborativeDoc.state.suggestions.find(s => s.id === suggestionId);
    if (!suggestion) {
      throw new Error(`Suggestion ${suggestionId} not found`);
    }

    suggestion.status = action === 'accept' ? 'accepted' : 'rejected';

    if (action === 'accept') {
      // Apply suggestion as an operation
      const operation: CollaborativeOperation = {
        id: this.generateId(),
        userId,
        timestamp: new Date(),
        type: 'replace',
        blockId: suggestion.blockId,
        operations: [{
          delete: suggestion.original.length,
          insert: suggestion.suggested,
        }],
        metadata: {
          source: 'suggestion',
          suggestionId,
        },
      };

      await this.applyOperation(documentId, operation);
    }

    // Broadcast suggestion handling
    await this.broadcastSuggestionUpdate(documentId, suggestion, action);
    
    this.emit('suggestion:handled', { documentId, suggestionId, action });
  }

  /**
   * Get collaboration state for a document
   */
  getCollaborationState(documentId: string): CollaborationState | null {
    const collaborativeDoc = this.documents.get(documentId);
    return collaborativeDoc?.state || null;
  }

  /**
   * Get document history for a specific time range
   */
  async getDocumentHistory(
    documentId: string,
    startTime: Date,
    endTime: Date
  ): Promise<ChangeEvent[]> {
    const collaborativeDoc = this.documents.get(documentId);
    if (!collaborativeDoc) {
      throw new Error(`Document ${documentId} not found`);
    }

    return collaborativeDoc.state.recentChanges.filter(
      change => change.timestamp >= startTime && change.timestamp <= endTime
    );
  }

  /**
   * Generate document snapshot for conflict resolution
   */
  async createSnapshot(documentId: string): Promise<DocumentSnapshot> {
    const collaborativeDoc = this.documents.get(documentId);
    if (!collaborativeDoc) {
      throw new Error(`Document ${documentId} not found`);
    }

    const snapshot: DocumentSnapshot = {
      documentId,
      version: collaborativeDoc.version,
      timestamp: new Date(),
      content: JSON.parse(JSON.stringify(collaborativeDoc.document.content)),
      stateVector: new Map(collaborativeDoc.stateVector),
      operationHistory: collaborativeDoc.operationHistory.slice(-100), // Keep last 100 ops
    };

    collaborativeDoc.lastSnapshot = Date.now();
    
    this.emit('snapshot:created', { documentId, snapshot });
    
    return snapshot;
  }

  // Private implementation methods
  private async setupRealtimeConnections(): Promise<void> {
    // Setup WebSocket or Socket.IO connections for real-time collaboration
    // This would integrate with the existing WebSocket infrastructure
  }

  private async initializeConflictResolution(): Promise<void> {
    // Setup conflict resolution strategies
    this.conflictResolver.addStrategy('last-write-wins', new LastWriteWinsStrategy());
    this.conflictResolver.addStrategy('operational-transform', new OperationalTransformStrategy());
    this.conflictResolver.addStrategy('three-way-merge', new ThreeWayMergeStrategy());
  }

  private async initializePresenceTracking(): Promise<void> {
    // Setup user presence tracking
    setInterval(() => {
      this.cleanupInactiveUsers();
    }, 30000); // Clean up every 30 seconds
  }

  private async initializeOperationBuffering(): Promise<void> {
    // Setup operation buffering for performance
    setInterval(() => {
      this.flushOperationBuffers();
    }, 100); // Flush buffers every 100ms
  }

  private async addActiveUser(documentId: string, userId: string): Promise<void> {
    const collaborativeDoc = this.documents.get(documentId);
    if (!collaborativeDoc) return;

    const existingUser = collaborativeDoc.state.activeUsers.find(u => u.id === userId);
    if (existingUser) {
      existingUser.isActive = true;
      existingUser.lastSeen = new Date();
      return;
    }

    // Add new user (in a real implementation, you'd fetch user details)
    const user: CollaborativeUser = {
      id: userId,
      name: `User ${userId}`, // Would fetch from user service
      avatar: '/default-avatar.png',
      color: this.generateUserColor(userId),
      isActive: true,
      lastSeen: new Date(),
      permissions: {
        canEdit: true,
        canComment: true,
        canSuggest: true,
        canPublish: false,
        canManageUsers: false,
      },
    };

    collaborativeDoc.state.activeUsers.push(user);
    
    this.emit('user:joined', { documentId, user });
  }

  private async applyOperationToDocument(
    collaborativeDoc: CollaborationDocument,
    operation: CollaborativeOperation
  ): Promise<OperationResult> {
    const block = collaborativeDoc.document.content.blocks.find(
      b => b.id === operation.blockId
    );

    if (!block) {
      throw new Error(`Block ${operation.blockId} not found`);
    }

    // Apply text operations to block content
    let content = this.getBlockTextContent(block);
    let offset = 0;

    for (const textOp of operation.operations) {
      if (textOp.retain !== undefined) {
        offset += textOp.retain;
      } else if (textOp.insert !== undefined) {
        content = content.slice(0, offset) + textOp.insert + content.slice(offset);
        offset += textOp.insert.length;
      } else if (textOp.delete !== undefined) {
        content = content.slice(0, offset) + content.slice(offset + textOp.delete);
      }
    }

    // Update block content
    this.setBlockTextContent(block, content);

    // Create change event
    const changeEvent: ChangeEvent = {
      id: operation.id,
      userId: operation.userId,
      timestamp: operation.timestamp,
      operation: operation.type,
      blockId: operation.blockId,
      changes: operation.operations,
      metadata: {
        significance: 'minor',
        category: 'content',
        automated: false,
      },
    };

    // Add to recent changes
    collaborativeDoc.state.recentChanges.push(changeEvent);
    
    // Keep only recent changes (last 100)
    if (collaborativeDoc.state.recentChanges.length > 100) {
      collaborativeDoc.state.recentChanges = collaborativeDoc.state.recentChanges.slice(-100);
    }

    return {
      success: true,
      changeEvent,
      updatedBlock: block,
    };
  }

  private getBlockTextContent(block: DocumentBlock): string {
    if (block.type === 'text') {
      return block.content.text || '';
    } else if (block.type === 'code') {
      return block.content.code || '';
    }
    return JSON.stringify(block.content);
  }

  private setBlockTextContent(block: DocumentBlock, content: string): void {
    if (block.type === 'text') {
      block.content.text = content;
    } else if (block.type === 'code') {
      block.content.code = content;
    }
    // Update last modified
    block.metadata!.lastModified = new Date();
  }

  private async broadcastOperation(
    documentId: string,
    operation: CollaborativeOperation,
    excludeUserId: string
  ): Promise<void> {
    // Broadcast operation to all active users except the sender
    const collaborativeDoc = this.documents.get(documentId);
    if (!collaborativeDoc) return;

    const activeUsers = collaborativeDoc.state.activeUsers.filter(
      user => user.id !== excludeUserId && user.isActive
    );

    for (const user of activeUsers) {
      this.emit('broadcast:operation', {
        documentId,
        operation,
        targetUserId: user.id,
      });
    }
  }

  private async broadcastCursorUpdate(
    documentId: string,
    cursor: UserCursor,
    excludeUserId: string
  ): Promise<void> {
    // Broadcast cursor update to all active users
    this.emit('broadcast:cursor', {
      documentId,
      cursor,
      excludeUserId,
    });
  }

  private async broadcastCommentUpdate(
    documentId: string,
    comment: Comment,
    action: 'added' | 'updated' | 'deleted'
  ): Promise<void> {
    this.emit('broadcast:comment', {
      documentId,
      comment,
      action,
    });
  }

  private async broadcastSuggestionUpdate(
    documentId: string,
    suggestion: Suggestion,
    action: 'added' | 'accept' | 'reject'
  ): Promise<void> {
    this.emit('broadcast:suggestion', {
      documentId,
      suggestion,
      action,
    });
  }

  private cleanupInactiveUsers(): void {
    const now = Date.now();
    const inactivityThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [documentId, collaborativeDoc] of this.documents) {
      const activeUsers = collaborativeDoc.state.activeUsers.filter(user => {
        const lastSeen = user.lastSeen.getTime();
        const isActive = (now - lastSeen) < inactivityThreshold;
        
        if (!isActive && user.isActive) {
          this.emit('user:left', { documentId, userId: user.id });
        }
        
        user.isActive = isActive;
        return isActive || (now - lastSeen) < (24 * 60 * 60 * 1000); // Keep for 24h
      });

      collaborativeDoc.state.activeUsers = activeUsers;
    }
  }

  private flushOperationBuffers(): void {
    for (const [documentId, buffer] of this.operationBuffer) {
      buffer.flush();
    }
  }

  private generateUserColor(userId: string): string {
    // Generate consistent color for user based on ID
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    ];
    const hash = userId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  }

  private generateId(): string {
    return `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Operational Transform Engine
class OperationalTransformEngine {
  async transform(
    operation: CollaborativeOperation,
    collaborativeDoc: CollaborationDocument
  ): Promise<CollaborativeOperation> {
    // Get concurrent operations since this operation's base version
    const concurrentOps = this.getConcurrentOperations(operation, collaborativeDoc);
    
    if (concurrentOps.length === 0) {
      return operation;
    }

    // Transform operation against concurrent operations
    let transformedOp = operation;
    for (const concurrentOp of concurrentOps) {
      transformedOp = await this.transformAgainst(transformedOp, concurrentOp);
    }

    return transformedOp;
  }

  private getConcurrentOperations(
    operation: CollaborativeOperation,
    collaborativeDoc: CollaborationDocument
  ): CollaborativeOperation[] {
    // In a real implementation, this would use vector clocks or similar
    return collaborativeDoc.operationHistory.filter(
      op => op.timestamp >= operation.timestamp && op.id !== operation.id
    );
  }

  private async transformAgainst(
    op1: CollaborativeOperation,
    op2: CollaborativeOperation
  ): Promise<CollaborativeOperation> {
    // Implement operational transform algorithm (e.g., Jupiter or Google Wave OT)
    if (op1.blockId !== op2.blockId) {
      return op1; // Operations on different blocks don't conflict
    }

    // Transform text operations
    const transformedOps = this.transformTextOperations(op1.operations, op2.operations);
    
    return {
      ...op1,
      operations: transformedOps,
    };
  }

  private transformTextOperations(
    ops1: TextOperation[],
    ops2: TextOperation[]
  ): TextOperation[] {
    // Implement text operation transformation
    // This is a simplified version - real OT is more complex
    return ops1; // Placeholder
  }
}

// Conflict Resolution System
class ConflictResolver {
  private strategies: Map<string, ConflictResolutionStrategy> = new Map();

  addStrategy(name: string, strategy: ConflictResolutionStrategy): void {
    this.strategies.set(name, strategy);
  }

  async resolveConflict(
    conflict: OperationalConflict,
    strategyName: string = 'operational-transform'
  ): Promise<ConflictResolution> {
    const strategy = this.strategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Strategy ${strategyName} not found`);
    }

    return await strategy.resolve(conflict);
  }
}

// Presence Management
class PresenceManager {
  private presenceData: Map<string, Map<string, UserPresence>> = new Map();

  updatePresence(documentId: string, userId: string, presence: Partial<UserPresence>): void {
    if (!this.presenceData.has(documentId)) {
      this.presenceData.set(documentId, new Map());
    }

    const docPresence = this.presenceData.get(documentId)!;
    const currentPresence = docPresence.get(userId) || {
      userId,
      lastActivity: new Date(),
      isTyping: false,
      currentBlock: null,
      isActive: true,
    };

    docPresence.set(userId, { ...currentPresence, ...presence });
  }

  getPresence(documentId: string, userId: string): UserPresence | null {
    return this.presenceData.get(documentId)?.get(userId) || null;
  }

  getAllPresence(documentId: string): UserPresence[] {
    const docPresence = this.presenceData.get(documentId);
    if (!docPresence) return [];
    
    return Array.from(docPresence.values());
  }
}

// Operation Buffer for performance optimization
class OperationBuffer {
  private documentId: string;
  private buffer: CollaborativeOperation[] = [];
  private flushInterval: number = 100;

  constructor(documentId: string) {
    this.documentId = documentId;
  }

  add(operation: CollaborativeOperation): void {
    this.buffer.push(operation);
  }

  flush(): CollaborativeOperation[] {
    const operations = this.buffer.slice();
    this.buffer = [];
    return operations;
  }

  size(): number {
    return this.buffer.length;
  }
}

// Conflict Resolution Strategies
abstract class ConflictResolutionStrategy {
  abstract resolve(conflict: OperationalConflict): Promise<ConflictResolution>;
}

class LastWriteWinsStrategy extends ConflictResolutionStrategy {
  async resolve(conflict: OperationalConflict): Promise<ConflictResolution> {
    // Simply use the operation with the latest timestamp
    const winner = conflict.operations.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );

    return {
      resolution: 'last-write-wins',
      winningOperation: winner,
      discardedOperations: conflict.operations.filter(op => op.id !== winner.id),
    };
  }
}

class OperationalTransformStrategy extends ConflictResolutionStrategy {
  async resolve(conflict: OperationalConflict): Promise<ConflictResolution> {
    // Use operational transform to merge conflicting operations
    const transformEngine = new OperationalTransformEngine();
    // Implementation would transform all operations against each other
    return {
      resolution: 'operational-transform',
      transformedOperations: conflict.operations, // Placeholder
      mergedResult: null,
    };
  }
}

class ThreeWayMergeStrategy extends ConflictResolutionStrategy {
  async resolve(conflict: OperationalConflict): Promise<ConflictResolution> {
    // Perform three-way merge using common ancestor
    return {
      resolution: 'three-way-merge',
      mergedResult: null, // Would contain merged content
    };
  }
}

// Types for collaboration system
interface CollaborationDocument {
  id: string;
  document: TechDocument;
  state: CollaborationState;
  operationHistory: CollaborativeOperation[];
  stateVector: Map<string, number>;
  version: number;
  lastSnapshot: number;
}

export interface CollaborativeOperation {
  id: string;
  userId: string;
  timestamp: Date;
  type: OperationType;
  blockId: string;
  operations: TextOperation[];
  metadata?: {
    source?: string;
    suggestionId?: string;
    significance?: 'minor' | 'major' | 'breaking';
    category?: 'content' | 'structure' | 'metadata';
    automated?: boolean;
  };
}

interface OperationResult {
  success: boolean;
  changeEvent: ChangeEvent;
  updatedBlock: DocumentBlock;
  conflicts?: OperationalConflict[];
}

interface DocumentSnapshot {
  documentId: string;
  version: number;
  timestamp: Date;
  content: any;
  stateVector: Map<string, number>;
  operationHistory: CollaborativeOperation[];
}

interface UserPresence {
  userId: string;
  lastActivity: Date;
  isTyping: boolean;
  currentBlock: string | null;
  isActive: boolean;
}

interface OperationalConflict {
  blockId: string;
  operations: CollaborativeOperation[];
  type: 'concurrent-edit' | 'structure-change' | 'permission-conflict';
}

interface ConflictResolution {
  resolution: string;
  winningOperation?: CollaborativeOperation;
  discardedOperations?: CollaborativeOperation[];
  transformedOperations?: CollaborativeOperation[];
  mergedResult?: any;
}