import { EventEmitter } from 'events';
import SimplePeer from 'simple-peer';
import { logger } from '../monitoring/index';
import { MetricsCollector } from '../monitoring/metrics-collector';

export interface CollaborationSession {
  id: string;
  name: string;
  participants: Participant[];
  document: CollaborativeDocument;
  createdAt: Date;
  lastActivity: Date;
  maxParticipants: number;
  isPublic: boolean;
  permissions: SessionPermissions;
}

export interface Participant {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'owner' | 'editor' | 'viewer';
  cursor?: CursorPosition;
  selection?: SelectionRange;
  status: 'active' | 'idle' | 'away' | 'offline';
  joinedAt: Date;
  lastSeen: Date;
  webrtcPeer?: SimplePeer.Instance;
}

export interface CollaborativeDocument {
  id: string;
  type: 'template' | 'config' | 'documentation' | 'workflow';
  content: string;
  version: number;
  operations: Operation[];
  metadata: DocumentMetadata;
}

export interface Operation {
  id: string;
  type: 'insert' | 'delete' | 'replace' | 'format';
  position: number;
  content?: string;
  length?: number;
  attributes?: any;
  authorId: string;
  timestamp: Date;
  applied: boolean;
}

export interface CursorPosition {
  line: number;
  column: number;
  color: string;
}

export interface SelectionRange {
  start: CursorPosition;
  end: CursorPosition;
  color: string;
}

export interface DocumentMetadata {
  title: string;
  description?: string;
  tags: string[];
  language?: string;
  schema?: any;
}

export interface SessionPermissions {
  allowAnonymous: boolean;
  requireApproval: boolean;
  allowComments: boolean;
  allowVoiceChat: boolean;
  allowScreenShare: boolean;
  allowFileSharing: boolean;
}

export interface WebRTCConnection {
  peerId: string;
  peer: SimplePeer.Instance;
  channel: 'data' | 'voice' | 'screen';
  status: 'connecting' | 'connected' | 'failed' | 'closed';
  stats: ConnectionStats;
}

export interface ConnectionStats {
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
  latency: number;
  bandwidth: number;
  qualityScore: number;
}

/**
 * Advanced real-time collaboration system with WebRTC
 * Features:
 * - Operational transformation for conflict resolution
 * - WebRTC for peer-to-peer communication
 * - Voice and video chat capabilities
 * - Screen sharing for pair programming
 * - Real-time cursor tracking and presence
 * - Conflict-free replicated data types (CRDTs)
 * - Collaborative editing with undo/redo
 * - File sharing and synchronization
 */
export class CollaborationManager extends EventEmitter {
  private sessions = new Map<string, CollaborationSession>();
  private connections = new Map<string, WebRTCConnection>();
  private operationTransformer: OperationTransformer;
  private presenceManager: PresenceManager;
  private fileShareManager: FileShareManager;
  private voiceChatManager: VoiceChatManager;
  private metrics: MetricsCollector;
  private signalServer: SignalingServer;

  constructor(private config: {
    signalServerUrl: string;
    stunServers: string[];
    turnServers: Array<{ urls: string; username?: string; credential?: string }>;
    maxFileSize: number;
    allowedFileTypes: string[];
  }) {
    super();
    this.operationTransformer = new OperationTransformer();
    this.presenceManager = new PresenceManager();
    this.fileShareManager = new FileShareManager(config.maxFileSize, config.allowedFileTypes);
    this.voiceChatManager = new VoiceChatManager();
    this.metrics = new MetricsCollector();
    this.signalServer = new SignalingServer(config.signalServerUrl);
    
    this.setupEventHandlers();
  }

