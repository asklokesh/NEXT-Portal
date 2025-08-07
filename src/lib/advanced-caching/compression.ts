import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export type CompressionAlgorithm = 'gzip' | 'lz4' | 'snappy';

export interface CompressionOptions {
  algorithm: CompressionAlgorithm;
  level?: number; // Compression level (1-9 for gzip)
  threshold?: number; // Only compress if data is larger than this
}

/**
 * Compress data using specified algorithm
 */
export async function compress(
  data: Buffer,
  algorithm: CompressionAlgorithm = 'gzip',
  options: { level?: number } = {}
): Promise<Buffer> {
  switch (algorithm) {
    case 'gzip':
      return compressGzip(data, options.level);
    
    case 'lz4':
      // LZ4 implementation would go here
      // For now, fallback to gzip
      return compressGzip(data, options.level);
    
    case 'snappy':
      // Snappy implementation would go here
      // For now, fallback to gzip
      return compressGzip(data, options.level);
    
    default:
      throw new Error(`Unsupported compression algorithm: ${algorithm}`);
  }
}

/**
 * Decompress data
 */
export async function decompress(
  compressedData: Buffer,
  algorithm?: CompressionAlgorithm
): Promise<Buffer> {
  // Try to detect compression format from header if not specified
  if (!algorithm) {
    algorithm = detectCompressionFormat(compressedData);
  }
  
  switch (algorithm) {
    case 'gzip':
      return decompressGzip(compressedData);
    
    case 'lz4':
      // LZ4 decompression would go here
      return decompressGzip(compressedData);
    
    case 'snappy':
      // Snappy decompression would go here
      return decompressGzip(compressedData);
    
    default:
      throw new Error(`Unsupported compression algorithm: ${algorithm}`);
  }
}

/**
 * Get compression ratio and statistics
 */
export function getCompressionStats(
  originalData: Buffer,
  compressedData: Buffer
): {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  spacesSaved: number;
  compressionPercentage: number;
} {
  const originalSize = originalData.length;
  const compressedSize = compressedData.length;
  const compressionRatio = originalSize / compressedSize;
  const spacesSaved = originalSize - compressedSize;
  const compressionPercentage = ((spacesSaved / originalSize) * 100);

  return {
    originalSize,
    compressedSize,
    compressionRatio,
    spacesSaved,
    compressionPercentage
  };
}

/**
 * Check if data should be compressed based on size and content
 */
export function shouldCompress(
  data: Buffer,
  options: {
    minSize?: number;
    maxSize?: number;
    contentTypes?: string[];
  } = {}
): boolean {
  const { minSize = 1024, maxSize = 10 * 1024 * 1024 } = options;
  
  // Check size constraints
  if (data.length < minSize || data.length > maxSize) {
    return false;
  }
  
  // Check entropy - highly compressed data won't benefit from compression
  const entropy = calculateEntropy(data);
  if (entropy < 0.5) {
    return false; // Already highly compressed
  }
  
  return true;
}

// Private implementations

async function compressGzip(data: Buffer, level: number = 6): Promise<Buffer> {
  try {
    const compressed = await gzipAsync(data, { level });
    
    // Add custom header to identify compression algorithm
    const header = Buffer.from('GZIP', 'utf8');
    return Buffer.concat([header, compressed]);
  } catch (error) {
    throw new Error(`Gzip compression failed: ${error.message}`);
  }
}

async function decompressGzip(compressedData: Buffer): Promise<Buffer> {
  try {
    // Remove custom header if present
    let dataToDecompress = compressedData;
    if (compressedData.subarray(0, 4).toString('utf8') === 'GZIP') {
      dataToDecompress = compressedData.subarray(4);
    }
    
    return await gunzipAsync(dataToDecompress);
  } catch (error) {
    throw new Error(`Gzip decompression failed: ${error.message}`);
  }
}

function detectCompressionFormat(data: Buffer): CompressionAlgorithm {
  // Check for custom headers
  if (data.subarray(0, 4).toString('utf8') === 'GZIP') {
    return 'gzip';
  }
  
  // Check for gzip magic numbers
  if (data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b) {
    return 'gzip';
  }
  
  // Default to gzip if can't detect
  return 'gzip';
}

