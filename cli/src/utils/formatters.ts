import chalk from 'chalk';

export function formatTable(data: any[]): string {
  if (!data || data.length === 0) {
    return chalk.gray('No data available');
  }
  
  const keys = Object.keys(data[0]);
  const maxLengths = keys.map(key => {
    return Math.max(
      key.length,
      ...data.map(row => String(row[key] || '').length)
    );
  });
  
  // Header
  const header = keys.map((key, i) => 
    chalk.bold(key.padEnd(maxLengths[i]))
  ).join(' | ');
  
  const separator = keys.map((_, i) => 
    '-'.repeat(maxLengths[i])
  ).join('-+-');
  
  // Rows
  const rows = data.map(row => {
    return keys.map((key, i) => {
      const value = row[key] === null || row[key] === undefined ? '-' : String(row[key]);
      return value.padEnd(maxLengths[i]);
    }).join(' | ');
  });
  
  return [header, separator, ...rows].join('\n');
}

export function formatJson(data: any): string {
  return JSON.stringify(data, null, 2);
}

export function formatYaml(data: any): string {
  const yaml = require('js-yaml');
  return yaml.dump(data, { indent: 2 });
}

export function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - d.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else {
    return formatDate(d);
  }
}

export function formatStatus(status: string): string {
  switch (status.toLowerCase()) {
    case 'ok':
    case 'healthy':
    case 'active':
    case 'running':
    case 'completed':
    case 'installed':
    case 'success':
      return chalk.green(status);
    
    case 'warning':
    case 'degraded':
    case 'pending':
    case 'installing':
    case 'updating':
      return chalk.yellow(status);
    
    case 'error':
    case 'failed':
    case 'unhealthy':
    case 'stopped':
    case 'deprecated':
      return chalk.red(status);
    
    default:
      return chalk.gray(status);
  }
}

export function formatProgress(current: number, total: number): string {
  const percentage = Math.round((current / total) * 100);
  const barLength = 20;
  const filledLength = Math.round((current / total) * barLength);
  const emptyLength = barLength - filledLength;
  
  const bar = chalk.green('='.repeat(filledLength)) + chalk.gray('-'.repeat(emptyLength));
  return `${bar} ${percentage}% (${current}/${total})`;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

export function highlight(text: string, search: string): string {
  if (!search) return text;
  const regex = new RegExp(`(${search})`, 'gi');
  return text.replace(regex, chalk.yellow('$1'));
}