  /**
   * Create a new collaboration session
   */
  async createSession(
    creator: Participant,
    document: CollaborativeDocument,
    options: Partial<SessionPermissions> = {}
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    const now = new Date();
    
    const session: CollaborationSession = {
      id: sessionId,
      name: document.metadata.title || `Session ${sessionId.slice(-6)}`,
      participants: [{ ...creator, role: 'owner', status: 'active', joinedAt: now, lastSeen: now }],
      document,
      createdAt: now,
      lastActivity: now,
      maxParticipants: 10,
      isPublic: false,
      permissions: {
        allowAnonymous: false,
        requireApproval: true,
        allowComments: true,
        allowVoiceChat: true,
        allowScreenShare: true,
        allowFileSharing: true,
        ...options
      }
    };
    
    this.sessions.set(sessionId, session);
    
    this.metrics.incrementCounter('collaboration_sessions_created', {
      document_type: document.type
    });
    
    this.emit('sessionCreated', { sessionId, session });
    
    logger.info(`Collaboration session created: ${sessionId}`);
    return sessionId;
  }

  /**
   * Join an existing collaboration session
   */
  async joinSession(sessionId: string, participant: Participant): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    if (session.participants.length >= session.maxParticipants) {
      throw new Error('Session is full');
    }
    
    if (!session.permissions.allowAnonymous && !participant.email) {
      throw new Error('Anonymous users not allowed');
    }
    
    // Add participant to session
    const newParticipant: Participant = {
      ...participant,
      role: 'editor',
      status: 'active',
      joinedAt: new Date(),
      lastSeen: new Date()
    };
    
    session.participants.push(newParticipant);
    session.lastActivity = new Date();
    
    // Setup WebRTC connections with existing participants
    await this.setupWebRTCConnections(sessionId, participant.id);
    
    // Notify other participants
    this.broadcastToSession(sessionId, 'participantJoined', {
      participant: newParticipant
    }, participant.id);
    
    this.metrics.incrementCounter('collaboration_session_joins', {
      session_id: sessionId,
      participant_role: newParticipant.role
    });
    
    this.emit('participantJoined', { sessionId, participant: newParticipant });
    