function calculateEntropy(data: Buffer): number {
  const frequency = new Map<number, number>();
  
  // Count byte frequencies
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    frequency.set(byte, (frequency.get(byte) || 0) + 1);
  }
  
  // Calculate Shannon entropy
  let entropy = 0;
  const length = data.length;
  
  for (const count of frequency.values()) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }
  
  return entropy / 8; // Normalize to 0-1 range
}

/**
 * Adaptive compression that chooses the best algorithm
 */
export async function compressAdaptive(
  data: Buffer,
  options: {
    algorithms?: CompressionAlgorithm[];
    maxTime?: number; // Max time to spend on compression selection
  } = {}
): Promise<{ data: Buffer; algorithm: CompressionAlgorithm; stats: any }> {
  const { algorithms = ['gzip'], maxTime = 1000 } = options;
  const startTime = Date.now();
  
  let bestResult: { data: Buffer; algorithm: CompressionAlgorithm; ratio: number } | null = null;
  
  for (const algorithm of algorithms) {
    if (Date.now() - startTime > maxTime) {
      break; // Time limit exceeded
    }
    
    try {
      const compressed = await compress(data, algorithm);
      const ratio = data.length / compressed.length;
      
      if (!bestResult || ratio > bestResult.ratio) {
        bestResult = { data: compressed, algorithm, ratio };
      }
    } catch (error) {
      // Skip failed algorithms
      continue;
    }
  }
  
  if (!bestResult) {
    // Fallback to no compression
    return {
      data,
      algorithm: 'gzip',
      stats: {
        originalSize: data.length,
        compressedSize: data.length,
        compressionRatio: 1,
        spacesSaved: 0,
        compressionPercentage: 0
      }
    };
  }
  
  const stats = getCompressionStats(data, bestResult.data);
  
  return {
    data: bestResult.data,
    algorithm: bestResult.algorithm,
    stats
  };
}

/**
 * Streaming compression for large data
 */
export class StreamingCompressor {
  private algorithm: CompressionAlgorithm;
  private chunks: Buffer[] = [];
  
  constructor(algorithm: CompressionAlgorithm = 'gzip') {
    this.algorithm = algorithm;
  }
  
  write(chunk: Buffer): void {
    this.chunks.push(chunk);
  }
  
  async finish(): Promise<Buffer> {
    const combined = Buffer.concat(this.chunks);
    const compressed = await compress(combined, this.algorithm);
    this.chunks = []; // Reset for reuse
    return compressed;
  }
  
  reset(): void {
    this.chunks = [];
  }
}

/**
 * Dictionary-based compression for repetitive data
 */
export class DictionaryCompressor {
  private dictionary = new Map<string, number>();
  private reverseDict = new Map<number, string>();
  private nextId = 0;
  
  compress(data: string): Buffer {
    const tokens: number[] = [];
    const words = data.split(/\s+/);
    
    for (const word of words) {
      if (!this.dictionary.has(word)) {
        this.dictionary.set(word, this.nextId);
        this.reverseDict.set(this.nextId, word);
        this.nextId++;
      }
      tokens.push(this.dictionary.get(word)!);
    }
    
    // Simple encoding: dictionary + tokens
    const dictJson = JSON.stringify(Object.fromEntries(this.reverseDict));
    const dictBuffer = Buffer.from(dictJson, 'utf8');
    const tokensBuffer = Buffer.from(new Uint32Array(tokens).buffer);
    
    const dictSizeBuffer = Buffer.allocUnsafe(4);
    dictSizeBuffer.writeUInt32BE(dictBuffer.length, 0);
    
    return Buffer.concat([dictSizeBuffer, dictBuffer, tokensBuffer]);
  }
  
  decompress(compressedData: Buffer): string {
    const dictSize = compressedData.readUInt32BE(0);
    const dictBuffer = compressedData.subarray(4, 4 + dictSize);
    const tokensBuffer = compressedData.subarray(4 + dictSize);
    
    const dictJson = dictBuffer.toString('utf8');
    const dictionary = new Map(Object.entries(JSON.parse(dictJson)).map(([k, v]) => [parseInt(k), v as string]));
    
    const tokens = new Uint32Array(tokensBuffer.buffer, tokensBuffer.byteOffset, tokensBuffer.length / 4);
    
    const words: string[] = [];
    for (const token of tokens) {
      words.push(dictionary.get(token) || '');
    }
    
    return words.join(' ');
  }
}