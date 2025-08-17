/**
 * Plugin Operations Tracking API Route
 * Tracks and reports on ongoing plugin operations
 */

import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for operations - in production, use Redis or database
const operations = new Map<string, any>();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const operationId = searchParams.get('operationId');
    const pluginId = searchParams.get('pluginId');
    const status = searchParams.get('status');

    if (operationId) {
      const operation = operations.get(operationId);
      if (!operation) {
        return NextResponse.json(
          { error: 'Operation not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(operation);
    }

    // Filter operations
    let filteredOps = Array.from(operations.values());
    
    if (pluginId) {
      filteredOps = filteredOps.filter(op => op.pluginId === pluginId);
    }
    
    if (status) {
      filteredOps = filteredOps.filter(op => op.status === status);
    }

    // Sort by start time, newest first
    filteredOps.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    return NextResponse.json({
      operations: filteredOps.slice(0, 50) // Return last 50 operations
    });

  } catch (error) {
    console.error('Operations fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch operations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, pluginId, status, progress, message, error } = body;

    const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const operation = {
      id: operationId,
      type,
      pluginId,
      status: status || 'pending',
      progress: progress || 0,
      message: message || 'Operation started',
      error: error || null,
      startedAt: new Date().toISOString(),
      completedAt: status === 'completed' || status === 'failed' ? new Date().toISOString() : null
    };

    operations.set(operationId, operation);

    // Clean up old operations (keep last 100)
    if (operations.size > 100) {
      const oldestKeys = Array.from(operations.keys()).slice(0, operations.size - 100);
      oldestKeys.forEach(key => operations.delete(key));
    }

    return NextResponse.json({
      success: true,
      operationId,
      operation
    });

  } catch (error) {
    console.error('Operation creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create operation' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { operationId, status, progress, message, error } = body;

    if (!operationId) {
      return NextResponse.json(
        { error: 'Operation ID is required' },
        { status: 400 }
      );
    }

    const operation = operations.get(operationId);
    if (!operation) {
      return NextResponse.json(
        { error: 'Operation not found' },
        { status: 404 }
      );
    }

    // Update operation
    if (status !== undefined) operation.status = status;
    if (progress !== undefined) operation.progress = progress;
    if (message !== undefined) operation.message = message;
    if (error !== undefined) operation.error = error;
    
    if (status === 'completed' || status === 'failed') {
      operation.completedAt = new Date().toISOString();
    }

    operations.set(operationId, operation);

    return NextResponse.json({
      success: true,
      operation
    });

  } catch (error) {
    console.error('Operation update error:', error);
    return NextResponse.json(
      { error: 'Failed to update operation' },
      { status: 500 }
    );
  }
}