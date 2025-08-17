import { PrismaClient } from '@prisma/client';
import { config } from '../env-validation';

const prisma = new PrismaClient();

// Types for CRM integrations
interface CRMContact {
  id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  customFields?: Record<string, any>;
}

interface CRMDeal {
  id?: string;
  name: string;
  amount?: number;
  stage: string;
  contactId: string;
  closeDate?: Date;
  customFields?: Record<string, any>;
}

interface CRMActivity {
  type: 'email' | 'call' | 'meeting' | 'note';
  subject: string;
  content?: string;
  contactId: string;
  timestamp: Date;
}

// Abstract CRM provider interface
abstract class CRMProvider {
  abstract createContact(contact: CRMContact): Promise<string>;
  abstract updateContact(id: string, contact: Partial<CRMContact>): Promise<void>;
  abstract getContact(id: string): Promise<CRMContact | null>;
  abstract createDeal(deal: CRMDeal): Promise<string>;
  abstract updateDeal(id: string, deal: Partial<CRMDeal>): Promise<void>;
  abstract logActivity(activity: CRMActivity): Promise<void>;
}

// HubSpot integration
class HubSpotProvider extends CRMProvider {
  private apiKey: string;
  private baseUrl = 'https://api.hubapi.com';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createContact(contact: CRMContact): Promise<string> {
    const response = await fetch(`${this.baseUrl}/crm/v3/objects/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          email: contact.email,
          firstname: contact.firstName,
          lastname: contact.lastName,
          company: contact.company,
          phone: contact.phone,
          ...contact.customFields
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  async updateContact(id: string, contact: Partial<CRMContact>): Promise<void> {
    const properties: Record<string, any> = {};
    
    if (contact.email) properties.email = contact.email;
    if (contact.firstName) properties.firstname = contact.firstName;
    if (contact.lastName) properties.lastname = contact.lastName;
    if (contact.company) properties.company = contact.company;
    if (contact.phone) properties.phone = contact.phone;
    if (contact.customFields) Object.assign(properties, contact.customFields);

    const response = await fetch(`${this.baseUrl}/crm/v3/objects/contacts/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties })
    });

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.statusText}`);
    }
  }

  async getContact(id: string): Promise<CRMContact | null> {
    const response = await fetch(`${this.baseUrl}/crm/v3/objects/contacts/${id}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      email: data.properties.email,
      firstName: data.properties.firstname,
      lastName: data.properties.lastname,
      company: data.properties.company,
      phone: data.properties.phone
    };
  }

  async createDeal(deal: CRMDeal): Promise<string> {
    const response = await fetch(`${this.baseUrl}/crm/v3/objects/deals`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          dealname: deal.name,
          amount: deal.amount,
          dealstage: deal.stage,
          closedate: deal.closeDate?.toISOString(),
          ...deal.customFields
        },
        associations: [
          {
            to: {
              id: deal.contactId
            },
            types: [
              {
                associationCategory: 'HUBSPOT_DEFINED',
                associationTypeId: 3 // Deal to Contact
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  async updateDeal(id: string, deal: Partial<CRMDeal>): Promise<void> {
    const properties: Record<string, any> = {};
    
    if (deal.name) properties.dealname = deal.name;
    if (deal.amount !== undefined) properties.amount = deal.amount;
    if (deal.stage) properties.dealstage = deal.stage;
    if (deal.closeDate) properties.closedate = deal.closeDate.toISOString();
    if (deal.customFields) Object.assign(properties, deal.customFields);

    const response = await fetch(`${this.baseUrl}/crm/v3/objects/deals/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties })
    });

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.statusText}`);
    }
  }

  async logActivity(activity: CRMActivity): Promise<void> {
    const engagementType = {
      'email': 'EMAIL',
      'call': 'CALL',
      'meeting': 'MEETING',
      'note': 'NOTE'
    }[activity.type];

    const response = await fetch(`${this.baseUrl}/engagements/v1/engagements`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        engagement: {
          active: true,
          type: engagementType,
          timestamp: activity.timestamp.getTime()
        },
        associations: {
          contactIds: [parseInt(activity.contactId)]
        },
        metadata: {
          subject: activity.subject,
          body: activity.content
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.statusText}`);
    }
  }
}

// Salesforce integration
class SalesforceProvider extends CRMProvider {
  private instanceUrl: string;
  private accessToken: string;

  constructor(instanceUrl: string, accessToken: string) {
    this.instanceUrl = instanceUrl;
    this.accessToken = accessToken;
  }

  async createContact(contact: CRMContact): Promise<string> {
    const response = await fetch(`${this.instanceUrl}/services/data/v58.0/sobjects/Contact/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        Email: contact.email,
        FirstName: contact.firstName,
        LastName: contact.lastName || 'Unknown',
        Phone: contact.phone,
        ...contact.customFields
      })
    });

    if (!response.ok) {
      throw new Error(`Salesforce API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  async updateContact(id: string, contact: Partial<CRMContact>): Promise<void> {
    const fields: Record<string, any> = {};
    
    if (contact.email) fields.Email = contact.email;
    if (contact.firstName) fields.FirstName = contact.firstName;
    if (contact.lastName) fields.LastName = contact.lastName;
    if (contact.phone) fields.Phone = contact.phone;
    if (contact.customFields) Object.assign(fields, contact.customFields);

    const response = await fetch(`${this.instanceUrl}/services/data/v58.0/sobjects/Contact/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fields)
    });

    if (!response.ok) {
      throw new Error(`Salesforce API error: ${response.statusText}`);
    }
  }

  async getContact(id: string): Promise<CRMContact | null> {
    const response = await fetch(
      `${this.instanceUrl}/services/data/v58.0/sobjects/Contact/${id}?fields=Id,Email,FirstName,LastName,Phone`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Salesforce API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      id: data.Id,
      email: data.Email,
      firstName: data.FirstName,
      lastName: data.LastName,
      phone: data.Phone
    };
  }

  async createDeal(deal: CRMDeal): Promise<string> {
    const response = await fetch(`${this.instanceUrl}/services/data/v58.0/sobjects/Opportunity/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        Name: deal.name,
        Amount: deal.amount,
        StageName: deal.stage,
        CloseDate: deal.closeDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        ContactId: deal.contactId,
        ...deal.customFields
      })
    });

    if (!response.ok) {
      throw new Error(`Salesforce API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  async updateDeal(id: string, deal: Partial<CRMDeal>): Promise<void> {
    const fields: Record<string, any> = {};
    
    if (deal.name) fields.Name = deal.name;
    if (deal.amount !== undefined) fields.Amount = deal.amount;
    if (deal.stage) fields.StageName = deal.stage;
    if (deal.closeDate) fields.CloseDate = deal.closeDate.toISOString().split('T')[0];
    if (deal.customFields) Object.assign(fields, deal.customFields);

    const response = await fetch(`${this.instanceUrl}/services/data/v58.0/sobjects/Opportunity/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fields)
    });

    if (!response.ok) {
      throw new Error(`Salesforce API error: ${response.statusText}`);
    }
  }

  async logActivity(activity: CRMActivity): Promise<void> {
    const response = await fetch(`${this.instanceUrl}/services/data/v58.0/sobjects/Task/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        Subject: activity.subject,
        Description: activity.content,
        WhoId: activity.contactId,
        ActivityDate: activity.timestamp.toISOString().split('T')[0],
        Status: 'Completed'
      })
    });

    if (!response.ok) {
      throw new Error(`Salesforce API error: ${response.statusText}`);
    }
  }
}

