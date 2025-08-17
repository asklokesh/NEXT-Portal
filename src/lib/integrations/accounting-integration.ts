import { PrismaClient } from '@prisma/client';
import { config } from '../env-validation';

const prisma = new PrismaClient();

// Types for accounting integrations
interface AccountingCustomer {
  id?: string;
  name: string;
  email: string;
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  taxId?: string;
  currency?: string;
}

interface AccountingInvoice {
  id?: string;
  customerId: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
    amount: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
}

interface AccountingPayment {
  id?: string;
  customerId: string;
  invoiceId?: string;
  amount: number;
  currency: string;
  paymentDate: Date;
  paymentMethod: string;
  reference?: string;
}

// Abstract accounting provider interface
abstract class AccountingProvider {
  abstract createCustomer(customer: AccountingCustomer): Promise<string>;
  abstract updateCustomer(id: string, customer: Partial<AccountingCustomer>): Promise<void>;
  abstract getCustomer(id: string): Promise<AccountingCustomer | null>;
  abstract createInvoice(invoice: AccountingInvoice): Promise<string>;
  abstract updateInvoice(id: string, invoice: Partial<AccountingInvoice>): Promise<void>;
  abstract recordPayment(payment: AccountingPayment): Promise<string>;
  abstract getChartOfAccounts(): Promise<any[]>;
}

// QuickBooks Online integration
class QuickBooksProvider extends AccountingProvider {
  private accessToken: string;
  private realmId: string;
  private baseUrl: string;

  constructor(accessToken: string, realmId: string, sandbox: boolean = false) {
    this.accessToken = accessToken;
    this.realmId = realmId;
    this.baseUrl = sandbox 
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';
  }

  async createCustomer(customer: AccountingCustomer): Promise<string> {
    const customerData = {
      Name: customer.name,
      CompanyName: customer.name,
      PrimaryEmailAddr: {
        Address: customer.email
      },
      ...(customer.billingAddress && {
        BillAddr: {
          Line1: customer.billingAddress.street,
          City: customer.billingAddress.city,
          CountrySubDivisionCode: customer.billingAddress.state,
          PostalCode: customer.billingAddress.postalCode,
          Country: customer.billingAddress.country
        }
      }),
      ...(customer.taxId && { ResaleNum: customer.taxId })
    };

    const response = await fetch(
      `${this.baseUrl}/v3/company/${this.realmId}/customer`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(customerData)
      }
    );

