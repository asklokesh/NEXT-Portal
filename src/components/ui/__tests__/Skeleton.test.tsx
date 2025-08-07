import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
 Skeleton,
 ServiceCardSkeleton,
 ServiceListSkeleton,
 ServiceTableSkeleton,
 ErrorState,
 EmptyState,
} from '../Skeleton';

describe('Skeleton Components', () => {
 describe('Skeleton', () => {
 it('should render basic skeleton', () => {
 render(<Skeleton data-testid="skeleton" />);
 
 const skeleton = screen.getByTestId('skeleton');
 expect(skeleton).toBeInTheDocument();
 expect(skeleton).toHaveClass('animate-pulse', 'bg-gray-200', 'dark:bg-gray-700', 'rounded');
 });

 it('should apply custom className', () => {
 render(<Skeleton className="custom-class" data-testid="skeleton" />);
 
 const skeleton = screen.getByTestId('skeleton');
 expect(skeleton).toHaveClass('custom-class');
 });

 it('should apply custom width and height', () => {
 render(<Skeleton width="200px" height="50px" data-testid="skeleton" />);
 
 const skeleton = screen.getByTestId('skeleton');
 expect(skeleton).toHaveStyle({
 width: '200px',
 height: '50px',
 });
 });

 it('should render as circle when circle prop is true', () => {
 render(<Skeleton circle data-testid="skeleton" />);
 
 const skeleton = screen.getByTestId('skeleton');
 expect(skeleton).toHaveClass('rounded-full');
 expect(skeleton).not.toHaveClass('rounded');
 });

 it('should render multiple lines when lines prop is greater than 1', () => {
 const { container } = render(<Skeleton lines={3} data-testid="skeleton-container" />);
 
 const skeletonLines = container.querySelectorAll('.animate-pulse');
 expect(skeletonLines).toHaveLength(3);
 
 // Last line should be 75% width
 const lastLine = skeletonLines[skeletonLines.length - 1] as HTMLElement;
 expect(lastLine).toHaveStyle({ width: '75%' });
 });

 it('should apply custom width to all lines except last one', () => {
 const { container } = render(<Skeleton lines={3} width="300px" />);
 
 const skeletonLines = container.querySelectorAll('.animate-pulse');
 
 // First two lines should have custom width
 expect(skeletonLines[0] as HTMLElement).toHaveStyle({ width: '300px' });
 expect(skeletonLines[1] as HTMLElement).toHaveStyle({ width: '300px' });
 
 // Last line should be 75% width regardless of custom width
 expect(skeletonLines[2] as HTMLElement).toHaveStyle({ width: '75%' });
 });

 it('should handle numeric width and height', () => {
 render(<Skeleton width={200} height={50} data-testid="skeleton" />);
 
 const skeleton = screen.getByTestId('skeleton');
 expect(skeleton).toHaveStyle({
 width: '200',
 height: '50',
 });
 });
 });

 describe('ServiceCardSkeleton', () => {
 it('should render service card skeleton structure', () => {
 const { container } = render(<ServiceCardSkeleton />);
 
 // Check for main container
 const cardContainer = container.querySelector('.bg-white.dark\\:bg-gray-800');
 expect(cardContainer).toBeInTheDocument();
 
 // Check for skeleton elements (should have multiple)
 const skeletons = container.querySelectorAll('.animate-pulse');
 expect(skeletons.length).toBeGreaterThan(5); // Multiple skeleton elements
 });

 it('should have proper card structure with header, description, tags, and footer', () => {
 const { container } = render(<ServiceCardSkeleton />);
 
 // Check for border and padding classes
 expect(container.firstChild).toHaveClass('rounded-lg', 'border', 'p-6');
 
 // Check for sections with proper spacing
 const sections = container.querySelectorAll('.mb-4');
 expect(sections.length).toBeGreaterThanOrEqual(2);
 });
 });

 describe('ServiceListSkeleton', () => {
 it('should render service list skeleton structure', () => {
 const { container } = render(<ServiceListSkeleton />);
 
 // Check for main container
 const listContainer = container.querySelector('.bg-white.dark\\:bg-gray-800');
 expect(listContainer).toBeInTheDocument();
 
 // Check for flex layout
 const flexContainer = container.querySelector('.flex.items-center.justify-between');
 expect(flexContainer).toBeInTheDocument();
 
 // Check for skeleton elements
 const skeletons = container.querySelectorAll('.animate-pulse');
 expect(skeletons.length).toBeGreaterThan(3);
 });

 it('should have horizontal layout for list items', () => {
 const { container } = render(<ServiceListSkeleton />);
 
 // Check for flex layout with gap
 const itemContainer = container.querySelector('.flex.items-center.gap-4');
 expect(itemContainer).toBeInTheDocument();
 });
 });

 describe('ServiceTableSkeleton', () => {
 it('should render service table skeleton structure', () => {
 const { container } = render(<ServiceTableSkeleton />);
 
 // Check for main table container
 const tableContainer = container.querySelector('.bg-white.dark\\:bg-gray-800.rounded-lg');
 expect(tableContainer).toBeInTheDocument();
 
 // Check for header row
 const headerRow = container.querySelector('.border-b.border-gray-200');
 expect(headerRow).toBeInTheDocument();
 
 // Check for multiple table rows (should be 5 + header)
 const rows = container.querySelectorAll('.border-b');
 expect(rows.length).toBe(6); // 1 header + 5 data rows
 });

 it('should render correct number of skeleton rows', () => {
 const { container } = render(<ServiceTableSkeleton />);
 
 // Count skeleton rows (excluding header)
 const dataRows = container.querySelectorAll('.border-b.border-gray-200.dark\\:border-gray-700.p-4');
 expect(dataRows.length).toBe(5);
 });

 it('should have consistent column structure in all rows', () => {
 const { container } = render(<ServiceTableSkeleton />);
 
 // Get all rows with flex layout
 const allRows = container.querySelectorAll('.flex.items-center.gap-4');
 expect(allRows.length).toBe(6); // Header + 5 data rows
 
 // Each row should have multiple skeleton elements
 allRows.forEach(row => {
 const skeletons = row.querySelectorAll('.animate-pulse');
 expect(skeletons.length).toBeGreaterThanOrEqual(5);
 });
 });
 });

 describe('ErrorState', () => {
 it('should render with default props', () => {
 render(<ErrorState />);
 
 expect(screen.getByText('Something went wrong')).toBeInTheDocument();
 expect(screen.getByText('An error occurred while loading data.')).toBeInTheDocument();
 expect(screen.getByText('Try again')).toBeInTheDocument();
 });

 it('should render with custom title and message', () => {
 render(
 <ErrorState
 title="Custom Error"
 message="This is a custom error message"
 />
 );
 
 expect(screen.getByText('Custom Error')).toBeInTheDocument();
 expect(screen.getByText('This is a custom error message')).toBeInTheDocument();
 });

 it('should call onRetry when retry button is clicked', () => {
 const mockRetry = jest.fn();
 render(<ErrorState onRetry={mockRetry} />);
 
 const retryButton = screen.getByText('Try again');
 fireEvent.click(retryButton);
 
 expect(mockRetry).toHaveBeenCalledTimes(1);
 });

 it('should use custom retry label', () => {
 render(<ErrorState retryLabel="Refresh Data" />);
 
 expect(screen.getByText('Refresh Data')).toBeInTheDocument();
 expect(screen.queryByText('Try again')).not.toBeInTheDocument();
 });

 it('should hide retry button when showRetry is false', () => {
 render(<ErrorState showRetry={false} />);
 
 expect(screen.queryByText('Try again')).not.toBeInTheDocument();
 });

 it('should hide retry button when onRetry is not provided', () => {
 render(<ErrorState onRetry={undefined} />);
 
 expect(screen.queryByText('Try again')).not.toBeInTheDocument();
 });

 it('should render error icon', () => {
 const { container } = render(<ErrorState />);
 
 const svg = container.querySelector('svg');
 expect(svg).toBeInTheDocument();
 expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
 });

 it('should have proper styling classes', () => {
 const { container } = render(<ErrorState />);
 
 const mainContainer = container.firstChild;
 expect(mainContainer).toHaveClass('text-center', 'py-12');
 
 const iconContainer = container.querySelector('.mx-auto.w-24.h-24');
 expect(iconContainer).toBeInTheDocument();
 });
 });

 describe('EmptyState', () => {
 it('should render with default props', () => {
 render(<EmptyState />);
 
 expect(screen.getByText('No data found')).toBeInTheDocument();
 expect(screen.getByText('There are no items to display.')).toBeInTheDocument();
 });

 it('should render with custom title and message', () => {
 render(
 <EmptyState
 title="No Services"
 message="You haven't created any services yet."
 />
 );
 
 expect(screen.getByText('No Services')).toBeInTheDocument();
 expect(screen.getByText("You haven't created any services yet.")).toBeInTheDocument();
 });

 it('should render custom icon when provided', () => {
 const customIcon = <div data-testid="custom-icon">Custom Icon</div>;
 render(<EmptyState icon={customIcon} />);
 
 expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
 expect(screen.getByText('Custom Icon')).toBeInTheDocument();
 });

 it('should render action button when provided', () => {
 const action = <button data-testid="action-button">Create Service</button>;
 render(<EmptyState action={action} />);
 
 expect(screen.getByTestId('action-button')).toBeInTheDocument();
 expect(screen.getByText('Create Service')).toBeInTheDocument();
 });

 it('should not render icon container when icon is not provided', () => {
 const { container } = render(<EmptyState />);
 
 const iconContainer = container.querySelector('.mx-auto.w-24.h-24.mb-4');
 expect(iconContainer).not.toBeInTheDocument();
 });

 it('should have proper layout and styling', () => {
 const { container } = render(<EmptyState />);
 
 const mainContainer = container.firstChild;
 expect(mainContainer).toHaveClass('text-center', 'py-12');
 
 const title = screen.getByText('No data found');
 expect(title).toHaveClass('text-lg', 'font-medium');
 
 const message = screen.getByText('There are no items to display.');
 expect(message).toHaveClass('text-gray-500', 'dark:text-gray-400', 'max-w-md', 'mx-auto');
 });

 it('should render both icon and action when provided', () => {
 const icon = <div data-testid="custom-icon">Icon</div>;
 const action = <button data-testid="action-button">Action</button>;
 
 render(<EmptyState icon={icon} action={action} />);
 
 expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
 expect(screen.getByTestId('action-button')).toBeInTheDocument();
 });
 });

 describe('Accessibility', () => {
 it('should have proper semantic structure for ErrorState', () => {
 render(<ErrorState />);
 
 const heading = screen.getByRole('heading', { level: 3 });
 expect(heading).toHaveTextContent('Something went wrong');
 
 const button = screen.getByRole('button');
 expect(button).toHaveTextContent('Try again');
 });

 it('should have proper semantic structure for EmptyState', () => {
 const action = <button>Create New</button>;
 render(<EmptyState action={action} />);
 
 const heading = screen.getByRole('heading', { level: 3 });
 expect(heading).toHaveTextContent('No data found');
 
 const button = screen.getByRole('button');
 expect(button).toHaveTextContent('Create New');
 });

 it('should have proper button accessibility in ErrorState', () => {
 const mockRetry = jest.fn();
 render(<ErrorState onRetry={mockRetry} />);
 
 const button = screen.getByRole('button');
 expect(button).toHaveClass('focus:outline-none', 'focus:ring-2');
 
 // Test keyboard interaction
 fireEvent.click(button);
 expect(mockRetry).toHaveBeenCalledTimes(1);
 });
 });

 describe('Dark Mode Support', () => {
 it('should have dark mode classes in Skeleton', () => {
 render(<Skeleton data-testid="skeleton" />);
 
 const skeleton = screen.getByTestId('skeleton');
 expect(skeleton).toHaveClass('dark:bg-gray-700');
 });

 it('should have dark mode classes in card skeletons', () => {
 const { container } = render(<ServiceCardSkeleton />);
 
 const cardContainer = container.firstChild;
 expect(cardContainer).toHaveClass('dark:bg-gray-800', 'dark:border-gray-700');
 });

 it('should have dark mode classes in error and empty states', () => {
 render(<ErrorState />);
 
 const title = screen.getByText('Something went wrong');
 expect(title).toHaveClass('dark:text-gray-100');
 
 const message = screen.getByText('An error occurred while loading data.');
 expect(message).toHaveClass('dark:text-gray-400');
 });
 });
});