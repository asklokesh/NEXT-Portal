import { OpenAI } from 'openai';
import * as tf from '@tensorflow/tfjs-node';
import vision from '@google-cloud/vision';
import speech from '@google-cloud/speech';
import { Redis } from 'ioredis';
import { VectorDBManager } from './vector-db-service';
import { logger } from '../monitoring/logger';

export interface VisualSearchQuery {
  image: Buffer | string; // Base64 or buffer
  mimeType: string;
  searchType: 'screenshot' | 'diagram' | 'ui' | 'code' | 'architecture';
  context?: Record<string, any>;
}

export interface VoiceSearchQuery {
  audio: Buffer | string; // Base64 or buffer
  format: 'wav' | 'mp3' | 'ogg' | 'flac';
  sampleRate: number;
  language?: string;
  context?: Record<string, any>;
}

export interface MultimodalSearchResult {
  type: 'visual' | 'voice' | 'text';
  query: string;
  extractedEntities: string[];
  detectedIntent: string;
  confidence: number;
  results: any[];
  metadata: Record<string, any>;
}

export class MultimodalSearchEngine {
  private openai: OpenAI;
  private visionClient: vision.ImageAnnotatorClient;
  private speechClient: speech.SpeechClient;
  private vectorDB: VectorDBManager;
  private redis: Redis;
  private imageModel?: tf.LayersModel;
  private audioModel?: tf.LayersModel;

  constructor(
    vectorDB: VectorDBManager,
    openaiApiKey: string,
    googleCredentials: any,
    redisUrl?: string
  ) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.vectorDB = vectorDB;
    this.redis = new Redis(redisUrl || 'redis://localhost:6379');
    
    // Initialize Google Cloud clients
    this.visionClient = new vision.ImageAnnotatorClient({
      credentials: googleCredentials
    });
    
    this.speechClient = new speech.SpeechClient({
      credentials: googleCredentials
    });