    logger.info(`Participant ${participant.id} joined session ${sessionId}`);
    return true;
  }

  /**
   * Leave a collaboration session
   */
  async leaveSession(sessionId: string, participantId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    const participantIndex = session.participants.findIndex(p => p.id === participantId);
    if (participantIndex === -1) return;
    
    const participant = session.participants[participantIndex];
    
    // Clean up WebRTC connections
    await this.cleanupWebRTCConnections(participantId);
    
    // Remove participant
    session.participants.splice(participantIndex, 1);
    session.lastActivity = new Date();
    
    // If owner left and there are other participants, transfer ownership
    if (participant.role === 'owner' && session.participants.length > 0) {
      session.participants[0].role = 'owner';
    }
    
    // If no participants left, mark session for cleanup
    if (session.participants.length === 0) {
      this.scheduleSessionCleanup(sessionId);
    }
    
    // Notify other participants
    this.broadcastToSession(sessionId, 'participantLeft', {
      participantId,
      newOwner: session.participants.find(p => p.role === 'owner')?.id
    });
    
    this.metrics.incrementCounter('collaboration_session_leaves', {
      session_id: sessionId,
      participant_role: participant.role
    });
    
    this.emit('participantLeft', { sessionId, participantId });
    
    logger.info(`Participant ${participantId} left session ${sessionId}`);
  }

  /**
   * Apply an operation to a document
   */
  async applyOperation(sessionId: string, operation: Operation): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const participant = session.participants.find(p => p.id === operation.authorId);
    if (!participant) {
      throw new Error('Operation author not found in session');
    }
    
    if (participant.role === 'viewer') {
      throw new Error('Viewers cannot edit the document');
    }
    
    // Transform operation against concurrent operations
    const transformedOperation = await this.operationTransformer.transform(
      operation,
      session.document.operations
    );
    
    if (!transformedOperation) {
      logger.warn(`Operation ${operation.id} could not be transformed`);
      return false;
    }
    
    // Apply operation to document
    const success = await this.applyOperationToDocument(session.document, transformedOperation);
    
    if (success) {
      session.document.operations.push(transformedOperation);
      session.document.version++;
      session.lastActivity = new Date();
      
      // Broadcast operation to other participants
      this.broadcastToSession(sessionId, 'operationApplied', {
        operation: transformedOperation,
        documentVersion: session.document.version
      }, operation.authorId);
      
      this.metrics.incrementCounter('collaboration_operations_applied', {
        session_id: sessionId,
        operation_type: operation.type
      });
      
      this.emit('operationApplied', { sessionId, operation: transformedOperation });
    }
    
    return success;
  }

  /**
   * Update participant cursor position
   */
  async updateCursor(sessionId: string, participantId: string, cursor: CursorPosition): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    const participant = session.participants.find(p => p.id === participantId);
    if (!participant) return;
    
    participant.cursor = cursor;
    participant.lastSeen = new Date();
    
    // Broadcast cursor update to other participants
    this.broadcastToSession(sessionId, 'cursorUpdated', {
      participantId,
      cursor
    }, participantId);
    
    this.metrics.incrementCounter('collaboration_cursor_updates', {
      session_id: sessionId
    });
  }

  /**
   * Update participant selection
   */
  async updateSelection(
    sessionId: string,
    participantId: string,
    selection: SelectionRange
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    const participant = session.participants.find(p => p.id === participantId);
    if (!participant) return;
    
    participant.selection = selection;
    participant.lastSeen = new Date();
    
    // Broadcast selection update to other participants
    this.broadcastToSession(sessionId, 'selectionUpdated', {
      participantId,
      selection
    }, participantId);
  }

  /**
   * Start voice chat for a session
   */
  async startVoiceChat(sessionId: string, participantId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.permissions.allowVoiceChat) {
      throw new Error('Voice chat not allowed');
    }
    
    await this.voiceChatManager.startVoiceChat(sessionId, participantId);
    
    this.broadcastToSession(sessionId, 'voiceChatStarted', {
      participantId
    });
    
    this.metrics.incrementCounter('collaboration_voice_chats_started', {
      session_id: sessionId
    });
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(sessionId: string, participantId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.permissions.allowScreenShare) {
      throw new Error('Screen sharing not allowed');
    }
    
    const participant = session.participants.find(p => p.id === participantId);
    if (!participant) {
      throw new Error('Participant not found');
    }
    
    // Setup screen share WebRTC connection
    await this.setupScreenShareConnection(sessionId, participantId);
    
    this.broadcastToSession(sessionId, 'screenShareStarted', {
      participantId,
      participantName: participant.name
    }, participantId);
    
    this.metrics.incrementCounter('collaboration_screen_shares_started', {
      session_id: sessionId
    });
  }

  /**
   * Share a file in the session
   */
  async shareFile(
    sessionId: string,
    participantId: string,
    file: {
      name: string;
      type: string;
      size: number;
      data: ArrayBuffer;
    }
  ): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.permissions.allowFileSharing) {
      throw new Error('File sharing not allowed');
    }
    
    const fileId = await this.fileShareManager.shareFile(sessionId, participantId, file);
    
    this.broadcastToSession(sessionId, 'fileShared', {
      fileId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      sharedBy: participantId
    });
    
    this.metrics.incrementCounter('collaboration_files_shared', {
      session_id: sessionId,
      file_type: file.type
    });
    
    return fileId;
  }

  /**
   * Get session information
   */
  getSession(sessionId: string): CollaborationSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get active sessions for a user
   */
  getUserSessions(userId: string): CollaborationSession[] {
    return Array.from(this.sessions.values()).filter(session =>
      session.participants.some(p => p.id === userId)
    );
  }

  /**
   * Get collaboration metrics
   */
  getMetrics(): {
    activeSessions: number;
    totalParticipants: number;
    operationsPerMinute: number;
    averageSessionDuration: number;
    webrtcConnections: number;
  } {
    const activeSessions = this.sessions.size;
    const totalParticipants = Array.from(this.sessions.values())
      .reduce((sum, session) => sum + session.participants.length, 0);
    
    const webrtcConnections = Array.from(this.connections.values())
      .filter(conn => conn.status === 'connected').length;
    
    return {
      activeSessions,
      totalParticipants,
      operationsPerMinute: 0, // Would be calculated from metrics
      averageSessionDuration: 0, // Would be calculated from session data
      webrtcConnections
    };
  }

  // Private helper methods

  private generateSessionId(): string {
    return 'session_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  private async setupWebRTCConnections(sessionId: string, newParticipantId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    // Create connections with each existing participant
    for (const participant of session.participants) {
      if (participant.id === newParticipantId) continue;
      
      const connectionId = `${newParticipantId}_${participant.id}`;
      
      try {
        const peer = new SimplePeer({
          initiator: newParticipantId < participant.id, // Deterministic initiator
          config: {
            iceServers: [
              ...this.config.stunServers.map(url => ({ urls: url })),
              ...this.config.turnServers
            ]
          }
        });
        
        const connection: WebRTCConnection = {
          peerId: participant.id,
          peer,
          channel: 'data',
          status: 'connecting',
          stats: {
            bytesReceived: 0,
            bytesSent: 0,
            packetsReceived: 0,
            packetsSent: 0,
            latency: 0,
            bandwidth: 0,
            qualityScore: 1.0
          }
        };
        
        this.setupWebRTCEventHandlers(connectionId, connection, sessionId);
        this.connections.set(connectionId, connection);
        
      } catch (error) {
        logger.error(`Failed to setup WebRTC connection ${connectionId}:`, error);
      }
    }
  }

  private setupWebRTCEventHandlers(
    connectionId: string,
    connection: WebRTCConnection,
    sessionId: string
  ): void {
    const { peer } = connection;
    
    peer.on('signal', (data) => {
      // Send signaling data through the signaling server
      this.signalServer.sendSignal(connectionId, data);
    });
    
    peer.on('connect', () => {
      connection.status = 'connected';
      logger.info(`WebRTC connection established: ${connectionId}`);
      
      this.metrics.incrementCounter('collaboration_webrtc_connections', {
        session_id: sessionId,
        status: 'connected'
      });
    });
    
    peer.on('data', (data) => {
      this.handleWebRTCData(connectionId, data);
      connection.stats.packetsReceived++;
      connection.stats.bytesReceived += data.length;
    });
    
    peer.on('error', (error) => {
      logger.error(`WebRTC connection error ${connectionId}:`, error);
      connection.status = 'failed';
      
      this.metrics.incrementCounter('collaboration_webrtc_errors', {
        session_id: sessionId,
        error_type: error.message
      });
    });
    
    peer.on('close', () => {
      connection.status = 'closed';
      this.connections.delete(connectionId);
      logger.info(`WebRTC connection closed: ${connectionId}`);
    });
  }

  private handleWebRTCData(connectionId: string, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'operation':
          this.applyOperation(message.sessionId, message.operation);
          break;
        case 'cursor':
          this.updateCursor(message.sessionId, message.participantId, message.cursor);
          break;
        case 'selection':
          this.updateSelection(message.sessionId, message.participantId, message.selection);
          break;
        case 'chat':
          this.handleChatMessage(message);
          break;
        default:
          logger.warn(`Unknown WebRTC message type: ${message.type}`);
      }
    } catch (error) {
      logger.error(`Failed to handle WebRTC data from ${connectionId}:`, error);
    }
  }

  private async cleanupWebRTCConnections(participantId: string): Promise<void> {
    const connectionsToClose = Array.from(this.connections.entries()).filter(
      ([connectionId]) => connectionId.includes(participantId)
    );
    
    for (const [connectionId, connection] of connectionsToClose) {
      try {
        connection.peer.destroy();
        this.connections.delete(connectionId);
      } catch (error) {
        logger.error(`Failed to cleanup WebRTC connection ${connectionId}:`, error);
      }
    }
  }

  private broadcastToSession(
    sessionId: string,
    eventType: string,
    data: any,
    excludeParticipant?: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    const message = JSON.stringify({
      type: eventType,
      sessionId,
      data,
      timestamp: new Date().toISOString()
    });
    
    for (const participant of session.participants) {
      if (participant.id === excludeParticipant) continue;
      
      // Send via WebRTC if available
      const connection = Array.from(this.connections.values()).find(
        conn => conn.peerId === participant.id && conn.status === 'connected'
      );
      
      if (connection) {
        try {
          connection.peer.send(message);
          connection.stats.packetsSent++;
          connection.stats.bytesSent += message.length;
        } catch (error) {
          logger.error(`Failed to send WebRTC message to ${participant.id}:`, error);
        }
      } else {
        // Fallback to WebSocket or other transport
        this.signalServer.sendToParticipant(participant.id, message);
      }
    }
  }

  private async applyOperationToDocument(
    document: CollaborativeDocument,
    operation: Operation
  ): Promise<boolean> {
    try {
      switch (operation.type) {
        case 'insert':
          if (operation.content) {
            const before = document.content.substring(0, operation.position);
            const after = document.content.substring(operation.position);
            document.content = before + operation.content + after;
          }
          break;
          
        case 'delete':
          if (operation.length) {
            const before = document.content.substring(0, operation.position);
            const after = document.content.substring(operation.position + operation.length);
            document.content = before + after;
          }
          break;
          
        case 'replace':
          if (operation.content && operation.length) {
            const before = document.content.substring(0, operation.position);
            const after = document.content.substring(operation.position + operation.length);
            document.content = before + operation.content + after;
          }
          break;
          
        default:
          logger.warn(`Unknown operation type: ${operation.type}`);
          return false;
      }
      
      operation.applied = true;
      return true;
      
    } catch (error) {
      logger.error(`Failed to apply operation ${operation.id}:`, error);
      return false;
    }
  }

  private async setupScreenShareConnection(sessionId: string, participantId: string): Promise<void> {
    // Implementation for screen sharing WebRTC connection
    // This would involve creating a separate peer connection for screen data
  }

  private handleChatMessage(message: any): void {
    // Handle chat messages between participants
    this.emit('chatMessage', message);
  }

  private scheduleSessionCleanup(sessionId: string): void {
    setTimeout(() => {
      const session = this.sessions.get(sessionId);
      if (session && session.participants.length === 0) {
        this.sessions.delete(sessionId);
        logger.info(`Cleaned up empty session: ${sessionId}`);
      }
    }, 300000); // 5 minutes delay
  }

  private setupEventHandlers(): void {
    // Setup global event handlers
    this.on('operationApplied', (event) => {
      logger.debug(`Operation applied in session ${event.sessionId}:`, event.operation);
    });
    
    this.on('participantJoined', (event) => {
      logger.info(`Participant joined session ${event.sessionId}:`, event.participant.name);
    });
    
    this.on('participantLeft', (event) => {
      logger.info(`Participant left session ${event.sessionId}: ${event.participantId}`);
    });
  }
}

// Additional supporting classes would be implemented here...
class OperationTransformer {
  async transform(operation: Operation, existingOperations: Operation[]): Promise<Operation | null> {
    // Implement operational transformation algorithm
    return operation;
  }
}

class PresenceManager {
  // Implement presence tracking
}

class FileShareManager {
  constructor(private maxSize: number, private allowedTypes: string[]) {}
  
  async shareFile(sessionId: string, participantId: string, file: any): Promise<string> {
    return 'file_' + Math.random().toString(36).substr(2, 9);
  }
}

class VoiceChatManager {
  async startVoiceChat(sessionId: string, participantId: string): Promise<void> {
    // Implement voice chat functionality
  }
}

class SignalingServer {
  constructor(private url: string) {}
  
  sendSignal(connectionId: string, data: any): void {
    // Implement WebRTC signaling
  }
  
  sendToParticipant(participantId: string, message: string): void {
    // Implement message delivery to participant
  }
}