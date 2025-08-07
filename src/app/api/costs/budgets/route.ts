import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';

interface Budget {
 id: string;
 name: string;
 serviceId?: string;
 provider?: 'aws' | 'azure' | 'gcp' | 'all';
 amount: number;
 currency: string;
 period: 'monthly' | 'quarterly' | 'yearly';
 alerts: {
 thresholds: number[]; // Percentage thresholds (e.g., [50, 80, 100])
 enabled: boolean;
 notifyEmails: string[];
 };
 currentSpend: number;
 forecastedSpend: number;
 status: 'ok' | 'warning' | 'exceeded';
 createdAt: Date;
 updatedAt: Date;
}

// Mock budget data for development
const mockBudgets: Budget[] = [
 {
 id: 'budget-1',
 name: 'Production Services Budget',
 provider: 'all',
 amount: 10000,
 currency: 'USD',
 period: 'monthly',
 alerts: {
 thresholds: [50, 80, 100],
 enabled: true,
 notifyEmails: ['devops@company.com', 'finance@company.com']
 },
 currentSpend: 7234.56,
 forecastedSpend: 8945.32,
 status: 'warning',
 createdAt: new Date('2024-01-01'),
 updatedAt: new Date('2024-01-15')
 },
 {
 id: 'budget-2',
 name: 'AWS Compute Budget',
 provider: 'aws',
 amount: 5000,
 currency: 'USD',
 period: 'monthly',
 alerts: {
 thresholds: [70, 90, 100],
 enabled: true,
 notifyEmails: ['aws-admin@company.com']
 },
 currentSpend: 3456.78,
 forecastedSpend: 4123.45,
 status: 'ok',
 createdAt: new Date('2024-01-01'),
 updatedAt: new Date('2024-01-10')
 },
 {
 id: 'budget-3',
 name: 'Development Environment',
 provider: 'all',
 amount: 2000,
 currency: 'USD',
 period: 'monthly',
 alerts: {
 thresholds: [80, 95, 100],
 enabled: true,
 notifyEmails: ['dev-team@company.com']
 },
 currentSpend: 2100.45,
 forecastedSpend: 2234.67,
 status: 'exceeded',
 createdAt: new Date('2024-01-01'),
 updatedAt: new Date('2024-01-12')
 }
];

async function GET(request: NextRequest) {
 try {
 const { searchParams } = new URL(request.url);
 const provider = searchParams.get('provider');
 const status = searchParams.get('status');
 const serviceId = searchParams.get('serviceId');

 let budgets = [...mockBudgets];

 // Apply filters
 if (provider && provider !== 'all') {
 budgets = budgets.filter(b => b.provider === provider || b.provider === 'all');
 }

 if (status) {
 budgets = budgets.filter(b => b.status === status);
 }

 if (serviceId) {
 budgets = budgets.filter(b => b.serviceId === serviceId);
 }

 // Calculate budget utilization
 const budgetsWithUtilization = budgets.map(budget => ({
 ...budget,
 utilization: (budget.currentSpend / budget.amount) * 100,
 forecastUtilization: (budget.forecastedSpend / budget.amount) * 100,
 remainingAmount: budget.amount - budget.currentSpend,
 daysRemainingInPeriod: getDaysRemainingInPeriod(budget.period)
 }));

 return NextResponse.json({
 budgets: budgetsWithUtilization,
 summary: {
 total: budgets.length,
 exceeded: budgets.filter(b => b.status === 'exceeded').length,
 warning: budgets.filter(b => b.status === 'warning').length,
 ok: budgets.filter(b => b.status === 'ok').length,
 totalAllocated: budgets.reduce((sum, b) => sum + b.amount, 0),
 totalSpent: budgets.reduce((sum, b) => sum + b.currentSpend, 0)
 }
 });
 } catch (error) {
 console.error('Error fetching budgets:', error);
 return NextResponse.json(
 { error: 'Failed to fetch budgets' },
 { status: 500 }
 );
 }
}