    this.initializeModels();
  }

  private async initializeModels() {
    try {
      // Load image understanding model
      this.imageModel = await this.loadImageModel();
      
      // Load audio processing model
      this.audioModel = await this.loadAudioModel();
      
      logger.info('Multimodal models initialized');
    } catch (error) {
      logger.error('Failed to initialize multimodal models', error);
    }
  }

  private async loadImageModel(): Promise<tf.LayersModel> {
    try {
      // Try to load MobileNet for image feature extraction
      const mobilenet = await tf.loadLayersModel(
        'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v3_small_100_224/feature_vector/5/default/1'
      );
      return mobilenet;
    } catch {
      // Fallback to custom model
      return this.createCustomImageModel();
    }
  }

  private createCustomImageModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.conv2d({
          inputShape: [224, 224, 3],
          filters: 32,
          kernelSize: 3,
          activation: 'relu'
        }),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        tf.layers.conv2d({ filters: 64, kernelSize: 3, activation: 'relu' }),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        tf.layers.flatten(),
        tf.layers.dense({ units: 128, activation: 'relu' }),
        tf.layers.dense({ units: 64, activation: 'relu' })
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError'
    });

    return model;
  }

  private async loadAudioModel(): Promise<tf.LayersModel> {
    // Create audio processing model for feature extraction
    const model = tf.sequential({
      layers: [
        tf.layers.conv1d({
          inputShape: [16000, 1], // 1 second at 16kHz
          filters: 32,
          kernelSize: 8,
          activation: 'relu'
        }),
        tf.layers.maxPooling1d({ poolSize: 4 }),
        tf.layers.conv1d({ filters: 64, kernelSize: 4, activation: 'relu' }),
        tf.layers.maxPooling1d({ poolSize: 4 }),
        tf.layers.flatten(),
        tf.layers.dense({ units: 128, activation: 'relu' }),
        tf.layers.dense({ units: 64, activation: 'relu' })
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError'
    });

    return model;
  }

  // Visual Search Implementation
  async visualSearch(query: VisualSearchQuery): Promise<MultimodalSearchResult> {
    try {
      // 1. Extract visual features and text from image
      const visualAnalysis = await this.analyzeImage(query);
      
      // 2. Generate search query from visual content
      const searchQuery = await this.generateQueryFromVisual(visualAnalysis, query.searchType);
      
      // 3. Extract entities and intent
      const entities = await this.extractVisualEntities(visualAnalysis);
      const intent = this.detectVisualIntent(query.searchType, visualAnalysis);
      
      // 4. Perform vector search
      const searchResults = await this.vectorDB.search(searchQuery, {
        limit: 20,
        filter: this.buildVisualSearchFilters(query.searchType, entities)
      });
      
      // 5. Re-rank based on visual similarity
      const rerankedResults = await this.rerankByVisualSimilarity(
        searchResults,
        visualAnalysis
      );
      
      // 6. Log visual search for analytics
      await this.logVisualSearch(query, searchQuery, rerankedResults);

      return {
        type: 'visual',
        query: searchQuery,
        extractedEntities: entities,
        detectedIntent: intent,
        confidence: visualAnalysis.confidence,
        results: rerankedResults,
        metadata: {
          searchType: query.searchType,
          detectedObjects: visualAnalysis.objects,
          detectedText: visualAnalysis.text,
          dominantColors: visualAnalysis.colors
        }
      };
    } catch (error) {
      logger.error('Visual search failed', error);
      throw error;
    }
  }

  private async analyzeImage(query: VisualSearchQuery): Promise<any> {
    const imageBuffer = typeof query.image === 'string' 
      ? Buffer.from(query.image, 'base64')
      : query.image;

    // Use Google Vision API for comprehensive analysis
    const [result] = await this.visionClient.annotateImage({
      image: { content: imageBuffer.toString('base64') },
      features: [
        { type: 'TEXT_DETECTION' },
        { type: 'OBJECT_LOCALIZATION' },
        { type: 'LABEL_DETECTION' },
        { type: 'IMAGE_PROPERTIES' },
        { type: 'WEB_DETECTION' }
      ]
    });

    // Use GPT-4 Vision for additional understanding
    const gptAnalysis = await this.analyzeWithGPT4Vision(imageBuffer, query.searchType);

    return {
      text: result.textAnnotations?.[0]?.description || '',
      objects: result.localizedObjectAnnotations?.map(obj => ({
        name: obj.name,
        confidence: obj.score,
        boundingBox: obj.boundingPoly
      })) || [],
      labels: result.labelAnnotations?.map(label => ({
        description: label.description,
        score: label.score
      })) || [],
      colors: result.imagePropertiesAnnotation?.dominantColors?.colors || [],
      webEntities: result.webDetection?.webEntities || [],
      confidence: result.labelAnnotations?.[0]?.score || 0.5,
      gptAnalysis
    };
  }

  private async analyzeWithGPT4Vision(
    imageBuffer: Buffer,
    searchType: string
  ): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'system',
          content: `Analyze this ${searchType} image and describe what you see. Focus on technical elements, UI components, architecture patterns, or code structure as relevant.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}`
              }
            },
            {
              type: 'text',
              text: 'What search queries would help find similar content in a developer portal?'
            }
          ]
        }
      ],
      max_tokens: 300
    });

    return response.choices[0].message.content || '';
  }

  private async generateQueryFromVisual(
    analysis: any,
    searchType: string
  ): Promise<string> {
    // Combine different visual elements to create search query
    const elements: string[] = [];

    // Add detected text
    if (analysis.text) {
      const cleanText = analysis.text
        .replace(/\n/g, ' ')
        .substring(0, 100)
        .trim();
      if (cleanText) elements.push(cleanText);
    }

    // Add relevant labels
    analysis.labels?.slice(0, 3).forEach((label: any) => {
      if (label.score > 0.7) {
        elements.push(label.description);
      }
    });

    // Add GPT analysis insights
    if (analysis.gptAnalysis) {
      const keywords = this.extractKeywords(analysis.gptAnalysis);
      elements.push(...keywords.slice(0, 3));
    }

    // Combine based on search type
    let query = elements.join(' ');
    
    switch (searchType) {
      case 'screenshot':
        query = `UI component ${query}`;
        break;
      case 'diagram':
        query = `architecture diagram ${query}`;
        break;
      case 'code':
        query = `code snippet ${query}`;
        break;
      case 'architecture':
        query = `system design ${query}`;
        break;
    }

    return query;
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - in production, use NLP library
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    const words = text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
    
    // Return unique keywords
    return [...new Set(words)].slice(0, 10);
  }

  private async extractVisualEntities(analysis: any): Promise<string[]> {
    const entities = new Set<string>();

    // Extract from detected objects
    analysis.objects?.forEach((obj: any) => {
      if (obj.confidence > 0.5) {
        entities.add(obj.name.toLowerCase());
      }
    });

    // Extract from labels
    analysis.labels?.forEach((label: any) => {
      if (label.score > 0.6) {
        entities.add(label.description.toLowerCase());
      }
    });

    // Extract from web entities
    analysis.webEntities?.forEach((entity: any) => {
      if (entity.score > 0.5) {
        entities.add(entity.description.toLowerCase());
      }
    });

    return Array.from(entities);
  }

  private detectVisualIntent(searchType: string, analysis: any): string {
    // Determine intent based on visual content
    if (searchType === 'screenshot' && analysis.text?.includes('error')) {
      return 'troubleshooting';
    }
    
    if (searchType === 'diagram') {
      return 'architecture_review';
    }
    
    if (searchType === 'code') {
      return 'code_example';
    }
    
    if (analysis.labels?.some((l: any) => l.description.includes('dashboard'))) {
      return 'monitoring';
    }
    
    return 'discovery';
  }

  private buildVisualSearchFilters(
    searchType: string,
    entities: string[]
  ): Record<string, any> {
    const filters: Record<string, any> = {};

    switch (searchType) {
      case 'screenshot':
        filters.type = ['component', 'ui', 'template'];
        break;
      case 'diagram':
        filters.type = ['architecture', 'documentation', 'design'];
        break;
      case 'code':
        filters.type = ['api', 'component', 'plugin', 'template'];
        break;
    }

    if (entities.length > 0) {
      filters.tags = { $in: entities };
    }

    return filters;
  }

  private async rerankByVisualSimilarity(
    results: any[],
    visualAnalysis: any
  ): Promise<any[]> {
    // In production, compute visual embeddings and compare
    // For now, boost results that match visual entities
    const visualEntities = new Set(
      visualAnalysis.labels?.map((l: any) => l.description.toLowerCase()) || []
    );

    return results.map(result => {
      let boost = 1.0;
      
      // Check if result tags match visual entities
      result.metadata.tags?.forEach((tag: string) => {
        if (visualEntities.has(tag.toLowerCase())) {
          boost += 0.1;
        }
      });
      
      // Apply boost to score
      result.metadata.score = (result.metadata.score || 0.5) * boost;
      
      return result;
    }).sort((a, b) => b.metadata.score - a.metadata.score);
  }

  // Voice Search Implementation
  async voiceSearch(query: VoiceSearchQuery): Promise<MultimodalSearchResult> {
    try {
      // 1. Convert speech to text
      const transcription = await this.transcribeAudio(query);
      
      // 2. Analyze voice characteristics for context
      const voiceAnalysis = await this.analyzeVoiceCharacteristics(query);
      
      // 3. Extract intent from voice patterns
      const intent = this.detectVoiceIntent(transcription, voiceAnalysis);
      
      // 4. Enhance query based on voice analysis
      const enhancedQuery = await this.enhanceVoiceQuery(
        transcription.text,
        voiceAnalysis,
        intent
      );
      
      // 5. Perform search
      const searchResults = await this.vectorDB.search(enhancedQuery, {
        limit: 15,
        filter: this.buildVoiceSearchFilters(intent, voiceAnalysis)
      });
      
      // 6. Generate voice-optimized response
      const voiceOptimizedResults = await this.optimizeForVoiceResponse(searchResults);
      
      // 7. Log voice search
      await this.logVoiceSearch(query, transcription, voiceOptimizedResults);

      return {
        type: 'voice',
        query: enhancedQuery,
        extractedEntities: transcription.entities,
        detectedIntent: intent,
        confidence: transcription.confidence,
        results: voiceOptimizedResults,
        metadata: {
          originalTranscription: transcription.text,
          alternatives: transcription.alternatives,
          language: transcription.language,
          sentiment: voiceAnalysis.sentiment,
          urgency: voiceAnalysis.urgency
        }
      };
    } catch (error) {
      logger.error('Voice search failed', error);
      throw error;
    }
  }

  private async transcribeAudio(query: VoiceSearchQuery): Promise<any> {
    const audioBuffer = typeof query.audio === 'string'
      ? Buffer.from(query.audio, 'base64')
      : query.audio;

    // Configure speech recognition
    const request = {
      config: {
        encoding: this.getAudioEncoding(query.format),
        sampleRateHertz: query.sampleRate,
        languageCode: query.language || 'en-US',
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: true,
        model: 'latest_long',
        useEnhanced: true,
        alternativeLanguageCodes: ['en-GB', 'en-IN']
      },
      audio: {
        content: audioBuffer.toString('base64')
      }
    };

    // Perform speech recognition
    const [response] = await this.speechClient.recognize(request);
    const transcription = response.results?.[0];

    if (!transcription) {
      throw new Error('No transcription available');
    }

    // Extract entities using NLP
    const entities = await this.extractEntitiesFromText(
      transcription.alternatives?.[0]?.transcript || ''
    );

    return {
      text: transcription.alternatives?.[0]?.transcript || '',
      confidence: transcription.alternatives?.[0]?.confidence || 0,
      alternatives: transcription.alternatives?.slice(1, 3).map(alt => alt.transcript) || [],
      language: query.language || 'en-US',
      entities,
      words: transcription.alternatives?.[0]?.words || []
    };
  }

  private getAudioEncoding(format: string): any {
    const encodings: Record<string, any> = {
      'wav': 'LINEAR16',
      'mp3': 'MP3',
      'ogg': 'OGG_OPUS',
      'flac': 'FLAC'
    };
    return encodings[format] || 'LINEAR16';
  }

  private async analyzeVoiceCharacteristics(query: VoiceSearchQuery): Promise<any> {
    // Analyze voice patterns for additional context
    // In production, use audio analysis libraries
    
    return {
      sentiment: 'neutral', // Could detect frustration, urgency, etc.
      urgency: 'normal', // normal, urgent, relaxed
      clarity: 0.8, // How clear the speech is
      background_noise: 0.2 // Amount of background noise
    };
  }

  private detectVoiceIntent(transcription: any, voiceAnalysis: any): string {
    const text = transcription.text.toLowerCase();
    
    // Check for question patterns
    if (text.includes('how do i') || text.includes('how to')) {
      return 'learning';
    }
    
    if (text.includes('what is') || text.includes('what are')) {
      return 'discovery';
    }
    
    if (text.includes('fix') || text.includes('error') || text.includes('broken')) {
      return 'troubleshooting';
    }
    
    if (text.includes('show me') || text.includes('find')) {
      return 'navigation';
    }
    
    if (voiceAnalysis.urgency === 'urgent') {
      return 'incident_response';
    }
    
    return 'general';
  }

  private async enhanceVoiceQuery(
    text: string,
    voiceAnalysis: any,
    intent: string
  ): Promise<string> {
    // Use GPT to enhance and clarify voice query
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Convert spoken queries into effective search queries for a developer portal. Be concise.'
        },
        {
          role: 'user',
          content: `Spoken query: "${text}"
Intent: ${intent}
Convert this to an effective search query.`
        }
      ],
      temperature: 0.3,
      max_tokens: 50
    });

    return completion.choices[0].message.content || text;
  }

  private buildVoiceSearchFilters(
    intent: string,
    voiceAnalysis: any
  ): Record<string, any> {
    const filters: Record<string, any> = {};

    switch (intent) {
      case 'troubleshooting':
        filters.type = ['documentation', 'incident', 'runbook'];
        break;
      case 'learning':
        filters.type = ['documentation', 'tutorial', 'guide'];
        break;
      case 'incident_response':
        filters.type = ['incident', 'alert', 'runbook'];
        filters.priority = 'high';
        break;
    }

    if (voiceAnalysis.urgency === 'urgent') {
      filters.lastModified = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
    }

    return filters;
  }

  private async optimizeForVoiceResponse(results: any[]): Promise<any[]> {
    // Optimize results for voice reading
    return results.slice(0, 5).map(result => ({
      ...result,
      voiceSummary: this.generateVoiceSummary(result),
      speakableTitle: this.makeTextSpeakable(result.metadata.title)
    }));
  }

  private generateVoiceSummary(result: any): string {
    // Create a brief, speakable summary
    const type = result.metadata.type;
    const title = result.metadata.title;
    const description = result.metadata.description?.substring(0, 50);
    
    return `${type}: ${title}. ${description || 'No description available.'}`;
  }

  private makeTextSpeakable(text: string): string {
    // Convert technical text to more speakable format
    return text
      .replace(/API/g, 'A P I')
      .replace(/URL/g, 'U R L')
      .replace(/JSON/g, 'Jason')
      .replace(/SQL/g, 'sequel')
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  private async extractEntitiesFromText(text: string): Promise<string[]> {
    // Use GPT for entity extraction
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Extract technical entities from the text. Return only entity names, one per line.'
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.2,
      max_tokens: 100
    });

    return completion.choices[0].message.content
      ?.split('\n')
      .filter(e => e.trim())
      .map(e => e.trim()) || [];
  }

  private async logVisualSearch(
    query: VisualSearchQuery,
    searchQuery: string,
    results: any[]
  ) {
    const log = {
      timestamp: new Date(),
      type: 'visual',
      searchType: query.searchType,
      generatedQuery: searchQuery,
      resultCount: results.length,
      topResults: results.slice(0, 3).map(r => r.metadata.title)
    };

    await this.redis.lpush('search:visual:logs', JSON.stringify(log));
    await this.redis.ltrim('search:visual:logs', 0, 5000);
  }

  private async logVoiceSearch(
    query: VoiceSearchQuery,
    transcription: any,
    results: any[]
  ) {
    const log = {
      timestamp: new Date(),
      type: 'voice',
      transcription: transcription.text,
      confidence: transcription.confidence,
      language: transcription.language,
      resultCount: results.length,
      topResults: results.slice(0, 3).map(r => r.metadata.title)
    };

    await this.redis.lpush('search:voice:logs', JSON.stringify(log));
    await this.redis.ltrim('search:voice:logs', 0, 5000);
  }
}