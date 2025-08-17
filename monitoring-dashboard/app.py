#!/usr/bin/env python3
"""
SaaS IDP Monitoring Dashboard
Comprehensive service monitoring and management interface
Runs on port 4499 for system monitoring and control
"""

import asyncio
import json
import logging
import os
import subprocess
import sys
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

import aiohttp
import psutil
from flask import Flask, render_template_string, jsonify, request, Response
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'monitoring-dashboard-secret'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

class ServiceMonitor:
    """Monitor and manage SaaS IDP services"""
    
    def __init__(self):
        self.services = {
            'main-app': {
                'name': 'SaaS IDP Main Application',
                'port': 4400,
                'process_name': 'next',
                'start_command': 'npm run dev',
                'cwd': '/Users/lokesh/git/saas-idp',
                'health_endpoint': 'http://localhost:4400/api/health',
                'status': 'unknown',
                'pid': None,
                'last_check': None,
                'metrics': {'cpu': 0, 'memory': 0, 'uptime': 0}
            },
            'backstage': {
                'name': 'Backstage Backend',
                'port': 7007,
                'process_name': 'node',
                'start_command': 'cd backstage && npm run dev',
                'cwd': '/Users/lokesh/git/saas-idp',
                'health_endpoint': 'http://localhost:7007/api/health',
                'status': 'unknown',
                'pid': None,
                'last_check': None,
                'metrics': {'cpu': 0, 'memory': 0, 'uptime': 0}
            },
            'websocket': {
                'name': 'Real-time WebSocket Service',
                'port': 4403,
                'process_name': 'node',
                'start_command': 'npm run websocket-server',
                'cwd': '/Users/lokesh/git/saas-idp',
                'health_endpoint': 'http://localhost:4403/health',
                'status': 'unknown',
                'pid': None,
                'last_check': None,
                'metrics': {'cpu': 0, 'memory': 0, 'uptime': 0}
            },
            'database': {
                'name': 'PostgreSQL Database',
                'port': 5432,
                'process_name': 'postgres',
                'start_command': 'brew services start postgresql',
                'health_endpoint': None,  # Custom check
                'status': 'unknown',
                'pid': None,
                'last_check': None,
                'metrics': {'cpu': 0, 'memory': 0, 'uptime': 0}
            },
            'redis': {
                'name': 'Redis Cache',
                'port': 6379,
                'process_name': 'redis-server',
                'start_command': 'brew services start redis',
                'health_endpoint': None,  # Custom check
                'status': 'unknown',
                'pid': None,
                'last_check': None,
                'metrics': {'cpu': 0, 'memory': 0, 'uptime': 0}
            }
        }
        
        self.monitoring_active = True
        self.last_system_metrics = {}
        
    async def check_service_health(self, service_id: str) -> Dict:
        """Check health of a specific service"""
        service = self.services.get(service_id)
        if not service:
            return {'status': 'unknown', 'error': 'Service not found'}
            
        try:
            # Check if process is running
            pid = self.find_process_by_port(service['port'])
            service['pid'] = pid
            
            if not pid:
                service['status'] = 'stopped'
                return service
                
            # Get process metrics
            try:
                process = psutil.Process(pid)
                service['metrics'] = {
                    'cpu': process.cpu_percent(),
                    'memory': process.memory_info().rss / 1024 / 1024,  # MB
                    'uptime': time.time() - process.create_time()
                }
            except psutil.NoSuchProcess:
                service['pid'] = None
                service['status'] = 'stopped'
                return service
            
            # Check health endpoint if available
            if service.get('health_endpoint'):
                try:
                    async with aiohttp.ClientSession() as session:
                        async with session.get(
                            service['health_endpoint'], 
                            timeout=aiohttp.ClientTimeout(total=5)
                        ) as response:
                            if response.status == 200:
                                service['status'] = 'healthy'
                            else:
                                service['status'] = 'unhealthy'
                except Exception as e:
                    service['status'] = 'unhealthy'
                    service['error'] = str(e)
            else:
                # Custom health checks for database services
                if service_id == 'database':
                    service['status'] = await self.check_postgres_health()
                elif service_id == 'redis':
                    service['status'] = await self.check_redis_health()
                else:
                    service['status'] = 'running'
            
            service['last_check'] = datetime.now().isoformat()
            return service
            
        except Exception as e:
            logger.error(f"Error checking service {service_id}: {e}")
            service['status'] = 'error'
            service['error'] = str(e)
            return service
    
    def find_process_by_port(self, port: int) -> Optional[int]:
        """Find process ID by port"""
        try:
            for proc in psutil.process_iter(['pid', 'name']):
                try:
                    for conn in proc.connections():
                        if conn.laddr.port == port:
                            return proc.info['pid']
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
        except Exception:
            pass
        return None
    
    async def check_postgres_health(self) -> str:
        """Check PostgreSQL health"""
        try:
            # Try to connect using psql
            result = subprocess.run(
                ['psql', '-h', 'localhost', '-p', '5432', '-U', 'postgres', '-c', 'SELECT 1'],
                capture_output=True, text=True, timeout=5
            )
            return 'healthy' if result.returncode == 0 else 'unhealthy'
        except Exception:
            return 'unhealthy'
    
    async def check_redis_health(self) -> str:
        """Check Redis health"""
        try:
            # Try to ping Redis
            result = subprocess.run(
                ['redis-cli', 'ping'],
                capture_output=True, text=True, timeout=5
            )
            return 'healthy' if 'PONG' in result.stdout else 'unhealthy'
        except Exception:
            return 'unhealthy'
    
    async def start_service(self, service_id: str) -> Dict:
        """Start a service"""
        service = self.services.get(service_id)
        if not service:
            return {'success': False, 'error': 'Service not found'}
        
        try:
            if service['pid'] and psutil.pid_exists(service['pid']):
                return {'success': False, 'error': 'Service already running'}
            
            # Start the service
            if service_id in ['database', 'redis']:
                # Use brew services for database services
                subprocess.Popen(service['start_command'], shell=True, cwd=service.get('cwd'))
            else:
                # Start Node.js services
                subprocess.Popen(
                    service['start_command'], 
                    shell=True, 
                    cwd=service.get('cwd'),
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            
            # Wait a moment and check status
            await asyncio.sleep(2)
            await self.check_service_health(service_id)
            
            return {
                'success': True, 
                'message': f"Started {service['name']}",
                'status': service['status']
            }
            
        except Exception as e:
            logger.error(f"Error starting service {service_id}: {e}")
            return {'success': False, 'error': str(e)}
    
    async def stop_service(self, service_id: str) -> Dict:
        """Stop a service"""
        service = self.services.get(service_id)
        if not service:
            return {'success': False, 'error': 'Service not found'}
        
        try:
            if not service['pid'] or not psutil.pid_exists(service['pid']):
                return {'success': False, 'error': 'Service not running'}
            
            # Stop the service
            if service_id in ['database', 'redis']:
                # Use brew services for database services
                subprocess.run(
                    f"brew services stop {'postgresql' if service_id == 'database' else 'redis'}", 
                    shell=True
                )
            else:
                # Kill Node.js processes
                process = psutil.Process(service['pid'])
                process.terminate()
                
                # Wait for graceful shutdown
                try:
                    process.wait(timeout=10)
                except psutil.TimeoutExpired:
                    process.kill()
            
            service['pid'] = None
            service['status'] = 'stopped'
            
            return {
                'success': True, 
                'message': f"Stopped {service['name']}",
                'status': 'stopped'
            }
            
        except Exception as e:
            logger.error(f"Error stopping service {service_id}: {e}")
            return {'success': False, 'error': str(e)}
    
    async def restart_service(self, service_id: str) -> Dict:
        """Restart a service"""
        stop_result = await self.stop_service(service_id)
        await asyncio.sleep(3)  # Wait between stop and start
        start_result = await self.start_service(service_id)
        
        return {
            'success': start_result['success'],
            'message': f"Restarted {self.services[service_id]['name']}",
            'stop_result': stop_result,
            'start_result': start_result
        }
    
    def get_system_metrics(self) -> Dict:
        """Get overall system metrics"""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            return {
                'cpu': {
                    'percent': cpu_percent,
                    'cores': psutil.cpu_count(),
                },
                'memory': {
                    'total': memory.total / 1024 / 1024 / 1024,  # GB
                    'used': memory.used / 1024 / 1024 / 1024,
                    'percent': memory.percent,
                },
                'disk': {
                    'total': disk.total / 1024 / 1024 / 1024,  # GB
                    'used': disk.used / 1024 / 1024 / 1024,
                    'percent': (disk.used / disk.total) * 100,
                },
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Error getting system metrics: {e}")
            return {}
    
    async def monitor_services(self):
        """Continuous service monitoring"""
        while self.monitoring_active:
            try:
                # Check all services
                for service_id in self.services:
                    await self.check_service_health(service_id)
                
                # Get system metrics
                self.last_system_metrics = self.get_system_metrics()
                
                # Emit updates via WebSocket
                socketio.emit('service_update', {
                    'services': self.services,
                    'system': self.last_system_metrics,
                    'timestamp': datetime.now().isoformat()
                })
                
                await asyncio.sleep(10)  # Check every 10 seconds
                
            except Exception as e:
                logger.error(f"Error in service monitoring: {e}")
                await asyncio.sleep(10)

# Initialize service monitor
monitor = ServiceMonitor()

# HTML Dashboard Template
DASHBOARD_HTML = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SaaS IDP Monitoring Dashboard</title>
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #1a1a1a; color: #fff; }
        .header { background: #2d2d2d; padding: 20px; border-bottom: 2px solid #4a5568; }
        .header h1 { color: #4fd1c7; margin-bottom: 10px; }
        .header p { color: #a0aec0; }
        .container { display: grid; grid-template-columns: 1fr 300px; gap: 20px; padding: 20px; }
        .main-content { display: flex; flex-direction: column; gap: 20px; }
        .sidebar { display: flex; flex-direction: column; gap: 20px; }
        .card { background: #2d2d2d; border-radius: 10px; padding: 20px; border: 1px solid #4a5568; }
        .card h3 { margin-bottom: 15px; color: #4fd1c7; }
        .service-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; }
        .service-card { background: #3a3a3a; border-radius: 8px; padding: 15px; border-left: 4px solid #4fd1c7; }
        .service-header { display: flex; justify-content: between; align-items: center; margin-bottom: 10px; }
        .service-status { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
        .status-healthy { background: #48bb78; color: white; }
        .status-unhealthy { background: #f56565; color: white; }
        .status-stopped { background: #a0aec0; color: white; }
        .status-unknown { background: #fbd38d; color: black; }
        .service-actions { display: flex; gap: 5px; margin-top: 10px; }
        .btn { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .btn-start { background: #48bb78; color: white; }
        .btn-stop { background: #f56565; color: white; }
        .btn-restart { background: #4299e1; color: white; }
        .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px; }
        .metric { text-align: center; padding: 8px; background: #4a5568; border-radius: 4px; }
        .metric-label { font-size: 11px; color: #a0aec0; }
        .metric-value { font-size: 14px; font-weight: bold; color: #4fd1c7; }
        .system-overview { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .metric-card { background: #3a3a3a; padding: 15px; border-radius: 8px; text-align: center; }
        .metric-card h4 { color: #4fd1c7; margin-bottom: 5px; }
        .metric-card .value { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
        .metric-card .label { font-size: 12px; color: #a0aec0; }
        .logs { background: #1a1a1a; padding: 15px; border-radius: 8px; max-height: 300px; overflow-y: auto; font-family: monospace; font-size: 12px; }
        .log-entry { margin-bottom: 5px; color: #a0aec0; }
        .log-timestamp { color: #4fd1c7; }
        .chart-container { height: 200px; margin-top: 15px; }
        @media (max-width: 768px) {
            .container { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>SaaS IDP Monitoring Dashboard</h1>
        <p>Real-time monitoring and management for all platform services</p>
    </div>
    
    <div class="container">
        <div class="main-content">
            <div class="card">
                <h3>System Overview</h3>
                <div class="system-overview">
                    <div class="metric-card">
                        <h4>CPU Usage</h4>
                        <div class="value" id="cpu-usage">0%</div>
                        <div class="label">System CPU</div>
                    </div>
                    <div class="metric-card">
                        <h4>Memory</h4>
                        <div class="value" id="memory-usage">0%</div>
                        <div class="label">RAM Usage</div>
                    </div>
                    <div class="metric-card">
                        <h4>Disk Space</h4>
                        <div class="value" id="disk-usage">0%</div>
                        <div class="label">Storage Used</div>
                    </div>
                </div>
                <div class="chart-container">
                    <canvas id="systemChart"></canvas>
                </div>
            </div>
            
            <div class="card">
                <h3>Services Status</h3>
                <div class="service-grid" id="services-grid">
                    <!-- Services will be populated here -->
                </div>
            </div>
        </div>
        
        <div class="sidebar">
            <div class="card">
                <h3>Quick Actions</h3>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button class="btn btn-start" onclick="startAllServices()">Start All Services</button>
                    <button class="btn btn-stop" onclick="stopAllServices()">Stop All Services</button>
                    <button class="btn btn-restart" onclick="restartAllServices()">Restart All Services</button>
                </div>
            </div>
            
            <div class="card">
                <h3>Activity Log</h3>
                <div class="logs" id="activity-log">
                    <div class="log-entry">
                        <span class="log-timestamp">[${new Date().toLocaleTimeString()}]</span>
                        Dashboard initialized
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        const socket = io();
        let systemChart;
        
        // Initialize chart
        const ctx = document.getElementById('systemChart').getContext('2d');
        systemChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'CPU %',
                        data: [],
                        borderColor: '#4fd1c7',
                        backgroundColor: 'rgba(79, 209, 199, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Memory %',
                        data: [],
                        borderColor: '#4299e1',
                        backgroundColor: 'rgba(66, 153, 225, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#a0aec0' }
                    }
                },
                scales: {
                    x: { ticks: { color: '#a0aec0' } },
                    y: { ticks: { color: '#a0aec0' }, min: 0, max: 100 }
                }
            }
        });
        
        // Socket event handlers
        socket.on('service_update', function(data) {
            updateServices(data.services);
            updateSystemMetrics(data.system);
            updateChart(data.system);
        });
        
        function updateServices(services) {
            const grid = document.getElementById('services-grid');
            grid.innerHTML = '';
            
            Object.entries(services).forEach(([id, service]) => {
                const serviceCard = createServiceCard(id, service);
                grid.appendChild(serviceCard);
            });
        }
        
        function createServiceCard(id, service) {
            const card = document.createElement('div');
            card.className = 'service-card';
            card.innerHTML = `
                <div class="service-header">
                    <h4>${service.name}</h4>
                    <span class="service-status status-${service.status}">${service.status.toUpperCase()}</span>
                </div>
                <div style="font-size: 12px; color: #a0aec0; margin-bottom: 10px;">
                    Port: ${service.port} | PID: ${service.pid || 'N/A'}
                </div>
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-label">CPU</div>
                        <div class="metric-value">${service.metrics.cpu.toFixed(1)}%</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Memory</div>
                        <div class="metric-value">${service.metrics.memory.toFixed(1)}MB</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Uptime</div>
                        <div class="metric-value">${formatUptime(service.metrics.uptime)}</div>
                    </div>
                </div>
                <div class="service-actions">
                    <button class="btn btn-start" onclick="startService('${id}')">Start</button>
                    <button class="btn btn-stop" onclick="stopService('${id}')">Stop</button>
                    <button class="btn btn-restart" onclick="restartService('${id}')">Restart</button>
                </div>
            `;
            return card;
        }
        
        function updateSystemMetrics(system) {
            if (!system) return;
            
            document.getElementById('cpu-usage').textContent = system.cpu.percent.toFixed(1) + '%';
            document.getElementById('memory-usage').textContent = system.memory.percent.toFixed(1) + '%';
            document.getElementById('disk-usage').textContent = system.disk.percent.toFixed(1) + '%';
        }
        
        function updateChart(system) {
            if (!system) return;
            
            const time = new Date().toLocaleTimeString();
            systemChart.data.labels.push(time);
            systemChart.data.datasets[0].data.push(system.cpu.percent);
            systemChart.data.datasets[1].data.push(system.memory.percent);
            
            // Keep only last 20 data points
            if (systemChart.data.labels.length > 20) {
                systemChart.data.labels.shift();
                systemChart.data.datasets[0].data.shift();
                systemChart.data.datasets[1].data.shift();
            }
            
            systemChart.update('none');
        }
        
        function formatUptime(seconds) {
            if (seconds < 60) return seconds.toFixed(0) + 's';
            if (seconds < 3600) return (seconds / 60).toFixed(0) + 'm';
            return (seconds / 3600).toFixed(1) + 'h';
        }
        
        function logActivity(message) {
            const log = document.getElementById('activity-log');
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            entry.innerHTML = `<span class="log-timestamp">[${new Date().toLocaleTimeString()}]</span> ${message}`;
            log.insertBefore(entry, log.firstChild);
            
            // Keep only last 50 entries
            while (log.children.length > 50) {
                log.removeChild(log.lastChild);
            }
        }
        
        // Service control functions
        async function startService(serviceId) {
            logActivity(`Starting ${serviceId}...`);
            const response = await fetch(`/api/services/${serviceId}/start`, { method: 'POST' });
            const result = await response.json();
            logActivity(`${serviceId}: ${result.message || result.error}`);
        }
        
        async function stopService(serviceId) {
            logActivity(`Stopping ${serviceId}...`);
            const response = await fetch(`/api/services/${serviceId}/stop`, { method: 'POST' });
            const result = await response.json();
            logActivity(`${serviceId}: ${result.message || result.error}`);
        }
        
        async function restartService(serviceId) {
            logActivity(`Restarting ${serviceId}...`);
            const response = await fetch(`/api/services/${serviceId}/restart`, { method: 'POST' });
            const result = await response.json();
            logActivity(`${serviceId}: ${result.message || result.error}`);
        }
        
        async function startAllServices() {
            logActivity('Starting all services...');
            const response = await fetch('/api/services/all/start', { method: 'POST' });
            const result = await response.json();
            logActivity('All services start initiated');
        }
        
        async function stopAllServices() {
            logActivity('Stopping all services...');
            const response = await fetch('/api/services/all/stop', { method: 'POST' });
            const result = await response.json();
            logActivity('All services stop initiated');
        }
        
        async function restartAllServices() {
            logActivity('Restarting all services...');
            const response = await fetch('/api/services/all/restart', { method: 'POST' });
            const result = await response.json();
            logActivity('All services restart initiated');
        }
        
        // Initialize dashboard
        socket.emit('get_status');
    </script>
</body>
</html>
'''

# Routes
@app.route('/')
def dashboard():
    """Main dashboard page"""
    return render_template_string(DASHBOARD_HTML)

@app.route('/api/services')
def get_services():
    """Get all services status"""
    return jsonify({
        'services': monitor.services,
        'system': monitor.last_system_metrics,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/services/<service_id>')
def get_service(service_id):
    """Get specific service status"""
    service = monitor.services.get(service_id)
    if not service:
        return jsonify({'error': 'Service not found'}), 404
    return jsonify(service)

@app.route('/api/services/<service_id>/start', methods=['POST'])
def start_service(service_id):
    """Start a service"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    result = loop.run_until_complete(monitor.start_service(service_id))
    loop.close()
    return jsonify(result)

@app.route('/api/services/<service_id>/stop', methods=['POST'])
def stop_service(service_id):
    """Stop a service"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    result = loop.run_until_complete(monitor.stop_service(service_id))
    loop.close()
    return jsonify(result)

@app.route('/api/services/<service_id>/restart', methods=['POST'])
def restart_service(service_id):
    """Restart a service"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    result = loop.run_until_complete(monitor.restart_service(service_id))
    loop.close()
    return jsonify(result)

@app.route('/api/services/all/<action>', methods=['POST'])
def bulk_service_action(action):
    """Perform bulk action on all services"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    results = {}
    for service_id in monitor.services:
        if action == 'start':
            results[service_id] = loop.run_until_complete(monitor.start_service(service_id))
        elif action == 'stop':
            results[service_id] = loop.run_until_complete(monitor.stop_service(service_id))
        elif action == 'restart':
            results[service_id] = loop.run_until_complete(monitor.restart_service(service_id))
    
    loop.close()
    return jsonify({'results': results})

@app.route('/api/system')
def get_system_metrics():
    """Get system metrics"""
    return jsonify(monitor.get_system_metrics())

@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection"""
    logger.info('Client connected to monitoring dashboard')
    emit('connected', {'status': 'Connected to monitoring dashboard'})

@socketio.on('get_status')
def handle_get_status():
    """Handle status request"""
    emit('service_update', {
        'services': monitor.services,
        'system': monitor.last_system_metrics,
        'timestamp': datetime.now().isoformat()
    })

def run_monitoring_loop():
    """Run the monitoring loop in a separate thread"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(monitor.monitor_services())

if __name__ == '__main__':
    logger.info("Starting SaaS IDP Monitoring Dashboard on port 4499")
    
    # Start monitoring in background thread
    monitoring_thread = threading.Thread(target=run_monitoring_loop, daemon=True)
    monitoring_thread.start()
    
    # Start Flask app with SocketIO
    socketio.run(app, host='0.0.0.0', port=4499, debug=False)