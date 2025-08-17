import { PrismaClient } from '@prisma/client';
import { stripe, stripeHelpers } from './stripe-client';
import type { Invoice, InvoiceLineItem, Organization, InvoiceStatus, Payment } from '@prisma/client';
import type Stripe from 'stripe';

const prisma = new PrismaClient();

interface CreateInvoiceRequest {
  organizationId: string;
  description?: string;
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
  }[];
  dueDate?: Date;
  notes?: string;
  autoAdvance?: boolean;
}

interface InvoiceSearchFilters {
  organizationId?: string;
  status?: InvoiceStatus[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  amountRange?: {
    min: number;
    max: number;
  };
  search?: string;
}

interface InvoiceMetrics {
  totalInvoices: number;
  paidInvoices: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  totalRevenue: number;
  outstandingAmount: number;
  averageInvoiceValue: number;
  averagePaymentTime: number;
  collectionRate: number;
}

export class InvoiceService {
  /**
   * Create a new invoice
   */
  async createInvoice(request: CreateInvoiceRequest): Promise<Invoice & { lineItems: InvoiceLineItem[] }> {
    try {
      // Get organization
      const organization = await prisma.organization.findUnique({
        where: { id: request.organizationId }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      // Calculate invoice totals
      const subtotal = request.lineItems.reduce(
        (sum, item) => sum + (item.quantity * item.unitPrice), 
        0
      );
      
      const tax = request.lineItems.reduce(
        (sum, item) => sum + (item.quantity * item.unitPrice * (item.taxRate || 0) / 100),
        0
      );
      
      const total = subtotal + tax;

      // Generate invoice number
      const invoiceCount = await prisma.invoice.count({
        where: { organizationId: request.organizationId }
      });
      const invoiceNumber = `INV-${organization.name.substring(0, 3).toUpperCase()}-${String(invoiceCount + 1).padStart(6, '0')}`;

      // Set due date (default to 30 days from now)
      const dueDate = request.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Create Stripe invoice if customer exists
      let stripeInvoiceId: string | undefined;
      
      if (organization.stripeCustomerId) {
        try {
          const stripeInvoice = await stripe.invoices.create({
            customer: organization.stripeCustomerId,
            description: request.description,
            due_date: Math.floor(dueDate.getTime() / 1000),
            auto_advance: request.autoAdvance,
            collection_method: 'send_invoice',
            metadata: {
              organizationId: organization.id,
              invoiceNumber
            }
          });

          // Add line items to Stripe invoice
          for (const item of request.lineItems) {
            await stripe.invoiceItems.create({
              customer: organization.stripeCustomerId,
              invoice: stripeInvoice.id,
              description: item.description,
              quantity: item.quantity,
              unit_amount: stripeHelpers.formatAmount(item.unitPrice),
              tax_rates: item.taxRate ? [await this.getOrCreateTaxRate(item.taxRate)] : undefined
            });
          }

          stripeInvoiceId = stripeInvoice.id;
        } catch (stripeError) {
          console.warn('Failed to create Stripe invoice:', stripeError);
          // Continue without Stripe integration
        }
      }

      // Create invoice in database
      const invoice = await prisma.invoice.create({
        data: {
          organizationId: request.organizationId,
          invoiceNumber,
          stripeInvoiceId,
          status: 'DRAFT',
          dueDate,
          periodStart: new Date(),
          periodEnd: new Date(),
          subtotal,
          tax,
          total,
          currency: organization.currency,
          notes: request.notes,
          metadata: {
            createdBy: 'system', // Could be enhanced to track user
            autoAdvance: request.autoAdvance
          }
        },
        include: {
          lineItems: true
        }
      });

      // Create line items
      const lineItems = await Promise.all(
        request.lineItems.map(item =>
          prisma.invoiceLineItem.create({
            data: {
              invoiceId: invoice.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.quantity * item.unitPrice,
              taxRate: item.taxRate || 0
            }
          })
        )
      );

      return {
        ...invoice,
        lineItems
      };
    } catch (error) {
      throw new Error(`Failed to create invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Finalize and send an invoice
   */
  async finalizeInvoice(invoiceId: string): Promise<Invoice> {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { organization: true }
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status !== 'DRAFT') {
        throw new Error('Only draft invoices can be finalized');
      }

      // Finalize in Stripe if applicable
      if (invoice.stripeInvoiceId) {
        try {
          await stripe.invoices.finalizeInvoice(invoice.stripeInvoiceId, {
            auto_advance: true
          });
        } catch (stripeError) {
          console.warn('Failed to finalize Stripe invoice:', stripeError);
        }
      }

      // Update invoice status
      const finalizedInvoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'OPEN',
          updatedAt: new Date()
        }
      });

      // TODO: Send invoice email notification
      // await this.sendInvoiceNotification(finalizedInvoice);

      return finalizedInvoice;
    } catch (error) {
      throw new Error(`Failed to finalize invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mark invoice as paid
   */
  async markInvoicePaid(
    invoiceId: string,
    paymentAmount: number,
    paymentMethod: string = 'manual',
    paymentDate?: Date,
    notes?: string
  ): Promise<Invoice> {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId }
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status === 'PAID') {
        throw new Error('Invoice is already paid');
      }

      const paidAt = paymentDate || new Date();

      // Update invoice
      const updatedInvoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'PAID',
          paidAt,
          updatedAt: new Date()
        }
      });

      // Create payment record
      await prisma.payment.create({
        data: {
          organizationId: invoice.organizationId,
          invoiceId: invoice.id,
          amount: paymentAmount,
          currency: invoice.currency,
          status: 'SUCCEEDED',
          method: this.mapPaymentMethod(paymentMethod),
          processedAt: paidAt,
          metadata: {
            notes,
            manualPayment: true
          }
        }
      });

      return updatedInvoice;
    } catch (error) {
      throw new Error(`Failed to mark invoice as paid: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Void an invoice
   */
  async voidInvoice(invoiceId: string, reason?: string): Promise<Invoice> {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId }
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status === 'PAID') {
        throw new Error('Cannot void a paid invoice');
      }

      // Void in Stripe if applicable
      if (invoice.stripeInvoiceId) {
        try {
          await stripe.invoices.voidInvoice(invoice.stripeInvoiceId);
        } catch (stripeError) {
          console.warn('Failed to void Stripe invoice:', stripeError);
        }
      }

      // Update invoice
      const voidedInvoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'VOID',
          voidedAt: new Date(),
          notes: reason ? `${invoice.notes || ''}\n\nVoided: ${reason}` : invoice.notes,
          updatedAt: new Date()
        }
      });

      return voidedInvoice;
    } catch (error) {
      throw new Error(`Failed to void invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search invoices with filters
   */
  async searchInvoices(
    filters: InvoiceSearchFilters,
    page: number = 1,
    pageSize: number = 50
  ): Promise<{
    invoices: (Invoice & { lineItems: InvoiceLineItem[]; organization: { name: string; displayName: string } })[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const where: any = {};

      if (filters.organizationId) {
        where.organizationId = filters.organizationId;
      }

      if (filters.status && filters.status.length > 0) {
        where.status = { in: filters.status };
      }

      if (filters.dateRange) {
        where.createdAt = {
          gte: filters.dateRange.start,
          lte: filters.dateRange.end
        };
      }

      if (filters.amountRange) {
        where.total = {
          gte: filters.amountRange.min,
          lte: filters.amountRange.max
        };
      }

      if (filters.search) {
        where.OR = [
          { invoiceNumber: { contains: filters.search, mode: 'insensitive' } },
          { notes: { contains: filters.search, mode: 'insensitive' } },
          { organization: { name: { contains: filters.search, mode: 'insensitive' } } },
          { organization: { displayName: { contains: filters.search, mode: 'insensitive' } } }
        ];
      }

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          include: {
            lineItems: true,
            organization: {
              select: { name: true, displayName: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.invoice.count({ where })
      ]);

      return {
        invoices,
        pagination: {
          page,
          pageSize,
          total,
          pages: Math.ceil(total / pageSize)
        }
      };
    } catch (error) {
      throw new Error(`Failed to search invoices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get invoice metrics
   */
  async getInvoiceMetrics(
    organizationId?: string,
    period?: { start: Date; end: Date }
  ): Promise<InvoiceMetrics> {
    try {
      const where: any = {};
      
      if (organizationId) {
        where.organizationId = organizationId;
      }
      
      if (period) {
        where.createdAt = {
          gte: period.start,
          lte: period.end
        };
      }

      const [invoices, payments] = await Promise.all([
        prisma.invoice.findMany({ where }),
        prisma.payment.findMany({
          where: {
            invoice: organizationId ? { organizationId } : {},
            ...(period && {
              processedAt: {
                gte: period.start,
                lte: period.end
              }
            })
          },
          include: { invoice: true }
        })
      ]);

      const totalInvoices = invoices.length;
      const paidInvoices = invoices.filter(inv => inv.status === 'PAID').length;
      const unpaidInvoices = invoices.filter(inv => inv.status === 'OPEN').length;
      
      // Calculate overdue invoices
      const now = new Date();
      const overdueInvoices = invoices.filter(inv => 
        inv.status === 'OPEN' && inv.dueDate < now
      ).length;

      const totalRevenue = invoices
        .filter(inv => inv.status === 'PAID')
        .reduce((sum, inv) => sum + parseFloat(inv.total.toString()), 0);
      
      const outstandingAmount = invoices
        .filter(inv => inv.status === 'OPEN')
        .reduce((sum, inv) => sum + parseFloat(inv.total.toString()), 0);

      const averageInvoiceValue = totalInvoices > 0 
        ? invoices.reduce((sum, inv) => sum + parseFloat(inv.total.toString()), 0) / totalInvoices
        : 0;

      // Calculate average payment time
      const paidInvoicesWithTime = invoices.filter(inv => inv.status === 'PAID' && inv.paidAt);
      const averagePaymentTime = paidInvoicesWithTime.length > 0
        ? paidInvoicesWithTime.reduce((sum, inv) => {
            const daysToPay = Math.ceil(
              (inv.paidAt!.getTime() - inv.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            );
            return sum + daysToPay;
          }, 0) / paidInvoicesWithTime.length
        : 0;

      const collectionRate = totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0;

      return {
        totalInvoices,
        paidInvoices,
        unpaidInvoices,
        overdueInvoices,
        totalRevenue,
        outstandingAmount,
        averageInvoiceValue,
        averagePaymentTime,
        collectionRate
      };
    } catch (error) {
      throw new Error(`Failed to get invoice metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate invoice PDF
   */
  async generateInvoicePDF(invoiceId: string): Promise<Buffer> {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          lineItems: true,
          organization: true,
          payments: true
        }
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // If we have a Stripe invoice, get the PDF from there
      if (invoice.stripeInvoiceId) {
        try {
          const stripeInvoice = await stripe.invoices.retrieve(invoice.stripeInvoiceId);
          if (stripeInvoice.invoice_pdf) {
            const response = await fetch(stripeInvoice.invoice_pdf);
            return Buffer.from(await response.arrayBuffer());
          }
        } catch (stripeError) {
          console.warn('Failed to get Stripe invoice PDF:', stripeError);
        }
      }

      // Generate PDF using a PDF library (placeholder)
      // In a real implementation, you'd use a library like PDFKit, jsPDF, or Puppeteer
      const pdfContent = this.generateInvoiceHTML(invoice);
      
      // For now, return the HTML as bytes (in a real implementation, convert to PDF)
      return Buffer.from(pdfContent, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to generate invoice PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send invoice reminder
   */
  async sendInvoiceReminder(invoiceId: string): Promise<void> {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { organization: true }
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status !== 'OPEN') {
        throw new Error('Can only send reminders for open invoices');
      }

      // Send reminder via Stripe if available
      if (invoice.stripeInvoiceId) {
        try {
          await stripe.invoices.sendInvoice(invoice.stripeInvoiceId);
        } catch (stripeError) {
          console.warn('Failed to send Stripe invoice reminder:', stripeError);
        }
      }

      // TODO: Send email reminder through your notification system
      // await notificationService.sendInvoiceReminder(invoice);

      console.log(`Invoice reminder sent for ${invoice.invoiceNumber}`);
    } catch (error) {
      throw new Error(`Failed to send invoice reminder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get or create tax rate in Stripe
   */
  private async getOrCreateTaxRate(taxRate: number): Promise<string> {
    try {
      // Check if tax rate already exists
      const existingRates = await stripe.taxRates.list({
        limit: 100
      });
      
      const existingRate = existingRates.data.find(
        rate => rate.percentage === taxRate && rate.active
      );
      
      if (existingRate) {
        return existingRate.id;
      }
      
      // Create new tax rate
      const newTaxRate = await stripe.taxRates.create({
        display_name: `Tax ${taxRate}%`,
        description: `${taxRate}% tax rate`,
        jurisdiction: 'US',
        percentage: taxRate,
        inclusive: false
      });
      
      return newTaxRate.id;
    } catch (error) {
      console.warn('Failed to get/create tax rate:', error);
      throw error;
    }
  }

  /**
   * Map payment method string to enum
   */
  private mapPaymentMethod(method: string): 'CARD' | 'BANK_TRANSFER' | 'PAYPAL' | 'WIRE_TRANSFER' | 'CREDIT' | 'OTHER' {
    const methodMap: Record<string, 'CARD' | 'BANK_TRANSFER' | 'PAYPAL' | 'WIRE_TRANSFER' | 'CREDIT' | 'OTHER'> = {
      card: 'CARD',
      credit_card: 'CARD',
      bank_transfer: 'BANK_TRANSFER',
      ach: 'BANK_TRANSFER',
      paypal: 'PAYPAL',
      wire: 'WIRE_TRANSFER',
      wire_transfer: 'WIRE_TRANSFER',
      credit: 'CREDIT',
      manual: 'OTHER'
    };
    
    return methodMap[method.toLowerCase()] || 'OTHER';
  }

  /**
   * Generate HTML for invoice (for PDF generation)
   */
  private generateInvoiceHTML(invoice: Invoice & { 
    lineItems: InvoiceLineItem[]; 
    organization: { name: string; displayName: string; billingEmail: string };
    payments: Payment[];
  }): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoice.invoiceNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .invoice-details { margin-bottom: 20px; }
            .line-items { width: 100%; border-collapse: collapse; }
            .line-items th, .line-items td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .line-items th { background-color: #f2f2f2; }
            .totals { text-align: right; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Invoice</h1>
            <h2>${invoice.invoiceNumber}</h2>
          </div>
          
          <div class="invoice-details">
            <p><strong>Bill To:</strong> ${invoice.organization.displayName}</p>
            <p><strong>Email:</strong> ${invoice.organization.billingEmail}</p>
            <p><strong>Invoice Date:</strong> ${invoice.createdAt.toLocaleDateString()}</p>
            <p><strong>Due Date:</strong> ${invoice.dueDate.toLocaleDateString()}</p>
            <p><strong>Status:</strong> ${invoice.status}</p>
          </div>
          
          <table class="line-items">
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.lineItems.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.quantity}</td>
                  <td>${item.unitPrice}</td>
                  <td>${item.amount}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totals">
            <p><strong>Subtotal:</strong> $${invoice.subtotal}</p>
            <p><strong>Tax:</strong> $${invoice.tax}</p>
            <p><strong>Total:</strong> $${invoice.total}</p>
          </div>
          
          ${invoice.notes ? `<div><strong>Notes:</strong><p>${invoice.notes}</p></div>` : ''}
        </body>
      </html>
    `;
  }
}

export const invoiceService = new InvoiceService();