// CRM Integration Service
export class CRMIntegrationService {
  private provider: CRMProvider | null = null;

  constructor() {
    this.initializeProvider();
  }

  private initializeProvider(): void {
    // Check for HubSpot configuration
    if (process.env.HUBSPOT_API_KEY) {
      this.provider = new HubSpotProvider(process.env.HUBSPOT_API_KEY);
      console.log('CRM Integration: HubSpot provider initialized');
      return;
    }

    // Check for Salesforce configuration
    if (process.env.SALESFORCE_INSTANCE_URL && process.env.SALESFORCE_ACCESS_TOKEN) {
      this.provider = new SalesforceProvider(
        process.env.SALESFORCE_INSTANCE_URL,
        process.env.SALESFORCE_ACCESS_TOKEN
      );
      console.log('CRM Integration: Salesforce provider initialized');
      return;
    }

    console.warn('CRM Integration: No provider configured');
  }

  async syncCustomerToCRM(organizationId: string): Promise<void> {
    if (!this.provider) {
      console.warn('No CRM provider configured, skipping sync');
      return;
    }

    try {
      // Get organization data
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          subscriptions: {
            include: { plan: true }
          }
        }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      // Create or update contact in CRM
      const contact: CRMContact = {
        email: organization.billingEmail,
        company: organization.displayName,
        customFields: {
          organization_id: organization.id,
          billing_address: organization.billingAddress,
          country: organization.country,
          currency: organization.currency,
          subscription_status: organization.subscriptions[0]?.status || 'NONE'
        }
      };

      let crmContactId = organization.metadata?.crmContactId as string;
      
      if (crmContactId) {
        // Update existing contact
        await this.provider.updateContact(crmContactId, contact);
      } else {
        // Create new contact
        crmContactId = await this.provider.createContact(contact);
        
        // Store CRM contact ID in organization metadata
        await prisma.organization.update({
          where: { id: organizationId },
          data: {
            metadata: {
              ...organization.metadata as any,
              crmContactId
            }
          }
        });
      }

      // Create deals for active subscriptions
      for (const subscription of organization.subscriptions) {
        if (subscription.status === 'ACTIVE') {
          const dealName = `${organization.displayName} - ${subscription.plan.displayName}`;
          const monthlyValue = parseFloat(subscription.plan.monthlyPrice.toString()) * subscription.quantity;
          
          const deal: CRMDeal = {
            name: dealName,
            amount: monthlyValue * 12, // Annual value
            stage: 'Closed Won',
            contactId: crmContactId,
            customFields: {
              subscription_id: subscription.id,
              plan_tier: subscription.plan.tier,
              monthly_value: monthlyValue,
              quantity: subscription.quantity
            }
          };

          let crmDealId = subscription.metadata?.crmDealId as string;
          
          if (crmDealId) {
            await this.provider.updateDeal(crmDealId, deal);
          } else {
            crmDealId = await this.provider.createDeal(deal);
            
            // Store CRM deal ID in subscription metadata
            await prisma.subscription.update({
              where: { id: subscription.id },
              data: {
                metadata: {
                  ...subscription.metadata as any,
                  crmDealId
                }
              }
            });
          }
        }
      }

      console.log(`Successfully synced organization ${organizationId} to CRM`);
    } catch (error) {
      console.error('Error syncing customer to CRM:', error);
      throw error;
    }
  }

  async logCustomerActivity(
    organizationId: string,
    activity: {
      type: 'email' | 'call' | 'meeting' | 'note';
      subject: string;
      content?: string;
    }
  ): Promise<void> {
    if (!this.provider) {
      console.warn('No CRM provider configured, skipping activity log');
      return;
    }

    try {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      const crmContactId = organization.metadata?.crmContactId as string;
      
      if (!crmContactId) {
        console.warn('Organization not synced to CRM, cannot log activity');
        return;
      }

      await this.provider.logActivity({
        type: activity.type,
        subject: activity.subject,
        content: activity.content,
        contactId: crmContactId,
        timestamp: new Date()
      });

      console.log(`Logged ${activity.type} activity for organization ${organizationId}`);
    } catch (error) {
      console.error('Error logging customer activity to CRM:', error);
    }
  }

  async syncSubscriptionEvent(
    subscriptionId: string,
    event: 'created' | 'updated' | 'cancelled' | 'reactivated'
  ): Promise<void> {
    if (!this.provider) {
      return;
    }

    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          organization: true,
          plan: true
        }
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const crmContactId = subscription.organization.metadata?.crmContactId as string;
      
      if (crmContactId) {
        await this.logCustomerActivity(subscription.organizationId, {
          type: 'note',
          subject: `Subscription ${event}`,
          content: `Subscription ${subscription.plan.displayName} was ${event}. Status: ${subscription.status}, Quantity: ${subscription.quantity}`
        });
      }
    } catch (error) {
      console.error('Error syncing subscription event to CRM:', error);
    }
  }
}

export const crmIntegration = new CRMIntegrationService();
