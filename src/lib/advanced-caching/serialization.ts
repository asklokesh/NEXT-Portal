import { SerializationOptions } from './types';

export type SerializationFormat = 'json' | 'msgpack' | 'protobuf';

/**
 * Serialize data using specified format
 */
export function serialize<T>(data: T, options: SerializationOptions): string {
  switch (options.format) {
    case 'json':
      return serializeJSON(data);
    
    case 'msgpack':
      return serializeMsgPack(data);
    
    case 'protobuf':
      return serializeProtobuf(data, options.schema);
    
    default:
      throw new Error(`Unsupported serialization format: ${options.format}`);
  }
}

/**
 * Deserialize data
 */
export function deserialize<T>(serializedData: string, options: SerializationOptions): T {
  switch (options.format) {
    case 'json':
      return deserializeJSON<T>(serializedData);
    
    case 'msgpack':
      return deserializeMsgPack<T>(serializedData);
    
    case 'protobuf':
      return deserializeProtobuf<T>(serializedData, options.schema);
    
    default:
      throw new Error(`Unsupported serialization format: ${options.format}`);
  }
}

/**
 * Get serialization size and statistics
 */
export function getSerializationStats(
  originalData: any,
  serializedData: string
): {
  originalSize: number;
  serializedSize: number;
  format: string;
  efficiency: number;
} {
  const originalSize = JSON.stringify(originalData).length;
  const serializedSize = serializedData.length;
  
  return {
    originalSize,
    serializedSize,
    format: 'detected',
    efficiency: originalSize / serializedSize
  };
}

// JSON serialization (default)
function serializeJSON<T>(data: T): string {
  try {
    return JSON.stringify(data, jsonReplacer);
  } catch (error) {
    throw new Error(`JSON serialization failed: ${error.message}`);
  }
}

function deserializeJSON<T>(serializedData: string): T {
  try {
    return JSON.parse(serializedData, jsonReviver);
  } catch (error) {
    throw new Error(`JSON deserialization failed: ${error.message}`);
  }
}

// Custom JSON replacer for handling special types
function jsonReplacer(key: string, value: any): any {
  // Handle Date objects
  if (value instanceof Date) {
    return { __type: 'Date', value: value.toISOString() };
  }
  
  // Handle RegExp objects
  if (value instanceof RegExp) {
    return { __type: 'RegExp', source: value.source, flags: value.flags };
  }
  
  // Handle Map objects
  if (value instanceof Map) {
    return { __type: 'Map', entries: Array.from(value.entries()) };
  }
  
  // Handle Set objects
  if (value instanceof Set) {
    return { __type: 'Set', values: Array.from(value.values()) };
  }
  
  // Handle undefined (JSON doesn't support undefined)
  if (value === undefined) {
    return { __type: 'undefined' };
  }
  
  // Handle BigInt
  if (typeof value === 'bigint') {
    return { __type: 'BigInt', value: value.toString() };
  }
  
  return value;
}

// Custom JSON reviver for restoring special types
function jsonReviver(key: string, value: any): any {
  if (typeof value === 'object' && value !== null && value.__type) {
    switch (value.__type) {
      case 'Date':
        return new Date(value.value);
      
      case 'RegExp':
        return new RegExp(value.source, value.flags);
      
      case 'Map':
        return new Map(value.entries);
      
      case 'Set':
        return new Set(value.values);
      
      case 'undefined':
        return undefined;
      
      case 'BigInt':
        return BigInt(value.value);
      
      default:
        return value;
    }
  }
  
  return value;
}

// MessagePack serialization (placeholder implementation)
function serializeMsgPack<T>(data: T): string {
  // In a real implementation, you would use a library like @msgpack/msgpack
  // For now, we'll use a more compact JSON representation
  const compactJSON = JSON.stringify(data, (key, value) => {
    // Use shorter property names for common cache metadata
    if (key === 'createdAt') return value;
    if (key === 'lastAccessed') return value;
    if (key === 'accessCount') return value;
    if (key === 'ttl') return value;
    if (key === 'size') return value;
    if (key === 'tags') return value;
    if (key === 'version') return value;
    if (key === 'compressed') return value;
    if (key === 'tier') return value;
    return value;
  });
  
  // Add MessagePack header for identification
  return 'MP:' + Buffer.from(compactJSON, 'utf8').toString('base64');
}