    if (!response.ok) {
      throw new Error(`QuickBooks API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.QueryResponse?.Customer?.[0]?.Id || data.Customer?.Id;
  }

  async updateCustomer(id: string, customer: Partial<AccountingCustomer>): Promise<void> {
    // QuickBooks requires the full object for updates, so we need to fetch first
    const existingCustomer = await this.getCustomerById(id);
    
    const updatedData = {
      ...existingCustomer,
      ...(customer.name && { Name: customer.name, CompanyName: customer.name }),
      ...(customer.email && {
        PrimaryEmailAddr: { Address: customer.email }
      }),
      ...(customer.billingAddress && {
        BillAddr: {
          Line1: customer.billingAddress.street,
          City: customer.billingAddress.city,
          CountrySubDivisionCode: customer.billingAddress.state,
          PostalCode: customer.billingAddress.postalCode,
          Country: customer.billingAddress.country
        }
      }),
      ...(customer.taxId && { ResaleNum: customer.taxId })
    };

    const response = await fetch(
      `${this.baseUrl}/v3/company/${this.realmId}/customer`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(updatedData)
      }
    );

    if (!response.ok) {
      throw new Error(`QuickBooks API error: ${response.statusText}`);
    }
  }

  async getCustomer(id: string): Promise<AccountingCustomer | null> {
    const qbCustomer = await this.getCustomerById(id);
    
    if (!qbCustomer) {
      return null;
    }

    return {
      id: qbCustomer.Id,
      name: qbCustomer.Name,
      email: qbCustomer.PrimaryEmailAddr?.Address || '',
      billingAddress: qbCustomer.BillAddr ? {
        street: qbCustomer.BillAddr.Line1,
        city: qbCustomer.BillAddr.City,
        state: qbCustomer.BillAddr.CountrySubDivisionCode,
        postalCode: qbCustomer.BillAddr.PostalCode,
        country: qbCustomer.BillAddr.Country
      } : undefined,
      taxId: qbCustomer.ResaleNum,
      currency: 'USD' // QuickBooks Online primarily uses USD
    };
  }

  private async getCustomerById(id: string): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/v3/company/${this.realmId}/customer/${id}`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`QuickBooks API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.QueryResponse?.Customer?.[0];
  }

  async createInvoice(invoice: AccountingInvoice): Promise<string> {
    const invoiceData = {
      CustomerRef: {
        value: invoice.customerId
      },
      DocNumber: invoice.invoiceNumber,
      TxnDate: invoice.issueDate.toISOString().split('T')[0],
      DueDate: invoice.dueDate.toISOString().split('T')[0],
      Line: invoice.lineItems.map((item, index) => ({
        Id: index + 1,
        LineNum: index + 1,
        Amount: item.amount,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: {
            value: '1', // Default service item - should be configured
            name: 'Services'
          },
          Qty: item.quantity,
          UnitPrice: item.unitPrice,
          ...(item.taxRate && {
            TaxCodeRef: {
              value: 'TAX' // Taxable - should be mapped properly
            }
          })
        },
        Description: item.description
      })),
      TotalAmt: invoice.total,
      CurrencyRef: {
        value: invoice.currency
      }
    };

    const response = await fetch(
      `${this.baseUrl}/v3/company/${this.realmId}/invoice`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(invoiceData)
      }
    );

    if (!response.ok) {
      throw new Error(`QuickBooks API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.QueryResponse?.Invoice?.[0]?.Id || data.Invoice?.Id;
  }

  async updateInvoice(id: string, invoice: Partial<AccountingInvoice>): Promise<void> {
    // Similar to customer update, QuickBooks requires full object
    // Implementation would fetch existing invoice and merge changes
    throw new Error('Invoice update not implemented for QuickBooks');
  }

  async recordPayment(payment: AccountingPayment): Promise<string> {
    const paymentData = {
      CustomerRef: {
        value: payment.customerId
      },
      TotalAmt: payment.amount,
      TxnDate: payment.paymentDate.toISOString().split('T')[0],
      ...(payment.invoiceId && {
        Line: [{
          Amount: payment.amount,
          LinkedTxn: [{
            TxnId: payment.invoiceId,
            TxnType: 'Invoice'
          }]
        }]
      }),
      PaymentMethodRef: {
        value: '1' // Default payment method - should be configured
      },
      DepositToAccountRef: {
        value: '35' // Default checking account - should be configured
      }
    };

    const response = await fetch(
      `${this.baseUrl}/v3/company/${this.realmId}/payment`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(paymentData)
      }
    );

    if (!response.ok) {
      throw new Error(`QuickBooks API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.QueryResponse?.Payment?.[0]?.Id || data.Payment?.Id;
  }

  async getChartOfAccounts(): Promise<any[]> {
    const response = await fetch(
      `${this.baseUrl}/v3/company/${this.realmId}/accounts`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`QuickBooks API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.QueryResponse?.Account || [];
  }
}

// NetSuite integration (stub - would require SuiteTalk REST API)
class NetSuiteProvider extends AccountingProvider {
  private accessToken: string;
  private accountId: string;

  constructor(accessToken: string, accountId: string) {
    this.accessToken = accessToken;
    this.accountId = accountId;
  }

  async createCustomer(customer: AccountingCustomer): Promise<string> {
    // NetSuite implementation would go here
    throw new Error('NetSuite integration not implemented');
  }

  async updateCustomer(id: string, customer: Partial<AccountingCustomer>): Promise<void> {
    throw new Error('NetSuite integration not implemented');
  }

  async getCustomer(id: string): Promise<AccountingCustomer | null> {
    throw new Error('NetSuite integration not implemented');
  }

  async createInvoice(invoice: AccountingInvoice): Promise<string> {
    throw new Error('NetSuite integration not implemented');
  }

  async updateInvoice(id: string, invoice: Partial<AccountingInvoice>): Promise<void> {
    throw new Error('NetSuite integration not implemented');
  }

  async recordPayment(payment: AccountingPayment): Promise<string> {
    throw new Error('NetSuite integration not implemented');
  }

  async getChartOfAccounts(): Promise<any[]> {
    throw new Error('NetSuite integration not implemented');
  }
}

// Accounting Integration Service
export class AccountingIntegrationService {
  private provider: AccountingProvider | null = null;

  constructor() {
    this.initializeProvider();
  }

  private initializeProvider(): void {
    // Check for QuickBooks configuration
    if (process.env.QUICKBOOKS_ACCESS_TOKEN && process.env.QUICKBOOKS_REALM_ID) {
      this.provider = new QuickBooksProvider(
        process.env.QUICKBOOKS_ACCESS_TOKEN,
        process.env.QUICKBOOKS_REALM_ID,
        process.env.QUICKBOOKS_SANDBOX === 'true'
      );
      console.log('Accounting Integration: QuickBooks provider initialized');
      return;
    }

    // Check for NetSuite configuration
    if (process.env.NETSUITE_ACCESS_TOKEN && process.env.NETSUITE_ACCOUNT_ID) {
      this.provider = new NetSuiteProvider(
        process.env.NETSUITE_ACCESS_TOKEN,
        process.env.NETSUITE_ACCOUNT_ID
      );
      console.log('Accounting Integration: NetSuite provider initialized');
      return;
    }

    console.warn('Accounting Integration: No provider configured');
  }

  async syncCustomerToAccounting(organizationId: string): Promise<void> {
    if (!this.provider) {
      console.warn('No accounting provider configured, skipping sync');
      return;
    }

    try {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      const customer: AccountingCustomer = {
        name: organization.displayName,
        email: organization.billingEmail,
        billingAddress: organization.billingAddress as any,
        taxId: organization.taxId || undefined,
        currency: organization.currency
      };

      let accountingCustomerId = organization.metadata?.accountingCustomerId as string;
      
      if (accountingCustomerId) {
        // Update existing customer
        await this.provider.updateCustomer(accountingCustomerId, customer);
      } else {
        // Create new customer
        accountingCustomerId = await this.provider.createCustomer(customer);
        
        // Store accounting customer ID in organization metadata
        await prisma.organization.update({
          where: { id: organizationId },
          data: {
            metadata: {
              ...organization.metadata as any,
              accountingCustomerId
            }
          }
        });
      }

      console.log(`Successfully synced organization ${organizationId} to accounting system`);
    } catch (error) {
      console.error('Error syncing customer to accounting system:', error);
      throw error;
    }
  }

  async syncInvoiceToAccounting(invoiceId: string): Promise<void> {
    if (!this.provider) {
      console.warn('No accounting provider configured, skipping invoice sync');
      return;
    }

    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          organization: true,
          lineItems: true
        }
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Ensure customer is synced first
      let accountingCustomerId = invoice.organization.metadata?.accountingCustomerId as string;
      
      if (!accountingCustomerId) {
        await this.syncCustomerToAccounting(invoice.organizationId);
        
        // Refetch to get updated metadata
        const updatedOrg = await prisma.organization.findUnique({
          where: { id: invoice.organizationId }
        });
        accountingCustomerId = updatedOrg?.metadata?.accountingCustomerId as string;
      }

      if (!accountingCustomerId) {
        throw new Error('Failed to sync customer to accounting system');
      }

      const accountingInvoice: AccountingInvoice = {
        customerId: accountingCustomerId,
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.createdAt,
        dueDate: invoice.dueDate,
        lineItems: invoice.lineItems.map(item => ({
          description: item.description,
          quantity: parseFloat(item.quantity.toString()),
          unitPrice: parseFloat(item.unitPrice.toString()),
          taxRate: parseFloat(item.taxRate.toString()),
          amount: parseFloat(item.amount.toString())
        })),
        subtotal: parseFloat(invoice.subtotal.toString()),
        tax: parseFloat(invoice.tax.toString()),
        total: parseFloat(invoice.total.toString()),
        currency: invoice.currency,
        status: this.mapInvoiceStatus(invoice.status)
      };

      let accountingInvoiceId = invoice.metadata?.accountingInvoiceId as string;
      
      if (accountingInvoiceId) {
        // Update existing invoice
        await this.provider.updateInvoice(accountingInvoiceId, accountingInvoice);
      } else {
        // Create new invoice
        accountingInvoiceId = await this.provider.createInvoice(accountingInvoice);
        
        // Store accounting invoice ID in invoice metadata
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            metadata: {
              ...invoice.metadata as any,
              accountingInvoiceId
            }
          }
        });
      }

      console.log(`Successfully synced invoice ${invoiceId} to accounting system`);
    } catch (error) {
      console.error('Error syncing invoice to accounting system:', error);
      throw error;
    }
  }

  async syncPaymentToAccounting(paymentId: string): Promise<void> {
    if (!this.provider) {
      console.warn('No accounting provider configured, skipping payment sync');
      return;
    }

    try {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          organization: true,
          invoice: true
        }
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      const accountingCustomerId = payment.organization.metadata?.accountingCustomerId as string;
      
      if (!accountingCustomerId) {
        console.warn('Customer not synced to accounting system, cannot record payment');
        return;
      }

      const accountingPayment: AccountingPayment = {
        customerId: accountingCustomerId,
        invoiceId: payment.invoice?.metadata?.accountingInvoiceId as string,
        amount: parseFloat(payment.amount.toString()),
        currency: payment.currency,
        paymentDate: payment.processedAt || payment.createdAt,
        paymentMethod: this.mapPaymentMethod(payment.method),
        reference: payment.stripePaymentId || payment.id
      };

      const accountingPaymentId = await this.provider.recordPayment(accountingPayment);
      
      // Store accounting payment ID in payment metadata
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          metadata: {
            ...payment.metadata as any,
            accountingPaymentId
          }
        }
      });

      console.log(`Successfully synced payment ${paymentId} to accounting system`);
    } catch (error) {
      console.error('Error syncing payment to accounting system:', error);
      throw error;
    }
  }

  private mapInvoiceStatus(status: string): 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' {
    const statusMap: Record<string, 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'> = {
      'DRAFT': 'draft',
      'OPEN': 'sent',
      'PAID': 'paid',
      'VOID': 'cancelled',
      'UNCOLLECTIBLE': 'overdue'
    };
    
    return statusMap[status] || 'draft';
  }

  private mapPaymentMethod(method: string): string {
    const methodMap: Record<string, string> = {
      'CARD': 'Credit Card',
      'BANK_TRANSFER': 'Bank Transfer',
      'PAYPAL': 'PayPal',
      'WIRE_TRANSFER': 'Wire Transfer',
      'CREDIT': 'Credit',
      'OTHER': 'Other'
    };
    
    return methodMap[method] || 'Other';
  }

  async generateFinancialReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalRevenue: number;
    totalInvoices: number;
    totalPayments: number;
    outstandingAmount: number;
    averageInvoiceValue: number;
  }> {
    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      }),
      prisma.payment.findMany({
        where: {
          processedAt: {
            gte: startDate,
            lte: endDate
          },
          status: 'SUCCEEDED'
        }
      })
    ]);

    const totalRevenue = payments.reduce(
      (sum, payment) => sum + parseFloat(payment.amount.toString()),
      0
    );

    const totalInvoices = invoices.length;
    const totalPayments = payments.length;

    const outstandingAmount = invoices
      .filter(invoice => invoice.status === 'OPEN')
      .reduce((sum, invoice) => sum + parseFloat(invoice.total.toString()), 0);

    const averageInvoiceValue = totalInvoices > 0 
      ? invoices.reduce((sum, invoice) => sum + parseFloat(invoice.total.toString()), 0) / totalInvoices
      : 0;

    return {
      totalRevenue,
      totalInvoices,
      totalPayments,
      outstandingAmount,
      averageInvoiceValue
    };
  }
}

export const accountingIntegration = new AccountingIntegrationService();
