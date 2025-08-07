'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { webSocketService } from '@/lib/websocket/WebSocketService';
import { useWebSocketConnection } from '@/hooks/useWebSocket';

interface WebSocketContextType {
 connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
 isConnected: boolean;
 error: string | null;
 reconnect: () => Promise<void>;
 enableRealTimeUpdates: boolean;
 setEnableRealTimeUpdates: (enabled: boolean) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
 children: React.ReactNode;
 autoConnect?: boolean;
}

export function WebSocketProvider({ children, autoConnect = true }: WebSocketProviderProps) {
 const { connectionState, isConnected, error, reconnect } = useWebSocketConnection();
 const [enableRealTimeUpdates, setEnableRealTimeUpdates] = useState(true);

 // Load preference from localStorage
 useEffect(() => {
 const saved = localStorage.getItem('enableRealTimeUpdates');
 if (saved !== null) {
 setEnableRealTimeUpdates(JSON.parse(saved));
 }
 }, []);

 // Save preference to localStorage
 useEffect(() => {
 localStorage.setItem('enableRealTimeUpdates', JSON.stringify(enableRealTimeUpdates));
 }, [enableRealTimeUpdates]);

 // Disconnect when real-time updates are disabled
 useEffect(() => {
 if (!enableRealTimeUpdates && isConnected) {
 webSocketService.disconnect();
 } else if (enableRealTimeUpdates && connectionState === 'disconnected' && autoConnect) {
 reconnect();
 }
 }, [enableRealTimeUpdates, isConnected, connectionState, autoConnect, reconnect]);

 const contextValue: WebSocketContextType = {
 connectionState,
 isConnected: isConnected && enableRealTimeUpdates,
 error,
 reconnect,
 enableRealTimeUpdates,
 setEnableRealTimeUpdates
 };

 return (
 <WebSocketContext.Provider value={contextValue}>
 {children}
 </WebSocketContext.Provider>
 );
}

export function useWebSocketContext() {
 const context = useContext(WebSocketContext);
 if (context === undefined) {
 throw new Error('useWebSocketContext must be used within a WebSocketProvider');
 }
 return context;
}

// WebSocket status indicator component
export function WebSocketStatusIndicator() {
 const { connectionState, isConnected, error, reconnect, enableRealTimeUpdates, setEnableRealTimeUpdates } = useWebSocketContext();

 const getStatusColor = () => {
 if (!enableRealTimeUpdates) return 'bg-gray-400';
 switch (connectionState) {
 case 'connected': return 'bg-green-500';
 case 'connecting': return 'bg-yellow-500';
 case 'error': return 'bg-red-500';
 default: return 'bg-gray-400';
 }
 };

 const getStatusText = () => {
 if (!enableRealTimeUpdates) return 'Real-time updates disabled';
 switch (connectionState) {
 case 'connected': return 'Live updates active';
 case 'connecting': return 'Connecting...';
 case 'error': return error || 'Connection error';
 default: return 'Disconnected';
 }
 };

 return (
 <div className="flex items-center gap-2">
 <div className="relative">
 <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
 {isConnected && (
 <div className={`absolute inset-0 w-2 h-2 rounded-full ${getStatusColor()} animate-ping`} />
 )}
 </div>
 <span className="text-xs text-gray-600 dark:text-gray-400">
 {getStatusText()}
 </span>
 
 {/* Toggle button */}
 <button
 onClick={() => setEnableRealTimeUpdates(!enableRealTimeUpdates)}
 className={`text-xs px-2 py-1 rounded ${
 enableRealTimeUpdates 
 ? 'bg-green-100 text-green-800 hover:bg-green-200' 
 : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
 }`}
 title={enableRealTimeUpdates ? 'Disable real-time updates' : 'Enable real-time updates'}
 >
 {enableRealTimeUpdates ? 'ON' : 'OFF'}
 </button>

 {/* Reconnect button when needed */}
 {enableRealTimeUpdates && (connectionState === 'error' || connectionState === 'disconnected') && (
 <button
 onClick={reconnect}
 className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
 title="Reconnect"
 >
 Reconnect
 </button>
 )}
 </div>
 );
}