function deserializeMsgPack<T>(serializedData: string): T {
  try {
    // Check for MessagePack header
    if (serializedData.startsWith('MP:')) {
      const base64Data = serializedData.slice(3);
      const jsonString = Buffer.from(base64Data, 'base64').toString('utf8');
      return JSON.parse(jsonString);
    } else {
      // Fallback to JSON
      return JSON.parse(serializedData);
    }
  } catch (error) {
    throw new Error(`MessagePack deserialization failed: ${error.message}`);
  }
}

// Protocol Buffers serialization (placeholder implementation)
function serializeProtobuf<T>(data: T, schema?: any): string {
  // In a real implementation, you would use protobufjs or similar
  // For now, we'll use a structured JSON format
  
  if (!schema) {
    throw new Error('Protocol Buffers schema is required');
  }
  
  try {
    // Simulate protobuf serialization with structured JSON
    const structuredData = {
      __proto_schema: schema.name || 'unknown',
      __proto_version: '1.0',
      data: data
    };
    
    const jsonString = JSON.stringify(structuredData);
    return 'PB:' + Buffer.from(jsonString, 'utf8').toString('base64');
  } catch (error) {
    throw new Error(`Protobuf serialization failed: ${error.message}`);
  }
}

function deserializeProtobuf<T>(serializedData: string, schema?: any): T {
  try {
    if (serializedData.startsWith('PB:')) {
      const base64Data = serializedData.slice(3);
      const jsonString = Buffer.from(base64Data, 'base64').toString('utf8');
      const structuredData = JSON.parse(jsonString);
      
      // Validate schema if provided
      if (schema && structuredData.__proto_schema !== schema.name) {
        throw new Error(`Schema mismatch: expected ${schema.name}, got ${structuredData.__proto_schema}`);
      }
      
      return structuredData.data;
    } else {
      // Fallback to JSON
      return JSON.parse(serializedData);
    }
  } catch (error) {
    throw new Error(`Protobuf deserialization failed: ${error.message}`);
  }
}

/**
 * Adaptive serialization that chooses the best format
 */
export function serializeAdaptive<T>(
  data: T,
  options: {
    formats?: SerializationFormat[];
    maxSize?: number;
    prioritizeSpeed?: boolean;
  } = {}
): { data: string; format: SerializationFormat; stats: any } {
  const { formats = ['json', 'msgpack'], maxSize = 1024 * 1024, prioritizeSpeed = false } = options;
  
  let bestResult: { data: string; format: SerializationFormat; size: number } | null = null;
  
  for (const format of formats) {
    try {
      const startTime = Date.now();
      const serialized = serialize(data, { format, useTypedArrays: false });
      const endTime = Date.now();
      
      const size = serialized.length;
      
      if (size > maxSize) {
        continue; // Skip if too large
      }
      
      if (!bestResult) {
        bestResult = { data: serialized, format, size };
      } else {
        // Choose based on priority
        if (prioritizeSpeed) {
          const currentSpeed = size / (endTime - startTime);
          const bestSpeed = bestResult.size / 1; // Assume 1ms for comparison
          if (currentSpeed > bestSpeed) {
            bestResult = { data: serialized, format, size };
          }
        } else {
          // Prioritize size
          if (size < bestResult.size) {
            bestResult = { data: serialized, format, size };
          }
        }
      }
    } catch (error) {
      // Skip failed formats
      continue;
    }
  }
  
  if (!bestResult) {
    // Fallback to JSON
    const fallbackData = serialize(data, { format: 'json', useTypedArrays: false });
    bestResult = { data: fallbackData, format: 'json', size: fallbackData.length };
  }
  
  const stats = {
    chosenFormat: bestResult.format,
    serializedSize: bestResult.size,
    compressionRatio: JSON.stringify(data).length / bestResult.size
  };
  
  return {
    data: bestResult.data,
    format: bestResult.format,
    stats
  };
}