async function POST(request: NextRequest) {
 try {
 const budgetData = await request.json();
 
 // Validate required fields
 const { name, amount, currency, period, alerts } = budgetData;
 if (!name || !amount || !currency || !period) {
 return NextResponse.json(
 { error: 'Missing required fields: name, amount, currency, period' },
 { status: 400 }
 );
 }

 // Create new budget
 const newBudget: Budget = {
 id: `budget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
 name,
 serviceId: budgetData.serviceId,
 provider: budgetData.provider || 'all',
 amount,
 currency,
 period,
 alerts: {
 thresholds: alerts?.thresholds || [80, 90, 100],
 enabled: alerts?.enabled ?? true,
 notifyEmails: alerts?.notifyEmails || []
 },
 currentSpend: 0,
 forecastedSpend: 0,
 status: 'ok',
 createdAt: new Date(),
 updatedAt: new Date()
 };

 // In a real implementation, save to database
 mockBudgets.push(newBudget);

 return NextResponse.json({
 message: 'Budget created successfully',
 budget: newBudget
 });
 } catch (error) {
 console.error('Error creating budget:', error);
 return NextResponse.json(
 { error: 'Failed to create budget' },
 { status: 500 }
 );
 }
}

async function PUT(request: NextRequest) {
 try {
 const { searchParams } = new URL(request.url);
 const budgetId = searchParams.get('id');
 
 if (!budgetId) {
 return NextResponse.json(
 { error: 'Budget ID is required' },
 { status: 400 }
 );
 }

 const budgetData = await request.json();
 const budgetIndex = mockBudgets.findIndex(b => b.id === budgetId);

 if (budgetIndex === -1) {
 return NextResponse.json(
 { error: 'Budget not found' },
 { status: 404 }
 );
 }

 // Update budget
 mockBudgets[budgetIndex] = {
 ...mockBudgets[budgetIndex],
 ...budgetData,
 updatedAt: new Date()
 };

 return NextResponse.json({
 message: 'Budget updated successfully',
 budget: mockBudgets[budgetIndex]
 });
 } catch (error) {
 console.error('Error updating budget:', error);
 return NextResponse.json(
 { error: 'Failed to update budget' },
 { status: 500 }
 );
 }
}

async function DELETE(request: NextRequest) {
 try {
 const { searchParams } = new URL(request.url);
 const budgetId = searchParams.get('id');
 
 if (!budgetId) {
 return NextResponse.json(
 { error: 'Budget ID is required' },
 { status: 400 }
 );
 }

 const budgetIndex = mockBudgets.findIndex(b => b.id === budgetId);

 if (budgetIndex === -1) {
 return NextResponse.json(
 { error: 'Budget not found' },
 { status: 404 }
 );
 }

 // Remove budget
 const deletedBudget = mockBudgets.splice(budgetIndex, 1)[0];

 return NextResponse.json({
 message: 'Budget deleted successfully',
 budget: deletedBudget
 });
 } catch (error) {
 console.error('Error deleting budget:', error);
 return NextResponse.json(
 { error: 'Failed to delete budget' },
 { status: 500 }
 );
 }
}

function getDaysRemainingInPeriod(period: string): number {
 const now = new Date();
 const currentMonth = now.getMonth();
 const currentYear = now.getFullYear();

 switch (period) {
 case 'monthly':
 const nextMonth = new Date(currentYear, currentMonth + 1, 1);
 return Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
 case 'quarterly':
 const quarterEndMonth = Math.floor(currentMonth / 3) * 3 + 3;
 const quarterEnd = new Date(currentYear, quarterEndMonth, 1);
 return Math.ceil((quarterEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
 case 'yearly':
 const yearEnd = new Date(currentYear + 1, 0, 1);
 return Math.ceil((yearEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
 default:
 return 30; // Default to 30 days
 }
}

// Temporarily export without auth for development
export { GET, POST, PUT, DELETE };