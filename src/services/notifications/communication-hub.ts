/**
 * Communication Hub
 * Real-time messaging and collaboration platform
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// Types and Interfaces
export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen?: Date;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  notifications: boolean;
  soundEnabled: boolean;
  desktopNotifications: boolean;
  statusVisibility: 'everyone' | 'team' | 'none';
}

export interface Channel {
  id: string;
  name: string;
  type: 'public' | 'private' | 'direct';
  description?: string;
  members: string[];
  admins: string[];
  createdBy: string;
  createdAt: Date;
  lastActivity?: Date;
  archived?: boolean;
  settings?: ChannelSettings;
}

export interface ChannelSettings {
  allowThreads: boolean;
  allowReactions: boolean;
  allowFiles: boolean;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  messageRetention?: number; // days
  encryptionEnabled?: boolean;
}

export interface Message {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  type: 'text' | 'file' | 'code' | 'system' | 'call';
  timestamp: Date;
  edited?: boolean;
  editedAt?: Date;
  deleted?: boolean;
  deletedAt?: Date;
  threadId?: string;
  replyTo?: string;
  mentions?: string[];
  reactions?: Reaction[];
  attachments?: Attachment[];
  metadata?: Record<string, any>;
}

export interface Reaction {
  emoji: string;
  users: string[];
  count: number;
}

export interface Attachment {
  id: string;
  type: 'file' | 'image' | 'video' | 'audio' | 'code';
  name: string;
  url: string;
  size: number;
  mimeType?: string;
  thumbnail?: string;
  language?: string; // for code snippets
}

export interface Thread {
  id: string;
  messageId: string;
  channelId: string;
  participants: string[];
  replyCount: number;
  lastReplyAt?: Date;
  lastReplyBy?: string;
}

export interface Presence {
  userId: string;
  status: User['status'];
  lastSeen: Date;
  activeChannels: string[];
  typing?: {
    channelId: string;
    startedAt: Date;
  };
}

export interface CallSession {
  id: string;
  channelId: string;
  type: 'voice' | 'video' | 'screen';
  initiator: string;
  participants: CallParticipant[];
  startedAt: Date;
  endedAt?: Date;
  recording?: {
    enabled: boolean;
    url?: string;
  };
}

export interface CallParticipant {
  userId: string;
  joinedAt: Date;
  leftAt?: Date;
  audio: boolean;
  video: boolean;
  screen: boolean;
  connection: 'connected' | 'connecting' | 'disconnected';
}

export interface BroadcastMessage {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  targets: {
    all?: boolean;
    teams?: string[];
    users?: string[];
    channels?: string[];
  };
  sender: string;
  sentAt: Date;
  expiresAt?: Date;
}

// Main Communication Hub Class
export class CommunicationHub extends EventEmitter {
  private io: SocketIOServer;
  private redis: Redis;
  private pubClient: Redis;
  private subClient: Redis;
  
  // Data stores
  private users: Map<string, User> = new Map();
  private channels: Map<string, Channel> = new Map();
  private messages: Map<string, Message[]> = new Map();
  private threads: Map<string, Thread> = new Map();
  private presence: Map<string, Presence> = new Map();
  private activeCalls: Map<string, CallSession> = new Map();
  private socketUserMap: Map<string, string> = new Map();
  private userSocketMap: Map<string, Set<string>> = new Map();
  
  // Search indices
  private messageSearchIndex: Map<string, Set<string>> = new Map();
  
  // Configuration
  private config = {
    maxMessageLength: 10000,
    maxFileSize: 100 * 1024 * 1024, // 100MB
    messageRetentionDays: 90,
    typingTimeout: 5000,
    presenceTimeout: 30000,
    encryptionKey: process.env.MESSAGE_ENCRYPTION_KEY,
  };

  constructor(server: HTTPServer) {
    super();
    
    // Initialize Socket.IO
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });
    
    // Initialize Redis for scaling
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });
    
    this.pubClient = this.redis.duplicate();
    this.subClient = this.redis.duplicate();
    
    this.initializeRedisSubscriptions();
    this.initializeSocketHandlers();
    this.startPresenceMonitor();
    this.startMessageCleanup();
  }

  // Initialization Methods
  private initializeRedisSubscriptions(): void {
    // Subscribe to Redis channels for multi-server support
    this.subClient.subscribe('chat:broadcast', 'chat:message', 'chat:presence');
    
    this.subClient.on('message', (channel, message) => {
      const data = JSON.parse(message);
      
      switch (channel) {
        case 'chat:broadcast':
          this.handleRedisBroadcast(data);
          break;
        case 'chat:message':
          this.handleRedisMessage(data);
          break;
        case 'chat:presence':
          this.handleRedisPresence(data);
          break;
      }
    });
  }

  private initializeSocketHandlers(): void {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        const user = await this.authenticateUser(token);
        socket.data.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket) => {
      const user = socket.data.user as User;
      this.handleUserConnection(socket, user);
      
      // Message handlers
      socket.on('message:send', (data) => this.handleSendMessage(socket, data));
      socket.on('message:edit', (data) => this.handleEditMessage(socket, data));
      socket.on('message:delete', (data) => this.handleDeleteMessage(socket, data));
      socket.on('message:react', (data) => this.handleReaction(socket, data));
      
      // Thread handlers
      socket.on('thread:reply', (data) => this.handleThreadReply(socket, data));
      socket.on('thread:get', (data) => this.handleGetThread(socket, data));
      
      // Channel handlers
      socket.on('channel:create', (data) => this.handleCreateChannel(socket, data));
      socket.on('channel:join', (data) => this.handleJoinChannel(socket, data));
      socket.on('channel:leave', (data) => this.handleLeaveChannel(socket, data));
      socket.on('channel:list', (data) => this.handleListChannels(socket, data));
      socket.on('channel:members', (data) => this.handleGetChannelMembers(socket, data));
      
      // Presence handlers
      socket.on('presence:update', (data) => this.handlePresenceUpdate(socket, data));
      socket.on('typing:start', (data) => this.handleTypingStart(socket, data));
      socket.on('typing:stop', (data) => this.handleTypingStop(socket, data));
      
      // Call handlers
      socket.on('call:initiate', (data) => this.handleInitiateCall(socket, data));
      socket.on('call:join', (data) => this.handleJoinCall(socket, data));
      socket.on('call:leave', (data) => this.handleLeaveCall(socket, data));
      socket.on('call:signal', (data) => this.handleCallSignal(socket, data));
      
      // File sharing
      socket.on('file:upload', (data) => this.handleFileUpload(socket, data));
      socket.on('file:download', (data) => this.handleFileDownload(socket, data));
      
      // Search
      socket.on('search:messages', (data) => this.handleSearchMessages(socket, data));
      socket.on('search:files', (data) => this.handleSearchFiles(socket, data));
      
      // Broadcast
      socket.on('broadcast:send', (data) => this.handleBroadcast(socket, data));
      
      // Disconnect
      socket.on('disconnect', () => this.handleUserDisconnection(socket, user));
    });
  }

  // Connection Management
  private async handleUserConnection(socket: Socket, user: User): Promise<void> {
    console.log(`User ${user.username} connected`);
    
    // Update mappings
    this.socketUserMap.set(socket.id, user.id);
    if (!this.userSocketMap.has(user.id)) {
      this.userSocketMap.set(user.id, new Set());
    }
    this.userSocketMap.get(user.id)!.add(socket.id);
    
    // Update user status
    user.status = 'online';
    user.lastSeen = new Date();
    this.users.set(user.id, user);
    
    // Update presence
    const presence: Presence = {
      userId: user.id,
      status: 'online',
      lastSeen: new Date(),
      activeChannels: [],
    };
    this.presence.set(user.id, presence);
    
    // Join user's channels
    const userChannels = await this.getUserChannels(user.id);
    for (const channel of userChannels) {
      socket.join(channel.id);
      presence.activeChannels.push(channel.id);
    }
    
    // Notify others of user coming online
    this.broadcastPresence(user.id, 'online');
    
    // Send initial data to user
    socket.emit('init', {
      user,
      channels: userChannels,
      recentMessages: await this.getRecentMessages(user.id),
      onlineUsers: this.getOnlineUsers(),
    });
  }

  private async handleUserDisconnection(socket: Socket, user: User): Promise<void> {
    console.log(`User ${user.username} disconnected`);
    
    // Remove from mappings
    this.socketUserMap.delete(socket.id);
    const userSockets = this.userSocketMap.get(user.id);
    if (userSockets) {
      userSockets.delete(socket.id);
      
      // If no more sockets for this user, mark as offline
      if (userSockets.size === 0) {
        this.userSocketMap.delete(user.id);
        user.status = 'offline';
        user.lastSeen = new Date();
        
        // Update presence
        const presence = this.presence.get(user.id);
        if (presence) {
          presence.status = 'offline';
          presence.lastSeen = new Date();
        }
        
        // Notify others
        this.broadcastPresence(user.id, 'offline');
      }
    }
  }

  // Message Handlers
  private async handleSendMessage(socket: Socket, data: any): Promise<void> {
    const user = socket.data.user as User;
    const { channelId, content, type = 'text', attachments, replyTo, mentions } = data;
    
    // Validate
    if (!channelId || !content) {
      socket.emit('error', { message: 'Invalid message data' });
      return;
    }
    
    if (content.length > this.config.maxMessageLength) {
      socket.emit('error', { message: 'Message too long' });
      return;
    }
    
    // Check channel membership
    const channel = this.channels.get(channelId);
    if (!channel || !channel.members.includes(user.id)) {
      socket.emit('error', { message: 'Not a member of this channel' });
      return;
    }
    
    // Create message
    const message: Message = {
      id: uuidv4(),
      channelId,
      userId: user.id,
      content: this.sanitizeContent(content),
      type,
      timestamp: new Date(),
      mentions: mentions || this.extractMentions(content),
      attachments: attachments || [],
      replyTo,
    };
    
    // Encrypt if enabled
    if (channel.settings?.encryptionEnabled && this.config.encryptionKey) {
      message.content = this.encryptMessage(message.content);
      message.metadata = { encrypted: true };
    }
    
    // Store message
    if (!this.messages.has(channelId)) {
      this.messages.set(channelId, []);
    }
    this.messages.get(channelId)!.push(message);
    
    // Update search index
    this.indexMessage(message);
    
    // Update channel last activity
    channel.lastActivity = new Date();
    
    // Emit to channel members
    this.io.to(channelId).emit('message:new', {
      message,
      user: this.getUserInfo(user.id),
    });
    
    // Send notifications to mentioned users
    if (message.mentions && message.mentions.length > 0) {
      this.notifyMentionedUsers(message, user);
    }
    
    // Publish to Redis for other servers
    this.pubClient.publish('chat:message', JSON.stringify({
      action: 'new',
      message,
      user: this.getUserInfo(user.id),
    }));
    
    // Emit success
    socket.emit('message:sent', { messageId: message.id });
  }

  private async handleEditMessage(socket: Socket, data: any): Promise<void> {
    const user = socket.data.user as User;
    const { messageId, content } = data;
    
    // Find message
    const message = this.findMessage(messageId);
    if (!message) {
      socket.emit('error', { message: 'Message not found' });
      return;
    }
    
    // Check ownership
    if (message.userId !== user.id) {
      socket.emit('error', { message: 'Cannot edit message from another user' });
      return;
    }
    
    // Update message
    message.content = this.sanitizeContent(content);
    message.edited = true;
    message.editedAt = new Date();
    
    // Re-index for search
    this.indexMessage(message);
    
    // Emit to channel
    this.io.to(message.channelId).emit('message:edited', {
      messageId,
      content: message.content,
      editedAt: message.editedAt,
    });
  }

  private async handleDeleteMessage(socket: Socket, data: any): Promise<void> {
    const user = socket.data.user as User;
    const { messageId } = data;
    
    // Find message
    const message = this.findMessage(messageId);
    if (!message) {
      socket.emit('error', { message: 'Message not found' });
      return;
    }
    
    // Check ownership or admin
    const channel = this.channels.get(message.channelId);
    if (message.userId !== user.id && !channel?.admins.includes(user.id)) {
      socket.emit('error', { message: 'Cannot delete this message' });
      return;
    }
    
    // Soft delete
    message.deleted = true;
    message.deletedAt = new Date();
    message.content = '[Message deleted]';
    
    // Emit to channel
    this.io.to(message.channelId).emit('message:deleted', { messageId });
  }

  private async handleReaction(socket: Socket, data: any): Promise<void> {
    const user = socket.data.user as User;
    const { messageId, emoji, action } = data;
    
    // Find message
    const message = this.findMessage(messageId);
    if (!message) {
      socket.emit('error', { message: 'Message not found' });
      return;
    }
    
    // Initialize reactions if needed
    if (!message.reactions) {
      message.reactions = [];
    }
    
    // Find or create reaction
    let reaction = message.reactions.find(r => r.emoji === emoji);
    if (!reaction) {
      reaction = { emoji, users: [], count: 0 };
      message.reactions.push(reaction);
    }
    
    // Add or remove user
    if (action === 'add') {
      if (!reaction.users.includes(user.id)) {
        reaction.users.push(user.id);
        reaction.count++;
      }
    } else if (action === 'remove') {
      const index = reaction.users.indexOf(user.id);
      if (index > -1) {
        reaction.users.splice(index, 1);
        reaction.count--;
      }
    }
    
    // Remove reaction if no users
    if (reaction.count === 0) {
      message.reactions = message.reactions.filter(r => r.emoji !== emoji);
    }
    
    // Emit to channel
    this.io.to(message.channelId).emit('message:reaction', {
      messageId,
      reactions: message.reactions,
    });
  }

  // Thread Handlers
  private async handleThreadReply(socket: Socket, data: any): Promise<void> {
    const user = socket.data.user as User;
    const { messageId, content, attachments } = data;
    
    // Find parent message
    const parentMessage = this.findMessage(messageId);
    if (!parentMessage) {
      socket.emit('error', { message: 'Parent message not found' });
      return;
    }
    
    // Get or create thread
    let thread = this.threads.get(messageId);
    if (!thread) {
      thread = {
        id: uuidv4(),
        messageId,
        channelId: parentMessage.channelId,
        participants: [user.id],
        replyCount: 0,
      };
      this.threads.set(messageId, thread);
      parentMessage.threadId = thread.id;
    }
    
    // Add user to participants
    if (!thread.participants.includes(user.id)) {
      thread.participants.push(user.id);
    }
    
    // Create reply message
    const reply: Message = {
      id: uuidv4(),
      channelId: parentMessage.channelId,
      userId: user.id,
      content: this.sanitizeContent(content),
      type: 'text',
      timestamp: new Date(),
      threadId: thread.id,
      replyTo: messageId,
      attachments: attachments || [],
    };
    
    // Store reply
    if (!this.messages.has(parentMessage.channelId)) {
      this.messages.set(parentMessage.channelId, []);
    }
    this.messages.get(parentMessage.channelId)!.push(reply);
    
    // Update thread
    thread.replyCount++;
    thread.lastReplyAt = new Date();
    thread.lastReplyBy = user.id;
    
    // Notify thread participants
    thread.participants.forEach(participantId => {
      const participantSockets = this.userSocketMap.get(participantId);
      if (participantSockets) {
        participantSockets.forEach(socketId => {
          this.io.to(socketId).emit('thread:reply', {
            thread,
            reply,
            user: this.getUserInfo(user.id),
          });
        });
      }
    });
  }

  private async handleGetThread(socket: Socket, data: any): Promise<void> {
    const { messageId } = data;
    
    const thread = this.threads.get(messageId);
    if (!thread) {
      socket.emit('thread:messages', { messages: [] });
      return;
    }
    
    // Get all thread messages
    const channelMessages = this.messages.get(thread.channelId) || [];
    const threadMessages = channelMessages.filter(m => m.threadId === thread.id);
    
    socket.emit('thread:messages', {
      thread,
      messages: threadMessages.map(m => ({
        ...m,
        user: this.getUserInfo(m.userId),
      })),
    });
  }

  // Channel Management
  private async handleCreateChannel(socket: Socket, data: any): Promise<void> {
    const user = socket.data.user as User;
    const { name, type = 'public', description, members = [], settings = {} } = data;
    
    // Validate
    if (!name) {
      socket.emit('error', { message: 'Channel name required' });
      return;
    }
    
    // Create channel
    const channel: Channel = {
      id: uuidv4(),
      name: this.sanitizeContent(name),
      type,
      description: description ? this.sanitizeContent(description) : undefined,
      members: [user.id, ...members],
      admins: [user.id],
      createdBy: user.id,
      createdAt: new Date(),
      settings: {
        allowThreads: true,
        allowReactions: true,
        allowFiles: true,
        ...settings,
      },
    };
    
    // Store channel
    this.channels.set(channel.id, channel);
    
    // Join creator and members to channel
    channel.members.forEach(memberId => {
      const memberSockets = this.userSocketMap.get(memberId);
      if (memberSockets) {
        memberSockets.forEach(socketId => {
          this.io.sockets.sockets.get(socketId)?.join(channel.id);
        });
      }
    });
    
    // Notify members
    this.io.to(channel.id).emit('channel:created', channel);
    
    socket.emit('channel:create:success', channel);
  }

  private async handleJoinChannel(socket: Socket, data: any): Promise<void> {
    const user = socket.data.user as User;
    const { channelId } = data;
    
    const channel = this.channels.get(channelId);
    if (!channel) {
      socket.emit('error', { message: 'Channel not found' });
      return;
    }
    
    // Check if channel is private
    if (channel.type === 'private') {
      socket.emit('error', { message: 'Cannot join private channel without invitation' });
      return;
    }
    
    // Add user to channel
    if (!channel.members.includes(user.id)) {
      channel.members.push(user.id);
    }
    
    // Join socket room
    socket.join(channelId);
    
    // Update presence
    const presence = this.presence.get(user.id);
    if (presence && !presence.activeChannels.includes(channelId)) {
      presence.activeChannels.push(channelId);
    }
    
    // Notify channel members
    this.io.to(channelId).emit('channel:member:joined', {
      channelId,
      user: this.getUserInfo(user.id),
    });
    
    // Send recent messages
    const recentMessages = this.getChannelMessages(channelId, 50);
    socket.emit('channel:joined', {
      channel,
      messages: recentMessages,
    });
  }

  private async handleLeaveChannel(socket: Socket, data: any): Promise<void> {
    const user = socket.data.user as User;
    const { channelId } = data;
    
    const channel = this.channels.get(channelId);
    if (!channel) {
      socket.emit('error', { message: 'Channel not found' });
      return;
    }
    
    // Remove user from channel
    channel.members = channel.members.filter(id => id !== user.id);
    channel.admins = channel.admins.filter(id => id !== user.id);
    
    // Leave socket room
    socket.leave(channelId);
    
    // Update presence
    const presence = this.presence.get(user.id);
    if (presence) {
      presence.activeChannels = presence.activeChannels.filter(id => id !== channelId);
    }
    
    // Notify channel members
    this.io.to(channelId).emit('channel:member:left', {
      channelId,
      userId: user.id,
    });
    
    socket.emit('channel:left', { channelId });
  }

  private async handleListChannels(socket: Socket, data: any): Promise<void> {
    const user = socket.data.user as User;
    const { type, search } = data;
    
    let channels = Array.from(this.channels.values());
    
    // Filter by type
    if (type) {
      channels = channels.filter(c => c.type === type);
    }
    
    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      channels = channels.filter(c => 
        c.name.toLowerCase().includes(searchLower) ||
        c.description?.toLowerCase().includes(searchLower)
      );
    }
    
    // Filter private channels (only show if member)
    channels = channels.filter(c => 
      c.type !== 'private' || c.members.includes(user.id)
    );
    
    socket.emit('channel:list', channels);
  }

  private async handleGetChannelMembers(socket: Socket, data: any): Promise<void> {
    const { channelId } = data;
    
    const channel = this.channels.get(channelId);
    if (!channel) {
      socket.emit('error', { message: 'Channel not found' });
      return;
    }
    
    const members = channel.members.map(userId => ({
      ...this.getUserInfo(userId),
      isAdmin: channel.admins.includes(userId),
      presence: this.presence.get(userId),
    }));
    
    socket.emit('channel:members', { channelId, members });
  }

  // Presence and Typing
  private async handlePresenceUpdate(socket: Socket, data: any): Promise<void> {
    const user = socket.data.user as User;
    const { status } = data;
    
    if (!['online', 'away', 'busy', 'offline'].includes(status)) {
      socket.emit('error', { message: 'Invalid status' });
      return;
    }
    
    // Update user status
    user.status = status;
    const presence = this.presence.get(user.id);
    if (presence) {
      presence.status = status;
      presence.lastSeen = new Date();
    }
    
    // Broadcast to others
    this.broadcastPresence(user.id, status);
  }

  private async handleTypingStart(socket: Socket, data: any): Promise<void> {
    const user = socket.data.user as User;
    const { channelId } = data;
    
    const presence = this.presence.get(user.id);
    if (presence) {
      presence.typing = {
        channelId,
        startedAt: new Date(),
      };
    }
    
    // Broadcast to channel
    socket.to(channelId).emit('typing:start', {
      channelId,
      userId: user.id,
      user: this.getUserInfo(user.id),
    });
    
    // Auto-stop typing after timeout
    setTimeout(() => {
      if (presence?.typing?.channelId === channelId) {
        this.handleTypingStop(socket, { channelId });
      }
    }, this.config.typingTimeout);
  }

  private async handleTypingStop(socket: Socket, data: any): Promise<void> {
    const user = socket.data.user as User;
    const { channelId } = data;
    
    const presence = this.presence.get(user.id);
    if (presence?.typing?.channelId === channelId) {
      presence.typing = undefined;
    }
    
    // Broadcast to channel
    socket.to(channelId).emit('typing:stop', {
      channelId,
      userId: user.id,
    });
  }

  // Call Management
  private async handleInitiateCall(socket: Socket, data: any): Promise<void> {
    const user = socket.data.user as User;
    const { channelId, type = 'voice' } = data;
    
    const channel = this.channels.get(channelId);
    if (!channel) {
      socket.emit('error', { message: 'Channel not found' });
      return;
    }
    
    // Check if call already exists
    const existingCall = Array.from(this.activeCalls.values()).find(
      c => c.channelId === channelId && !c.endedAt
    );
    
    if (existingCall) {
      socket.emit('error', { message: 'Call already in progress' });
      return;
    }
    
    // Create call session
    const callSession: CallSession = {
      id: uuidv4(),
      channelId,
      type,
      initiator: user.id,
      participants: [{
        userId: user.id,
        joinedAt: new Date(),
        audio: true,
        video: type === 'video',
        screen: false,
        connection: 'connecting',
      }],
      startedAt: new Date(),
    };
    
    this.activeCalls.set(callSession.id, callSession);
    
    // Notify channel members
    this.io.to(channelId).emit('call:incoming', {
      callId: callSession.id,
      channelId,
      type,
      initiator: this.getUserInfo(user.id),
    });
    
    socket.emit('call:initiated', callSession);
  }

  private async handleJoinCall(socket: Socket, data: any): Promise<void> {
    const user = socket.data.user as User;
    const { callId, audio = true, video = false } = data;
    
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      socket.emit('error', { message: 'Call not found' });
      return;
    }
    
    // Check if already in call
    const existingParticipant = callSession.participants.find(p => p.userId === user.id);
    if (existingParticipant) {
      existingParticipant.audio = audio;
      existingParticipant.video = video;
    } else {
      // Add participant
      callSession.participants.push({
        userId: user.id,
        joinedAt: new Date(),
        audio,
        video,
        screen: false,
        connection: 'connecting',
      });
    }
    
    // Join call room
    socket.join(`call:${callId}`);
    
    // Notify other participants
    socket.to(`call:${callId}`).emit('call:participant:joined', {
      callId,
      participant: this.getUserInfo(user.id),
    });
    
    socket.emit('call:joined', {
      callSession,
      participants: callSession.participants.map(p => ({
        ...p,
        user: this.getUserInfo(p.userId),
      })),
    });
  }

  private async handleLeaveCall(socket: Socket, data: any): Promise<void> {
    const user = socket.data.user as User;
    const { callId } = data;
    
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      return;
    }
    
    // Update participant
    const participant = callSession.participants.find(p => p.userId === user.id);
    if (participant) {
      participant.leftAt = new Date();
      participant.connection = 'disconnected';
    }
    
    // Leave call room
    socket.leave(`call:${callId}`);
    
    // Notify other participants
    socket.to(`call:${callId}`).emit('call:participant:left', {
      callId,
      userId: user.id,
    });
    
    // End call if no active participants
    const activeParticipants = callSession.participants.filter(p => !p.leftAt);
    if (activeParticipants.length === 0) {
      callSession.endedAt = new Date();
      this.io.to(callSession.channelId).emit('call:ended', { callId });
    }
    
    socket.emit('call:left', { callId });
  }

  private async handleCallSignal(socket: Socket, data: any): Promise<void> {
    const user = socket.data.user as User;
    const { callId, targetUserId, signal } = data;
    
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      socket.emit('error', { message: 'Call not found' });
      return;
    }
    
    // Forward signal to target user
    const targetSockets = this.userSocketMap.get(targetUserId);
    if (targetSockets) {
      targetSockets.forEach(socketId => {
        this.io.to(socketId).emit('call:signal', {
          callId,
          fromUserId: user.id,
          signal,
        });
      });
    }
  }

  // File Sharing
  private async handleFileUpload(socket: Socket, data: any): Promise<void> {
    const user = socket.data.user as User;
    const { channelId, file, metadata } = data;
    
    // Validate file size
    if (file.size > this.config.maxFileSize) {
      socket.emit('error', { message: 'File too large' });
      return;
    }
    
    // Check channel settings
    const channel = this.channels.get(channelId);
    if (!channel?.settings?.allowFiles) {
      socket.emit('error', { message: 'File sharing not allowed in this channel' });
      return;
    }
    
    // Check file type
    if (channel.settings.allowedFileTypes) {
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      if (!channel.settings.allowedFileTypes.includes(fileExt)) {
        socket.emit('error', { message: 'File type not allowed' });
        return;
      }
    }
    
    // Store file (implementation depends on storage solution)
    const fileUrl = await this.storeFile(file, user.id);
    
    // Create attachment
    const attachment: Attachment = {
      id: uuidv4(),
      type: this.getFileType(file.mimeType),
      name: file.name,
      url: fileUrl,
      size: file.size,
      mimeType: file.mimeType,
    };
    
    // Send as message
    await this.handleSendMessage(socket, {
      channelId,
      content: `Shared file: ${file.name}`,
      type: 'file',
      attachments: [attachment],
    });
  }

  private async handleFileDownload(socket: Socket, data: any): Promise<void> {
    const { attachmentId } = data;
    
    // Find attachment
    let attachment: Attachment | undefined;
    for (const messages of this.messages.values()) {
      for (const message of messages) {
        if (message.attachments) {
          attachment = message.attachments.find(a => a.id === attachmentId);
          if (attachment) break;
        }
      }
      if (attachment) break;
    }
    
    if (!attachment) {
      socket.emit('error', { message: 'File not found' });
      return;
    }
    
    // Generate secure download URL
    const downloadUrl = await this.generateDownloadUrl(attachment.url);
    
    socket.emit('file:download:url', {
      attachmentId,
      url: downloadUrl,
      expires: Date.now() + 3600000, // 1 hour
    });
  }

  // Search
  private async handleSearchMessages(socket: Socket, data: any): Promise<void> {
    const user = socket.data.user as User;
    const { query, channelId, userId: searchUserId, dateFrom, dateTo, limit = 50 } = data;
    
    if (!query) {
      socket.emit('search:results', { messages: [] });
      return;
    }
    
    const results: Message[] = [];
    const queryLower = query.toLowerCase();
    
    // Search through messages
    for (const [chId, messages] of this.messages.entries()) {
      // Filter by channel if specified
      if (channelId && chId !== channelId) continue;
      
      // Check if user has access to channel
      const channel = this.channels.get(chId);
      if (!channel || !channel.members.includes(user.id)) continue;
      
      for (const message of messages) {
        // Filter by user if specified
        if (searchUserId && message.userId !== searchUserId) continue;
        
        // Filter by date range
        if (dateFrom && message.timestamp < new Date(dateFrom)) continue;
        if (dateTo && message.timestamp > new Date(dateTo)) continue;
        
        // Search in content
        if (message.content.toLowerCase().includes(queryLower)) {
          results.push(message);
          if (results.length >= limit) break;
        }
      }
      
      if (results.length >= limit) break;
    }
    
    socket.emit('search:results', {
      messages: results.map(m => ({
        ...m,
        user: this.getUserInfo(m.userId),
        channel: this.channels.get(m.channelId),
      })),
    });
  }

  private async handleSearchFiles(socket: Socket, data: any): Promise<void> {
    const user = socket.data.user as User;
    const { query, type, channelId, limit = 50 } = data;
    
    const results: Attachment[] = [];
    
    // Search through messages with attachments
    for (const [chId, messages] of this.messages.entries()) {
      // Filter by channel if specified
      if (channelId && chId !== channelId) continue;
      
      // Check if user has access
      const channel = this.channels.get(chId);
      if (!channel || !channel.members.includes(user.id)) continue;
      
      for (const message of messages) {
        if (!message.attachments) continue;
        
        for (const attachment of message.attachments) {
          // Filter by type
          if (type && attachment.type !== type) continue;
          
          // Search in filename
          if (!query || attachment.name.toLowerCase().includes(query.toLowerCase())) {
            results.push(attachment);
            if (results.length >= limit) break;
          }
        }
        
        if (results.length >= limit) break;
      }
      
      if (results.length >= limit) break;
    }
    
    socket.emit('search:files:results', { files: results });
  }

  // Broadcast
  private async handleBroadcast(socket: Socket, data: any): Promise<void> {
    const user = socket.data.user as User;
    const { title, content, priority = 'medium', targets } = data;
    
    // Check if user has broadcast permissions
    if (!this.canBroadcast(user.id)) {
      socket.emit('error', { message: 'No permission to broadcast' });
      return;
    }
    
    // Create broadcast message
    const broadcast: BroadcastMessage = {
      id: uuidv4(),
      title,
      content: this.sanitizeContent(content),
      priority,
      targets: targets || { all: true },
      sender: user.id,
      sentAt: new Date(),
    };
    
    // Determine recipients
    const recipients = this.getBroadcastRecipients(broadcast);
    
    // Send to recipients
    recipients.forEach(recipientId => {
      const recipientSockets = this.userSocketMap.get(recipientId);
      if (recipientSockets) {
        recipientSockets.forEach(socketId => {
          this.io.to(socketId).emit('broadcast:message', {
            broadcast,
            sender: this.getUserInfo(user.id),
          });
        });
      }
    });
    
    // Publish to Redis for other servers
    this.pubClient.publish('chat:broadcast', JSON.stringify(broadcast));
    
    socket.emit('broadcast:sent', { broadcastId: broadcast.id, recipients: recipients.length });
  }

  // Helper Methods
  private sanitizeContent(content: string): string {
    // Basic HTML sanitization
    return content
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  private extractMentions(content: string): string[] {
    const mentions: string[] = [];
    const regex = /@(\w+)/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      mentions.push(match[1]);
    }
    
    return mentions;
  }

  private encryptMessage(content: string): string {
    if (!this.config.encryptionKey) return content;
    
    const cipher = crypto.createCipher('aes-256-cbc', this.config.encryptionKey);
    let encrypted = cipher.update(content, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  private decryptMessage(content: string): string {
    if (!this.config.encryptionKey) return content;
    
    const decipher = crypto.createDecipher('aes-256-cbc', this.config.encryptionKey);
    let decrypted = decipher.update(content, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private findMessage(messageId: string): Message | undefined {
    for (const messages of this.messages.values()) {
      const message = messages.find(m => m.id === messageId);
      if (message) return message;
    }
    return undefined;
  }

  private getChannelMessages(channelId: string, limit: number): Message[] {
    const messages = this.messages.get(channelId) || [];
    return messages
      .slice(-limit)
      .map(m => ({
        ...m,
        user: this.getUserInfo(m.userId),
      }));
  }

  private getUserInfo(userId: string): Partial<User> {
    const user = this.users.get(userId);
    if (!user) {
      return { id: userId, username: 'Unknown User' };
    }
    return {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      status: user.status,
    };
  }

  private async getUserChannels(userId: string): Promise<Channel[]> {
    return Array.from(this.channels.values()).filter(c => c.members.includes(userId));
  }

  private async getRecentMessages(userId: string): Promise<Message[]> {
    const userChannels = await this.getUserChannels(userId);
    const recentMessages: Message[] = [];
    
    for (const channel of userChannels) {
      const channelMessages = this.getChannelMessages(channel.id, 10);
      recentMessages.push(...channelMessages);
    }
    
    return recentMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 50);
  }

  private getOnlineUsers(): User[] {
    return Array.from(this.users.values()).filter(u => u.status === 'online');
  }

  private broadcastPresence(userId: string, status: User['status']): void {
    const user = this.getUserInfo(userId);
    this.io.emit('presence:update', { userId, status, user });
  }

  private notifyMentionedUsers(message: Message, sender: User): void {
    if (!message.mentions) return;
    
    message.mentions.forEach(username => {
      // Find user by username
      const mentionedUser = Array.from(this.users.values()).find(u => u.username === username);
      if (mentionedUser && mentionedUser.id !== sender.id) {
        const sockets = this.userSocketMap.get(mentionedUser.id);
        if (sockets) {
          sockets.forEach(socketId => {
            this.io.to(socketId).emit('mention', {
              message,
              sender: this.getUserInfo(sender.id),
              channel: this.channels.get(message.channelId),
            });
          });
        }
      }
    });
  }

  private indexMessage(message: Message): void {
    // Simple word-based indexing for search
    const words = message.content.toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (!this.messageSearchIndex.has(word)) {
        this.messageSearchIndex.set(word, new Set());
      }
      this.messageSearchIndex.get(word)!.add(message.id);
    });
  }

  private canBroadcast(userId: string): boolean {
    // Check if user has admin/broadcast permissions
    // This should be implemented based on your permission system
    return true; // Placeholder
  }

  private getBroadcastRecipients(broadcast: BroadcastMessage): string[] {
    const recipients: Set<string> = new Set();
    
    if (broadcast.targets.all) {
      // All users
      this.users.forEach(user => recipients.add(user.id));
    } else {
      // Specific targets
      if (broadcast.targets.users) {
        broadcast.targets.users.forEach(id => recipients.add(id));
      }
      
      if (broadcast.targets.teams) {
        // Add team members (implement based on your team structure)
      }
      
      if (broadcast.targets.channels) {
        broadcast.targets.channels.forEach(channelId => {
          const channel = this.channels.get(channelId);
          if (channel) {
            channel.members.forEach(id => recipients.add(id));
          }
        });
      }
    }
    
    return Array.from(recipients);
  }

  private getFileType(mimeType: string): Attachment['type'] {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('javascript') || mimeType.includes('typescript') || 
        mimeType.includes('python') || mimeType.includes('java')) return 'code';
    return 'file';
  }

  private async storeFile(file: any, userId: string): Promise<string> {
    // Implement file storage (S3, local, etc.)
    // This is a placeholder
    return `https://storage.example.com/files/${uuidv4()}/${file.name}`;
  }

  private async generateDownloadUrl(fileUrl: string): Promise<string> {
    // Generate signed URL for secure download
    // This is a placeholder
    return `${fileUrl}?token=${crypto.randomBytes(32).toString('hex')}`;
  }

  private async authenticateUser(token: string): Promise<User> {
    // Implement authentication logic
    // This is a placeholder
    return {
      id: 'user-' + crypto.randomBytes(4).toString('hex'),
      username: 'User',
      email: 'user@example.com',
      status: 'online',
    };
  }

  // Redis Handlers
  private handleRedisBroadcast(data: any): void {
    const broadcast = data as BroadcastMessage;
    const recipients = this.getBroadcastRecipients(broadcast);
    
    recipients.forEach(recipientId => {
      const recipientSockets = this.userSocketMap.get(recipientId);
      if (recipientSockets) {
        recipientSockets.forEach(socketId => {
          this.io.to(socketId).emit('broadcast:message', {
            broadcast,
            sender: this.getUserInfo(broadcast.sender),
          });
        });
      }
    });
  }

  private handleRedisMessage(data: any): void {
    if (data.action === 'new') {
      const { message, user } = data;
      this.io.to(message.channelId).emit('message:new', { message, user });
    }
  }

  private handleRedisPresence(data: any): void {
    const { userId, status } = data;
    this.broadcastPresence(userId, status);
  }

  // Monitoring
  private startPresenceMonitor(): void {
    setInterval(() => {
      const now = Date.now();
      
      this.presence.forEach((presence, userId) => {
        const lastSeenMs = presence.lastSeen.getTime();
        
        if (presence.status === 'online' && (now - lastSeenMs) > this.config.presenceTimeout) {
          // Mark as away
          presence.status = 'away';
          this.broadcastPresence(userId, 'away');
        }
      });
    }, 10000); // Check every 10 seconds
  }

  private startMessageCleanup(): void {
    // Clean old messages based on retention policy
    setInterval(() => {
      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() - this.config.messageRetentionDays);
      
      this.messages.forEach((messages, channelId) => {
        const channel = this.channels.get(channelId);
        const retention = channel?.settings?.messageRetention || this.config.messageRetentionDays;
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retention);
        
        // Remove old messages
        const filtered = messages.filter(m => m.timestamp > cutoffDate);
        if (filtered.length < messages.length) {
          this.messages.set(channelId, filtered);
        }
      });
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  // Shutdown
  async shutdown(): Promise<void> {
    this.io.close();
    await this.redis.quit();
    await this.pubClient.quit();
    await this.subClient.quit();
    this.removeAllListeners();
  }
}

// Export for use
export const createCommunicationHub = (server: HTTPServer) => {
  return new CommunicationHub(server);
};