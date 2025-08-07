'use client';

import { createContext, useContext, useReducer, ReactNode, useCallback } from 'react';
import { toast } from 'react-hot-toast';

interface ErrorState {
 errors: Array<{
 id: string;
 message: string;
 type: 'error' | 'warning' | 'info';
 timestamp: Date;
 context?: string;
 dismissible?: boolean;
 actions?: Array<{
 label: string;
 action: () => void;
 }>;
 }>;
 isOnline: boolean;
 backstageAvailable: boolean;
 databaseAvailable: boolean;
}

type ErrorAction =
 | { type: 'ADD_ERROR'; payload: Omit<ErrorState['errors'][0], 'id' | 'timestamp'> }
 | { type: 'REMOVE_ERROR'; payload: string }
 | { type: 'CLEAR_ERRORS' }
 | { type: 'SET_ONLINE_STATUS'; payload: boolean }
 | { type: 'SET_BACKSTAGE_STATUS'; payload: boolean }
 | { type: 'SET_DATABASE_STATUS'; payload: boolean };

const initialState: ErrorState = {
 errors: [],
 isOnline: true,
 backstageAvailable: true,
 databaseAvailable: true,
};

function errorReducer(state: ErrorState, action: ErrorAction): ErrorState {
 switch (action.type) {
 case 'ADD_ERROR':
 return {
 ...state,
 errors: [
 ...state.errors,
 {
 ...action.payload,
 id: Math.random().toString(36).substr(2, 9),
 timestamp: new Date(),
 },
 ],
 };
 case 'REMOVE_ERROR':
 return {
 ...state,
 errors: state.errors.filter(error => error.id !== action.payload),
 };
 case 'CLEAR_ERRORS':
 return {
 ...state,
 errors: [],
 };
 case 'SET_ONLINE_STATUS':
 return {
 ...state,
 isOnline: action.payload,
 };
 case 'SET_BACKSTAGE_STATUS':
 return {
 ...state,
 backstageAvailable: action.payload,
 };
 case 'SET_DATABASE_STATUS':
 return {
 ...state,
 databaseAvailable: action.payload,
 };
 default:
 return state;
 }
}

interface ErrorContextType {
 state: ErrorState;
 addError: (error: Omit<ErrorState['errors'][0], 'id' | 'timestamp'>) => void;
 removeError: (id: string) => void;
 clearErrors: () => void;
 handleApiError: (error: any, context?: string) => void;
 setOnlineStatus: (online: boolean) => void;
 setBackstageStatus: (available: boolean) => void;
 setDatabaseStatus: (available: boolean) => void;
}

const ErrorContext = createContext<ErrorContextType | null>(null);

export function ErrorProvider({ children }: { children: ReactNode }) {
 const [state, dispatch] = useReducer(errorReducer, initialState);

 const addError = useCallback((error: Omit<ErrorState['errors'][0], 'id' | 'timestamp'>) => {
 dispatch({ type: 'ADD_ERROR', payload: error });
 
 // Show toast notification for errors
 if (error.type === 'error') {
 toast.error(error.message);
 } else if (error.type === 'warning') {
 toast(error.message, { icon: 'WARNING' });
 } else {
 toast(error.message, { icon: 'INFO' });
 }
 }, []);

 const removeError = useCallback((id: string) => {
 dispatch({ type: 'REMOVE_ERROR', payload: id });
 }, []);

 const clearErrors = useCallback(() => {
 dispatch({ type: 'CLEAR_ERRORS' });
 }, []);

 const handleApiError = useCallback((error: any, context?: string) => {
 let message = 'An unexpected error occurred';
 let type: 'error' | 'warning' | 'info' = 'error';

 if (error?.response?.status === 404) {
 message = 'Resource not found';
 type = 'warning';
 } else if (error?.response?.status === 401) {
 message = 'Authentication required';
 type = 'warning';
 } else if (error?.response?.status === 403) {
 message = 'Access denied';
 type = 'error';
 } else if (error?.response?.status >= 500) {
 message = 'Server error occurred';
 type = 'error';
 } else if (error?.message) {
 message = error.message;
 }

 // Check for specific Backstage connectivity issues
 if (error?.code === 'ECONNREFUSED' || message.includes('ECONNREFUSED')) {
 message = 'Backstage service is temporarily unavailable';
 type = 'warning';
 dispatch({ type: 'SET_BACKSTAGE_STATUS', payload: false });
 }

 // Check for network issues
 if (!navigator.onlineCase) {
 message = 'You appear to be offline';
 type = 'warning';
 dispatch({ type: 'SET_ONLINE_STATUS', payload: false });
 }

 addError({
 message,
 type,
 context,
 dismissible: true,
 });
 }, [addError]);

 const setOnlineStatus = useCallback((online: boolean) => {
 dispatch({ type: 'SET_ONLINE_STATUS', payload: online });
 
 if (online) {
 addError({
 message: 'Connection restored',
 type: 'info',
 dismissible: true,
 });
 } else {
 addError({
 message: 'Connection lost',
 type: 'warning',
 dismissible: true,
 });
 }
 }, [addError]);

 const setBackstageStatus = useCallback((available: boolean) => {
 dispatch({ type: 'SET_BACKSTAGE_STATUS', payload: available });
 
 if (available) {
 addError({
 message: 'Backstage service restored',
 type: 'info',
 dismissible: true,
 });
 } else {
 addError({
 message: 'Backstage service unavailable - using mock data',
 type: 'warning',
 dismissible: true,
 });
 }
 }, [addError]);

 const setDatabaseStatus = useCallback((available: boolean) => {
 dispatch({ type: 'SET_DATABASE_STATUS', payload: available });
 
 if (!available) {
 addError({
 message: 'Database connection issues detected',
 type: 'error',
 dismissible: true,
 });
 }
 }, [addError]);

 return (
 <ErrorContext.Provider
 value={{
 state,
 addError,
 removeError,
 clearErrors,
 handleApiError,
 setOnlineStatus,
 setBackstageStatus,
 setDatabaseStatus,
 }}
 >
 {children}
 </ErrorContext.Provider>
 );
}

export function useError() {
 const context = useContext(ErrorContext);
 if (!context) {
 throw new Error('useError must be used within an ErrorProvider');
 }
 return context;
}

// Custom hook for handling async operations with error handling
export function useAsyncOperation() {
 const { handleApiError } = useError();

 const execute = useCallback(
 async <T,>(
 operation: () => Promise<T>,
 context?: string
 ): Promise<T | null> => {
 try {
 return await operation();
 } catch (error) {
 handleApiError(error, context);
 return null;
 }
 },
 [handleApiError]
 );

 return { execute };
}