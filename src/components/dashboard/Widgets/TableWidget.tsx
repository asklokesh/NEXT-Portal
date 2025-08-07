'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, react-hooks/rules-of-hooks */

import { 
 ChevronUp, 
 ChevronDown, 
 Search,
 Filter,
 Download,
 RefreshCw,
 AlertCircle
} from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { cn } from '@/lib/utils';

import { TableWidgetLoading, EmptyState } from './WidgetLoadingStates';

import type { Widget } from '../types';

interface TableWidgetProps {
 widget: Widget;
 data?: {
 columns?: TableColumn[];
 rows?: Array<Record<string, any>>;
 };
 loading?: boolean;
 error?: Error | null;
 isEditing?: boolean;
}

interface TableColumn {
 key: string;
 label: string;
 sortable?: boolean;
 width?: string;
 align?: 'left' | 'center' | 'right';
 render?: (value: any, row: any) => React.ReactNode;
}

const TableWidget: React.FC<TableWidgetProps> = ({ widget, data, loading, error, isEditing }) => {
 // Mock data if not provided
 const mockData = [
 { id: 1, service: 'user-service', status: 'healthy', uptime: 99.9, requests: 12450, errors: 3 },
 { id: 2, service: 'auth-service', status: 'degraded', uptime: 98.5, requests: 8932, errors: 67 },
 { id: 3, service: 'payment-service', status: 'healthy', uptime: 99.95, requests: 5621, errors: 1 },
 { id: 4, service: 'notification-service', status: 'down', uptime: 85.2, requests: 0, errors: 245 },
 { id: 5, service: 'report-service', status: 'healthy', uptime: 99.8, requests: 3456, errors: 8 }
 ];

 const tableData = data?.rows || mockData;
 const [sortColumn, setSortColumn] = useState<string>('');
 const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
 const [searchTerm, setSearchTerm] = useState('');
 const [pageSize, setPageSize] = useState(10);

 // Default columns if not configured
 const defaultColumns: TableColumn[] = [
 { key: 'service', label: 'Service', sortable: true },
 { 
 key: 'status', 
 label: 'Status', 
 sortable: true,
 render: (value) => (
 <span className={cn(
 'px-2 py-0.5 text-xs font-medium rounded-full',
 value === 'healthy' && 'text-green-600 bg-green-50',
 value === 'degraded' && 'text-yellow-600 bg-yellow-50',
 value === 'down' && 'text-red-600 bg-red-50'
 )}>
 {value}
 </span>
 )
 },
 { 
 key: 'uptime', 
 label: 'Uptime', 
 sortable: true, 
 align: 'right',
 render: (value) => `${value}%`
 },
 { 
 key: 'requests', 
 label: 'Requests', 
 sortable: true, 
 align: 'right',
 render: (value) => value.toLocaleString()
 },
 { 
 key: 'errors', 
 label: 'Errors', 
 sortable: true, 
 align: 'right',
 render: (value) => (
 <span className={cn(
 'font-medium',
 value > 50 ? 'text-red-600' :
 value > 10 ? 'text-yellow-600' : 'text-green-600'
 )}>
 {value}
 </span>
 )
 }
 ];

 const columns = data?.columns || widget.config?.customConfig?.columns || defaultColumns;

 // Handle loading state
 if (loading) {
 return <TableWidgetLoading />;
 }

 // Handle error state
 if (error) {
 return (
 <div className="h-full flex flex-col items-center justify-center p-4 text-center space-y-3">
 <AlertCircle className="w-8 h-8 text-destructive" />
 <div className="space-y-1">
 <h4 className="font-medium text-destructive">Failed to Load Table</h4>
 <p className="text-sm text-muted-foreground">
 {error.message || 'An error occurred while fetching table data'}
 </p>
 </div>
 </div>
 );
 }

 if (tableData.length === 0) {
 return (
 <EmptyState
 title="No Data Available"
 description="There are no items to display in this table."
 icon={<Filter className="w-6 h-6" />}
 />
 );
 }

 // Filtered and sorted data
 const processedData = useMemo(() => {
 let filtered = tableData;

 // Apply search filter
 if (searchTerm) {
 filtered = filtered.filter(row =>
 Object.values(row).some(value =>
 String(value).toLowerCase().includes(searchTerm.toLowerCase())
 )
 );
 }

 // Apply sorting
 if (sortColumn) {
 filtered = [...filtered].sort((a, b) => {
 const aValue = a[sortColumn];
 const bValue = b[sortColumn];
 
 let comparison = 0;
 if (aValue < bValue) comparison = -1;
 if (aValue > bValue) comparison = 1;
 
 return sortDirection === 'desc' ? -comparison : comparison;
 });
 }

 return filtered;
 }, [tableData, searchTerm, sortColumn, sortDirection]);

 const handleSort = (columnKey: string) => {
 const column = columns.find(col => col.key === columnKey);
 if (!column?.sortable) return;

 if (sortColumn === columnKey) {
 setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
 } else {
 setSortColumn(columnKey);
 setSortDirection('asc');
 }
 };

 const getSortIcon = (columnKey: string) => {
 if (sortColumn !== columnKey) return null;
 return sortDirection === 'asc' ? 
 <ChevronUp className="w-3 h-3" /> : 
 <ChevronDown className="w-3 h-3" />;
 };

 return (
 <div className="h-full flex flex-col">
 {/* Table controls */}
 <div className="flex items-center gap-2 mb-4">
 <div className="relative flex-1">
 <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <input
 type="text"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 placeholder="Search..."
 className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-input bg-background"
 />
 </div>
 
 <button className="p-1.5 rounded-md hover:bg-accent hover:text-accent-foreground">
 <Filter className="w-4 h-4" />
 </button>
 
 <button className="p-1.5 rounded-md hover:bg-accent hover:text-accent-foreground">
 <Download className="w-4 h-4" />
 </button>
 </div>

 {/* Table */}
 <div className="flex-1 overflow-auto border rounded-md">
 <table className="w-full text-sm">
 <thead className="bg-muted/50 border-b">
 <tr>
 {columns.map((column) => (
 <th
 key={column.key}
 className={cn(
 'px-3 py-2 font-medium text-left',
 column.align === 'center' && 'text-center',
 column.align === 'right' && 'text-right',
 column.sortable && 'cursor-pointer hover:bg-muted',
 column.width && `w-${column.width}`
 )}
 onClick={() => handleSort(column.key)}
 >
 <div className="flex items-center gap-1">
 <span>{column.label}</span>
 {column.sortable && getSortIcon(column.key)}
 </div>
 </th>
 ))}
 </tr>
 </thead>
 <tbody>
 {processedData.slice(0, pageSize).map((row, index) => (
 <tr key={row.id || index} className="border-b hover:bg-muted/25">
 {columns.map((column) => (
 <td
 key={column.key}
 className={cn(
 'px-3 py-2',
 column.align === 'center' && 'text-center',
 column.align === 'right' && 'text-right'
 )}
 >
 {column.render ? 
 column.render(row[column.key], row) : 
 row[column.key]
 }
 </td>
 ))}
 </tr>
 ))}
 </tbody>
 </table>

 {processedData.length === 0 && (
 <div className="p-8 text-center text-muted-foreground">
 No data found
 </div>
 )}
 </div>

 {/* Pagination info */}
 {processedData.length > pageSize && (
 <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
 <span>
 Showing {Math.min(pageSize, processedData.length)} of {processedData.length} rows
 </span>
 <div className="flex items-center gap-2">
 <span>Rows per page:</span>
 <select
 value={pageSize}
 onChange={(e) => setPageSize(Number(e.target.value))}
 className="text-xs border border-input rounded px-1 py-0.5"
 >
 <option value={5}>5</option>
 <option value={10}>10</option>
 <option value={25}>25</option>
 <option value={50}>50</option>
 </select>
 </div>
 </div>
 )}
 </div>
 );
};

export default TableWidget;