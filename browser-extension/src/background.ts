// Background script for Backstage browser extension

import { createBackstageClient } from '@backstage-idp/sdk-typescript';
import browser from 'webextension-polyfill';

interface ExtensionConfig {
  baseURL: string;
  apiKey?: string;
  bearerToken?: string;
  enabled: boolean;
  notifications: boolean;
  contextMenu: boolean;
  quickActions: boolean;
}

class BackgroundService {
  private client: any = null;
  private config: ExtensionConfig | null = null;
  private notificationCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    // Load configuration
    await this.loadConfig();
    
    // Setup client if configured
    if (this.config?.enabled && (this.config?.apiKey || this.config?.bearerToken)) {
      await this.setupClient();
    }
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Setup context menus
    await this.setupContextMenus();
    
    // Start notification checking
    this.startNotificationCheck();
  }

  private async loadConfig(): Promise<void> {
    const result = await browser.storage.sync.get({
      baseURL: 'http://localhost:4400/api',
      apiKey: '',
      bearerToken: '',
      enabled: false,
      notifications: true,
      contextMenu: true,
      quickActions: true
    });
    
    this.config = result as ExtensionConfig;
  }

  private async setupClient(): Promise<void> {
    if (!this.config) return;
    
    try {
      this.client = createBackstageClient({
        baseURL: this.config.baseURL,
        apiKey: this.config.apiKey,
        bearerToken: this.config.bearerToken,
        timeout: 10000
      });
      
      // Test connection
      await this.client.system.getHealth();
      console.log('Backstage client connected successfully');
      
      // Update badge to show connected status
      await browser.action.setBadgeText({ text: '✓' });
      await browser.action.setBadgeBackgroundColor({ color: '#4CAF50' });
      
    } catch (error) {
      console.error('Failed to connect to Backstage:', error);
      await browser.action.setBadgeText({ text: '✗' });
      await browser.action.setBadgeBackgroundColor({ color: '#F44336' });
    }
  }

  private setupEventListeners(): void {
    // Handle configuration changes
    browser.storage.onChanged.addListener(async (changes, namespace) => {
      if (namespace === 'sync') {
        await this.loadConfig();
        if (this.config?.enabled && (this.config?.apiKey || this.config?.bearerToken)) {
          await this.setupClient();
        } else {
          this.client = null;
          await browser.action.setBadgeText({ text: '' });
        }
        await this.setupContextMenus();
      }
    });

    // Handle browser action clicks
    browser.action.onClicked.addListener(async (tab) => {
      if (this.config?.enabled && this.client) {
        // Open portal in new tab
        await browser.tabs.create({
          url: this.config.baseURL.replace('/api', '')
        });
      }
    });

    // Handle context menu clicks
    browser.contextMenus.onClicked.addListener(async (info, tab) => {
      await this.handleContextMenuClick(info, tab);
    });

    // Handle messages from content scripts and popup
    browser.runtime.onMessage.addListener(async (message, sender) => {
      return await this.handleMessage(message, sender);
    });

    // Handle extension install/update
    browser.runtime.onInstalled.addListener(async (details) => {
      if (details.reason === 'install') {
        // Open options page on first install
        await browser.runtime.openOptionsPage();
      }
    });
  }

  private async setupContextMenus(): Promise<void> {
    // Remove existing context menus
    await browser.contextMenus.removeAll();
    
    if (!this.config?.contextMenu || !this.config?.enabled || !this.client) {
      return;
    }

    // Create context menus
    browser.contextMenus.create({
      id: 'search-portal',
      title: 'Search in Backstage Portal',
      contexts: ['selection']
    });

    browser.contextMenus.create({
      id: 'separator-1',
      type: 'separator',
      contexts: ['selection']
    });

    browser.contextMenus.create({
      id: 'create-component',
      title: 'Register as Component',
      contexts: ['page']
    });

    browser.contextMenus.create({
      id: 'view-docs',
      title: 'View in TechDocs',
      contexts: ['page']
    });

    if (this.config.quickActions) {
      browser.contextMenus.create({
        id: 'separator-2',
        type: 'separator',
        contexts: ['page']
      });

      browser.contextMenus.create({
        id: 'quick-actions',
        title: 'Quick Actions',
        contexts: ['page']
      });

      browser.contextMenus.create({
        id: 'health-check',
        title: 'Check System Health',
        parentId: 'quick-actions',
        contexts: ['page']
      });

      browser.contextMenus.create({
        id: 'list-plugins',
        title: 'List Plugins',
        parentId: 'quick-actions',
        contexts: ['page']
      });
    }
  }

  private async handleContextMenuClick(info: browser.Menus.OnClickData, tab?: browser.Tabs.Tab): Promise<void> {
    if (!this.client || !tab) return;

    try {
      switch (info.menuItemId) {
        case 'search-portal':
          if (info.selectionText) {
            const results = await this.client.search(info.selectionText);
            await this.showSearchResults(results, tab);
          }
          break;

        case 'create-component':
          await this.createComponentFromPage(tab);
          break;

        case 'view-docs':
          await this.viewPageInTechDocs(tab);
          break;

        case 'health-check':
          const health = await this.client.system.getHealth();
          await this.showNotification('System Health', `Status: ${health.status}`, 'info');
          break;

        case 'list-plugins':
          const plugins = await this.client.plugins.list({ limit: 5 });
          const pluginNames = plugins.items.map((p: any) => p.name).join(', ');
          await this.showNotification('Recent Plugins', pluginNames, 'info');
          break;
      }
    } catch (error) {
      console.error('Context menu action failed:', error);
      await this.showNotification('Action Failed', 'Could not complete the requested action', 'error');
    }
  }

  private async handleMessage(message: any, sender: browser.Runtime.MessageSender): Promise<any> {
    if (!this.client) {
      return { error: 'Not connected to Backstage portal' };
    }

    try {
      switch (message.type) {
        case 'GET_HEALTH':
          return await this.client.system.getHealth();

        case 'SEARCH':
          return await this.client.search(message.query, message.options);

        case 'GET_PLUGINS':
          return await this.client.plugins.list(message.params);

        case 'GET_WORKFLOWS':
          return await this.client.workflows.list(message.params);

        case 'GET_NOTIFICATIONS':
          return await this.client.notifications.list(message.unreadOnly, message.limit);

        case 'MARK_NOTIFICATION_READ':
          await this.client.notifications.markAsRead(message.notificationId);
          return { success: true };

        case 'GET_CONFIG':
          return this.config;

        case 'TEST_CONNECTION':
          await this.client.system.getHealth();
          return { connected: true };

        default:
          return { error: 'Unknown message type' };
      }
    } catch (error) {
      console.error('Message handling failed:', error);
      return { error: error.message };
    }
  }

  private async showSearchResults(results: any, tab: browser.Tabs.Tab): Promise<void> {
    // Send results to content script to display
    if (tab.id) {
      await browser.tabs.sendMessage(tab.id, {
        type: 'SHOW_SEARCH_RESULTS',
        results: results.results
      });
    }
  }

  private async createComponentFromPage(tab: browser.Tabs.Tab): Promise<void> {
    if (!tab.url || !tab.title) return;

    // Open portal with pre-filled component registration form
    const portalUrl = this.config!.baseURL.replace('/api', '');
    const registerUrl = `${portalUrl}/catalog-import?url=${encodeURIComponent(tab.url)}&name=${encodeURIComponent(tab.title)}`;
    
    await browser.tabs.create({ url: registerUrl });
  }

  private async viewPageInTechDocs(tab: browser.Tabs.Tab): Promise<void> {
    if (!tab.url) return;

    // Try to find documentation for the current page
    const domain = new URL(tab.url).hostname;
    const searchQuery = `domain:${domain} type:documentation`;
    
    try {
      const results = await this.client.search(searchQuery, 'documentation');
      
      if (results.results.length > 0) {
        const docUrl = results.results[0].url;
        if (docUrl) {
          await browser.tabs.create({ url: docUrl });
          return;
        }
      }
      
      // Fallback: open TechDocs search
      const portalUrl = this.config!.baseURL.replace('/api', '');
      const docsUrl = `${portalUrl}/docs?search=${encodeURIComponent(domain)}`;
      await browser.tabs.create({ url: docsUrl });
      
    } catch (error) {
      console.error('Failed to find documentation:', error);
      await this.showNotification('No Documentation', 'Could not find documentation for this page', 'warning');
    }
  }

  private startNotificationCheck(): void {
    if (!this.config?.notifications || this.notificationCheckInterval) {
      return;
    }

    // Check for notifications every 5 minutes
    this.notificationCheckInterval = setInterval(async () => {
      await this.checkNotifications();
    }, 5 * 60 * 1000);

    // Initial check
    setTimeout(() => this.checkNotifications(), 5000);
  }

  private async checkNotifications(): Promise<void> {
    if (!this.client || !this.config?.notifications) return;

    try {
      const notifications = await this.client.notifications.list(true, 10);
      
      if (notifications.notifications.length > 0) {
        // Update badge with notification count
        await browser.action.setBadgeText({ 
          text: notifications.unreadCount > 9 ? '9+' : notifications.unreadCount.toString() 
        });
        await browser.action.setBadgeBackgroundColor({ color: '#FF9800' });

        // Show browser notification for new notifications
        const latestNotification = notifications.notifications[0];
        await this.showNotification(
          latestNotification.title,
          latestNotification.message,
          latestNotification.type
        );
      } else if (this.client) {
        // Clear badge if no notifications
        await browser.action.setBadgeText({ text: '✓' });
        await browser.action.setBadgeBackgroundColor({ color: '#4CAF50' });
      }
    } catch (error) {
      console.error('Failed to check notifications:', error);
    }
  }

  private async showNotification(title: string, message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info'): Promise<void> {
    const iconMap = {
      info: 'icons/icon-48.png',
      warning: 'icons/icon-48.png',
      error: 'icons/icon-48.png',
      success: 'icons/icon-48.png'
    };

    await browser.notifications.create({
      type: 'basic',
      iconUrl: iconMap[type],
      title: title,
      message: message
    });
  }
}

// Initialize background service
new BackgroundService();