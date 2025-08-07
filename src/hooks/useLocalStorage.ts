/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { useCallback, useEffect, useState } from 'react';

type SetValue<T> = T | ((prevValue: T) => T);

export function useLocalStorage<T>(
 key: string,
 initialValue: T,
 options?: {
 serialize?: (value: T) => string;
 deserialize?: (value: string) => T;
 }
): [T, (value: SetValue<T>) => void, () => void] {
 const serialize = options?.serialize ?? JSON.stringify;
 const deserialize = options?.deserialize ?? JSON.parse;

 const [storedValue, setStoredValue] = useState<T>(() => {
 if (typeof window === 'undefined') {
 return initialValue;
 }

 try {
 const item = window.localStorage.getItem(key);
 return item ? deserialize(item) : initialValue;
 } catch (error) {
 console.error(`Error reading localStorage key "${key}":`, error);
 return initialValue;
 }
 });

 const setValue = useCallback(
 (value: SetValue<T>) => {
 try {
 const valueToStore = value instanceof Function ? value(storedValue) : value;
 setStoredValue(valueToStore);

 if (typeof window !== 'undefined') {
 window.localStorage.setItem(key, serialize(valueToStore));
 }
 } catch (error) {
 console.error(`Error setting localStorage key "${key}":`, error);
 }
 },
 [key, serialize, storedValue]
 );

 const removeValue = useCallback(() => {
 try {
 setStoredValue(initialValue);
 if (typeof window !== 'undefined') {
 window.localStorage.removeItem(key);
 }
 } catch (error) {
 console.error(`Error removing localStorage key "${key}":`, error);
 }
 }, [initialValue, key]);

 useEffect(() => {
 const handleStorageChange = (e: StorageEvent) => {
 if (e.key === key && e.newValue !== null) {
 try {
 setStoredValue(deserialize(e.newValue));
 } catch (error) {
 console.error(`Error parsing localStorage change for key "${key}":`, error);
 }
 }
 };

 window.addEventListener('storage', handleStorageChange);
 return () => window.removeEventListener('storage', handleStorageChange);
 }, [key, deserialize]);

 return [storedValue, setValue, removeValue];
}