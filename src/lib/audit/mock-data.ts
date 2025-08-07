export function generateMockAuditLogs(page: number, limit: number) {
 const actions = ['create', 'update', 'delete', 'view', 'login', 'logout', 'deploy', 'rollback'];
 const resources = ['service', 'template', 'user', 'deployment', 'settings', 'pipeline'];
 const users = [
 { id: 'user-1', name: 'Alex Johnson', email: 'alex@example.com' },
 { id: 'user-2', name: 'Sarah Chen', email: 'sarah@example.com' },
 { id: 'user-3', name: 'Mike Davis', email: 'mike@example.com' },
 { id: 'user-4', name: 'Emma Wilson', email: 'emma@example.com' },
 { id: 'user-5', name: 'System', email: 'system@platform.io' }
 ];

 const logs = [];
 const now = new Date();
 
 for (let i = 0; i < limit; i++) {
 const logIndex = (page - 1) * limit + i;
 const hoursAgo = logIndex * 2;
 const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
 const user = users[Math.floor(Math.random() * users.length)];
 const action = actions[Math.floor(Math.random() * actions.length)];
 const resource = resources[Math.floor(Math.random() * resources.length)];
 
 logs.push({
 id: `audit-${logIndex}`,
 userId: user.id,
 userName: user.name,
 action,
 resource,
 resourceId: `${resource}-${Math.floor(Math.random() * 100)}`,
 metadata: {
 userEmail: user.email,
 changes: action === 'update' ? { 
 before: { status: 'active' }, 
 after: { status: 'inactive' } 
 } : undefined,
 reason: action === 'delete' ? 'Cleanup of unused resources' : undefined,
 source: ['UI', 'API', 'CLI'][Math.floor(Math.random() * 3)]
 },
 ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
 userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
 timestamp: timestamp.toISOString(),
 createdAt: timestamp.toISOString()
 });
 }
 
 return logs;
}

export function generateMockAuditStats() {
 const now = new Date();
 const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
 const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
 const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
 const monthStart = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);

 // Generate hourly activity for the last 24 hours
 const activityByHour = [];
 for (let i = 23; i >= 0; i--) {
 const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
 activityByHour.push({
 hour: hour.getHours().toString().padStart(2, '0') + ':00',
 count: Math.floor(Math.random() * 50) + 10
 });
 }

 // Generate daily activity for the last 7 days
 const activityByDay = [];
 const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
 for (let i = 6; i >= 0; i--) {
 const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
 activityByDay.push({
 day: days[day.getDay()],
 count: Math.floor(Math.random() * 200) + 50
 });
 }

 return {
 todayCount: Math.floor(Math.random() * 100) + 50,
 yesterdayCount: Math.floor(Math.random() * 100) + 40,
 weekCount: Math.floor(Math.random() * 500) + 200,
 monthCount: Math.floor(Math.random() * 2000) + 1000,
 topActions: [
 { action: 'view', count: 342 },
 { action: 'update', count: 256 },
 { action: 'create', count: 189 },
 { action: 'deploy', count: 145 },
 { action: 'delete', count: 89 }
 ],
 topResources: [
 { resource: 'service', count: 412 },
 { resource: 'deployment', count: 298 },
 { resource: 'template', count: 187 },
 { resource: 'user', count: 156 },
 { resource: 'settings', count: 98 }
 ],
 topUsers: [
 { userId: 'user-1', userName: 'Alex Johnson', count: 234 },
 { userId: 'user-2', userName: 'Sarah Chen', count: 189 },
 { userId: 'user-3', userName: 'Mike Davis', count: 167 },
 { userId: 'user-4', userName: 'Emma Wilson', count: 145 },
 { userId: 'user-5', userName: 'System', count: 423 }
 ],
 activityByHour,
 activityByDay
 };
}