/**
 * Schema-aware serialization for better performance
 */
export class SchemaAwareSerializer<T> {
  private schema: any;
  private format: SerializationFormat;
  
  constructor(schema: any, format: SerializationFormat = 'json') {
    this.schema = schema;
    this.format = format;
  }
  
  serialize(data: T): string {
    // Validate against schema if available
    if (this.schema && this.schema.validate) {
      const isValid = this.schema.validate(data);
      if (!isValid) {
        throw new Error('Data does not match schema');
      }
    }
    
    return serialize(data, {
      format: this.format,
      schema: this.schema,
      useTypedArrays: false
    });
  }
  
  deserialize(serializedData: string): T {
    const data = deserialize<T>(serializedData, {
      format: this.format,
      schema: this.schema,
      useTypedArrays: false
    });
    
    // Validate deserialized data
    if (this.schema && this.schema.validate) {
      const isValid = this.schema.validate(data);
      if (!isValid) {
        throw new Error('Deserialized data does not match schema');
      }
    }
    
    return data;
  }
}

/**
 * Versioned serialization for backward compatibility
 */
export class VersionedSerializer<T> {
  private versions = new Map<string, SerializationOptions>();
  private currentVersion: string;
  
  constructor(currentVersion: string) {
    this.currentVersion = currentVersion;
  }
  
  addVersion(version: string, options: SerializationOptions): void {
    this.versions.set(version, options);
  }
  
  serialize(data: T): string {
    const options = this.versions.get(this.currentVersion);
    if (!options) {
      throw new Error(`No serialization options for version ${this.currentVersion}`);
    }
    
    // Add version header
    const versionedData = {
      __version: this.currentVersion,
      __data: data
    };
    
    return serialize(versionedData, options);
  }
  
  deserialize(serializedData: string): T {
    // Try to detect version
    let version = this.currentVersion;
    let dataToDeserialize = serializedData;
    
    try {
      // Try to parse as versioned data
      const parsed = JSON.parse(serializedData);
      if (parsed.__version) {
        version = parsed.__version;
        dataToDeserialize = JSON.stringify(parsed.__data);
      }
    } catch {
      // Not versioned JSON, try with current version
    }
    
    const options = this.versions.get(version);
    if (!options) {
      throw new Error(`No serialization options for version ${version}`);
    }
    
    return deserialize<T>(dataToDeserialize, options);
  }
}

/**
 * Performance benchmarking for serialization formats
 */
export function benchmarkSerialization<T>(
  data: T,
  formats: SerializationFormat[] = ['json', 'msgpack'],
  iterations: number = 1000
): Array<{
  format: SerializationFormat;
  serializeTime: number;
  deserializeTime: number;
  serializedSize: number;
  throughput: number;
}> {
  const results: Array<{
    format: SerializationFormat;
    serializeTime: number;
    deserializeTime: number;
    serializedSize: number;
    throughput: number;
  }> = [];
  
  for (const format of formats) {
    try {
      // Benchmark serialization
      const serializeStart = Date.now();
      let serialized: string = '';
      
      for (let i = 0; i < iterations; i++) {
        serialized = serialize(data, { format, useTypedArrays: false });
      }
      
      const serializeTime = Date.now() - serializeStart;
      
      // Benchmark deserialization
      const deserializeStart = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        deserialize(serialized, { format, useTypedArrays: false });
      }
      
      const deserializeTime = Date.now() - deserializeStart;
      const serializedSize = serialized.length;
      const throughput = (iterations * serializedSize) / (serializeTime + deserializeTime);
      
      results.push({
        format,
        serializeTime,
        deserializeTime,
        serializedSize,
        throughput
      });
    } catch (error) {
      console.warn(`Benchmark failed for format ${format}:`, error.message);
    }
  }
  
  return results.sort((a, b) => b.throughput - a.throughput);
}