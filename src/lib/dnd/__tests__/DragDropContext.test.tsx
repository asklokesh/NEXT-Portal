import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DragDropProvider, useDragDrop, DragItem, DropZone } from '../DragDropContext';

// Test component that uses the drag drop context
const TestComponent: React.FC = () => {
  const { state, isDragging, registerDropZone, unregisterDropZone } = useDragDrop();

  React.useEffect(() => {
    const testDropZone: DropZone = {
      id: 'test-zone',
      type: 'folder',
      accepts: ['entity'],
      data: { name: 'Test Zone' },
    };

    registerDropZone(testDropZone);

    return () => {
      unregisterDropZone('test-zone');
    };
  }, [registerDropZone, unregisterDropZone]);

  return (
    <div>
      <div data-testid="is-dragging">{isDragging ? 'dragging' : 'not-dragging'}</div>
      <div data-testid="drop-zones-count">{state.dropZones.length}</div>
      <div data-testid="dragged-item">{state.draggedItem?.id || 'none'}</div>
    </div>
  );
};

describe('DragDropContext', () => {
  it('should provide drag and drop state', () => {
    render(
      <DragDropProvider>
        <TestComponent />
      </DragDropProvider>
    );

    expect(screen.getByTestId('is-dragging')).toHaveTextContent('not-dragging');
    expect(screen.getByTestId('drop-zones-count')).toHaveTextContent('1');
    expect(screen.getByTestId('dragged-item')).toHaveTextContent('none');
  });

  it('should register and unregister drop zones', () => {
    const { unmount } = render(
      <DragDropProvider>
        <TestComponent />
      </DragDropProvider>
    );

    expect(screen.getByTestId('drop-zones-count')).toHaveTextContent('1');

    unmount();
  });

  it('should handle item moved callback', () => {
    const mockOnItemMoved = jest.fn();

    render(
      <DragDropProvider onItemMoved={mockOnItemMoved}>
        <TestComponent />
      </DragDropProvider>
    );

    expect(screen.getByTestId('is-dragging')).toHaveTextContent('not-dragging');
  });

  it('should validate drop targets correctly', () => {
    const TestValidationComponent: React.FC = () => {
      const { isValidDropTarget } = useDragDrop();

      return (
        <div>
          <div data-testid="entity-to-folder">
            {isValidDropTarget('entity', 'folder') ? 'valid' : 'invalid'}
          </div>
          <div data-testid="folder-to-entity">
            {isValidDropTarget('folder', 'entity') ? 'valid' : 'invalid'}
          </div>
        </div>
      );
    };

    render(
      <DragDropProvider>
        <TestValidationComponent />
      </DragDropProvider>
    );

    expect(screen.getByTestId('entity-to-folder')).toHaveTextContent('valid');
    expect(screen.getByTestId('folder-to-entity')).toHaveTextContent('invalid');
  });

  it('should throw error when used outside provider', () => {
    const TestComponentOutsideProvider: React.FC = () => {
      try {
        useDragDrop();
        return <div>No error</div>;
      } catch (error) {
        return <div data-testid="error">Error caught</div>;
      }
    };

    render(<TestComponentOutsideProvider />);
    expect(screen.getByTestId('error')).toBeInTheDocument();
  });
});

// Test utility functions
describe('DragDrop utilities', () => {
  it('should create drag items correctly', () => {
    const { createDragItem } = require('../index');
    
    const dragItem = createDragItem('test-id', 'entity', { name: 'Test Entity' });
    
    expect(dragItem).toEqual({
      id: 'test-id',
      type: 'entity',
      data: { name: 'Test Entity' },
    });
  });

  it('should create drop zones correctly', () => {
    const { createDropZone } = require('../index');
    
    const dropZone = createDropZone('test-zone', 'folder', ['entity'], { name: 'Test Folder' });
    
    expect(dropZone).toEqual({
      id: 'test-zone',
      type: 'folder',
      accepts: ['entity'],
      data: { name: 'Test Folder' },
    });
  });

  it('should validate drag items with type guards', () => {
    const { isDragItem } = require('../index');
    
    const validDragItem = { id: 'test', type: 'entity', data: {} };
    const invalidDragItem = { id: 'test' };
    
    expect(isDragItem(validDragItem)).toBe(true);
    expect(isDragItem(invalidDragItem)).toBe(false);
    expect(isDragItem(null)).toBe(false);
  });

  it('should validate drop zones with type guards', () => {
    const { isDropZone } = require('../index');
    
    const validDropZone = { id: 'test', type: 'folder', accepts: ['entity'], data: {} };
    const invalidDropZone = { id: 'test', type: 'folder' };
    
    expect(isDropZone(validDropZone)).toBe(true);
    expect(isDropZone(invalidDropZone)).toBe(false);
    expect(isDropZone(null)).toBe(false);
  });
});