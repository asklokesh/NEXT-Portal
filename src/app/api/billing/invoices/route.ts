import { NextRequest, NextResponse } from 'next/server';
import { invoiceService } from '@/lib/billing/invoice-service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get invoices for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const organizationId = request.headers.get('x-organization-id');
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');

    // Build filters
    const filters: any = {
      organizationId
    };

    if (status) {
      filters.status = status.split(',');
    }

    if (search) {
      filters.search = search;
    }

    if (startDate && endDate) {
      filters.dateRange = {
        start: new Date(startDate),
        end: new Date(endDate)
      };
    }

    if (minAmount || maxAmount) {
      filters.amountRange = {
        min: minAmount ? parseFloat(minAmount) : 0,
        max: maxAmount ? parseFloat(maxAmount) : Number.MAX_SAFE_INTEGER
      };
    }

    // Search invoices
    const result = await invoiceService.searchInvoices(filters, page, pageSize);

    // Format invoices for frontend
    const formattedInvoices = result.invoices.map(invoice => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      total: parseFloat(invoice.total.toString()),
      currency: invoice.currency,
      dueDate: invoice.dueDate.toISOString(),
      paidAt: invoice.paidAt?.toISOString(),
      createdAt: invoice.createdAt.toISOString(),
      organizationName: invoice.organization.displayName,
      lineItemsCount: invoice.lineItems.length,
      stripeInvoiceId: invoice.stripeInvoiceId,
      notes: invoice.notes
    }));

    return NextResponse.json({
      invoices: formattedInvoices,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

/**
 * Create a new invoice
 */
export async function POST(request: NextRequest) {
  try {
    const organizationId = request.headers.get('x-organization-id');
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { description, lineItems, dueDate, notes, autoAdvance } = body;

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { error: 'Line items are required' },
        { status: 400 }
      );
    }

    // Validate line items
    for (const item of lineItems) {
      if (!item.description || typeof item.quantity !== 'number' || typeof item.unitPrice !== 'number') {
        return NextResponse.json(
          { error: 'Each line item must have description, quantity, and unitPrice' },
          { status: 400 }
        );
      }
    }

    // Create invoice
    const invoice = await invoiceService.createInvoice({
      organizationId,
      description,
      lineItems: lineItems.map((item: any) => ({
        description: item.description,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        taxRate: item.taxRate ? parseFloat(item.taxRate) : undefined
      })),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      notes,
      autoAdvance
    });

    return NextResponse.json({
      invoice,
      message: 'Invoice created successfully'
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create invoice' },
      { status: 500 }
    );
  }
}
