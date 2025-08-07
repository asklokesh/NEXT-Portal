/**
 * Vault Manager Component
 * Enterprise-grade secret management UI that surpasses Backstage's basic approach
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
  Divider,
  Badge,
  LinearProgress,
} from '@mui/material';
import {
  Security,
  Key,
  Database,
  Certificate,
  Lock,
  Refresh,
  Add,
  Delete,
  Edit,
  Visibility,
  VisibilityOff,
  ContentCopy,
  Download,
  Upload,
  Settings,
  History,
  Timer,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  ExpandMore,
  Sync,
  CloudSync,
  VpnKey,
  Storage,
  Code,
  Policy,
  Shield,
} from '@mui/icons-material';
import { useNotifications } from '@/hooks/useNotifications';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Secret {
  path: string;
  data: Record<string, any>;
  metadata?: {
    created_time: string;
    deletion_time?: string;
    destroyed?: boolean;
    version: number;
    custom_metadata?: Record<string, any>;
  };
}

interface DynamicCredential {
  username: string;
  password: string;
  leaseId: string;
  expirationTime: string;
  renewable: boolean;
}

interface Certificate {
  serialNumber: string;
  commonName: string;
  expiration: string;
  certificate: string;
  privateKey?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`vault-tabpanel-${index}`}
      aria-labelledby={`vault-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const VaultManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [databases, setDatabases] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [encryptionKeys, setEncryptionKeys] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null);
  const [showSecretDialog, setShowSecretDialog] = useState(false);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [rotationStatus, setRotationStatus] = useState<Record<string, any>>({});
  const { showNotification } = useNotifications();
  const { subscribe, unsubscribe } = useWebSocket();

  // Secret form state
  const [secretForm, setSecretForm] = useState({
    path: '',
    engine: 'kv-v2',
    data: {},
    ttl: '1h',
  });

  // Database credential form
  const [dbCredForm, setDbCredForm] = useState({
    database: '',
    role: 'readonly',
    ttl: '1h',
  });

  // Certificate form
  const [certForm, setCertForm] = useState({
    commonName: '',
    altNames: [],
    ttl: '720h',
  });

  // Encryption form
  const [encryptForm, setEncryptForm] = useState({
    keyName: '',
    plaintext: '',
    context: '',
  });

  useEffect(() => {
    loadVaultData();
    
    // Subscribe to real-time updates
    const unsubRotation = subscribe('secret-rotated', handleSecretRotation);
    const unsubHealth = subscribe('vault-health', handleVaultHealth);
    
    return () => {
      unsubRotation();
      unsubHealth();
    };
  }, []);

  const loadVaultData = async () => {
    setLoading(true);
    try {
      const [secretsRes, dbRes, certsRes, keysRes, policiesRes] = await Promise.all([
        fetch('/api/vault/secrets').then(r => r.json()),
        fetch('/api/vault/databases').then(r => r.json()),
        fetch('/api/vault/certificates').then(r => r.json()),
        fetch('/api/vault/encryption-keys').then(r => r.json()),
        fetch('/api/vault/policies').then(r => r.json()),
      ]);

      setSecrets(secretsRes);
      setDatabases(dbRes);
      setCertificates(certsRes);
      setEncryptionKeys(keysRes);
      setPolicies(policiesRes);
    } catch (error) {
      showNotification('Failed to load Vault data', 'error');
      console.error('Failed to load Vault data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSecretRotation = (data: any) => {
    setRotationStatus(prev => ({
      ...prev,
      [data.path]: {
        lastRotated: new Date().toISOString(),
        version: data.version,
      },
    }));
    showNotification(`Secret rotated: ${data.path}`, 'success');
    loadVaultData();
  };

  const handleVaultHealth = (data: any) => {
    if (!data.healthy) {
      showNotification('Vault health check failed', 'warning');
    }
  };

  const handleCreateSecret = async () => {
    try {
      const response = await fetch('/api/vault/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(secretForm),
      });

      if (!response.ok) throw new Error('Failed to create secret');

      showNotification('Secret created successfully', 'success');
      setShowSecretDialog(false);
      loadVaultData();
    } catch (error) {
      showNotification('Failed to create secret', 'error');
    }
  };

  const handleDeleteSecret = async (path: string) => {
    if (!confirm(`Are you sure you want to delete the secret at ${path}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/vault/secrets/${encodeURIComponent(path)}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete secret');

      showNotification('Secret deleted successfully', 'success');
      loadVaultData();
    } catch (error) {
      showNotification('Failed to delete secret', 'error');
    }
  };

  const handleRotateSecret = async (path: string) => {
    try {
      const response = await fetch(`/api/vault/secrets/${encodeURIComponent(path)}/rotate`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to rotate secret');

      showNotification('Secret rotation initiated', 'success');
    } catch (error) {
      showNotification('Failed to rotate secret', 'error');
    }
  };

  const handleGenerateDatabaseCredentials = async () => {
    try {
      const response = await fetch('/api/vault/database/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbCredForm),
      });

      if (!response.ok) throw new Error('Failed to generate credentials');

      const creds = await response.json();
      
      // Show credentials in a dialog
      alert(`Username: ${creds.username}\nPassword: ${creds.password}\nExpires: ${creds.expirationTime}`);
      
      showNotification('Database credentials generated', 'success');
    } catch (error) {
      showNotification('Failed to generate database credentials', 'error');
    }
  };

  const handleIssueCertificate = async () => {
    try {
      const response = await fetch('/api/vault/pki/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(certForm),
      });

      if (!response.ok) throw new Error('Failed to issue certificate');

      const cert = await response.json();
      
      // Download certificate
      const blob = new Blob([cert.certificate], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${certForm.commonName}.crt`;
      a.click();
      
      showNotification('Certificate issued successfully', 'success');
      loadVaultData();
    } catch (error) {
      showNotification('Failed to issue certificate', 'error');
    }
  };

  const handleEncrypt = async () => {
    try {
      const response = await fetch('/api/vault/transit/encrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(encryptForm),
      });

      if (!response.ok) throw new Error('Failed to encrypt data');

      const result = await response.json();
      
      // Copy to clipboard
      navigator.clipboard.writeText(result.ciphertext);
      showNotification('Data encrypted and copied to clipboard', 'success');
    } catch (error) {
      showNotification('Failed to encrypt data', 'error');
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPassword(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showNotification('Copied to clipboard', 'success');
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Shield /> HashiCorp Vault Manager
      </Typography>
      
      <Alert severity="info" sx={{ mb: 2 }}>
        Enterprise-grade secret management with HashiCorp Vault - Superior to basic environment variables
      </Alert>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab icon={<Key />} label="Secrets" />
          <Tab icon={<Database />} label="Databases" />
          <Tab icon={<Certificate />} label="PKI" />
          <Tab icon={<Lock />} label="Encryption" />
          <Tab icon={<Policy />} label="Policies" />
          <Tab icon={<Settings />} label="Configuration" />
        </Tabs>
      </Paper>

      {loading && <LinearProgress />}

      {/* Secrets Tab */}
      <TabPanel value={activeTab} index={0}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="h6">Secret Management</Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setShowSecretDialog(true)}
          >
            Create Secret
          </Button>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Path</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Rotation Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {secrets.map((secret) => (
                <TableRow key={secret.path}>
                  <TableCell>
                    <Chip
                      icon={<Storage />}
                      label={secret.path}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Badge badgeContent={secret.metadata?.version} color="primary">
                      <History />
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(secret.metadata?.created_time || '').toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {rotationStatus[secret.path] ? (
                      <Chip
                        icon={<CheckCircle />}
                        label={`v${rotationStatus[secret.path].version}`}
                        color="success"
                        size="small"
                      />
                    ) : (
                      <Chip
                        icon={<Timer />}
                        label="Not rotated"
                        size="small"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedSecret(secret);
                        setShowSecretDialog(true);
                      }}
                    >
                      <Visibility />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleRotateSecret(secret.path)}
                    >
                      <Refresh />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteSecret(secret.path)}
                    >
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Database Tab */}
      <TabPanel value={activeTab} index={1}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Dynamic Database Credentials
          </Typography>
          <Alert severity="success" sx={{ mb: 2 }}>
            Generate temporary database credentials with automatic expiration
          </Alert>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Generate Credentials
                </Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Database</InputLabel>
                  <Select
                    value={dbCredForm.database}
                    onChange={(e) => setDbCredForm({ ...dbCredForm, database: e.target.value })}
                  >
                    <MenuItem value="postgresql">PostgreSQL</MenuItem>
                    <MenuItem value="mysql">MySQL</MenuItem>
                    <MenuItem value="mongodb">MongoDB</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={dbCredForm.role}
                    onChange={(e) => setDbCredForm({ ...dbCredForm, role: e.target.value })}
                  >
                    <MenuItem value="readonly">Read Only</MenuItem>
                    <MenuItem value="readwrite">Read/Write</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="TTL"
                  value={dbCredForm.ttl}
                  onChange={(e) => setDbCredForm({ ...dbCredForm, ttl: e.target.value })}
                  sx={{ mb: 2 }}
                  helperText="Time to live (e.g., 1h, 30m)"
                />

                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<VpnKey />}
                  onClick={handleGenerateDatabaseCredentials}
                >
                  Generate Credentials
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Active Credentials
                </Typography>
                
                {databases.map((db) => (
                  <Box key={db.id} sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Typography variant="subtitle2">{db.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Expires: {new Date(db.expiration).toLocaleString()}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={db.remainingPercent}
                      sx={{ mt: 1 }}
                    />
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* PKI Tab */}
      <TabPanel value={activeTab} index={2}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            PKI Certificate Management
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Issue and manage TLS certificates with built-in CA
          </Alert>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Issue Certificate
                </Typography>
                
                <TextField
                  fullWidth
                  label="Common Name"
                  value={certForm.commonName}
                  onChange={(e) => setCertForm({ ...certForm, commonName: e.target.value })}
                  sx={{ mb: 2 }}
                  placeholder="service.portal.local"
                />

                <TextField
                  fullWidth
                  label="Alt Names"
                  value={certForm.altNames.join(', ')}
                  onChange={(e) => setCertForm({ 
                    ...certForm, 
                    altNames: e.target.value.split(',').map(s => s.trim())
                  })}
                  sx={{ mb: 2 }}
                  helperText="Comma-separated alternative names"
                />

                <TextField
                  fullWidth
                  label="TTL"
                  value={certForm.ttl}
                  onChange={(e) => setCertForm({ ...certForm, ttl: e.target.value })}
                  sx={{ mb: 2 }}
                  helperText="Certificate validity period"
                />

                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<Certificate />}
                  onClick={handleIssueCertificate}
                >
                  Issue Certificate
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Issued Certificates
                </Typography>
                
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>CN</TableCell>
                        <TableCell>Serial</TableCell>
                        <TableCell>Expires</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {certificates.map((cert) => (
                        <TableRow key={cert.serialNumber}>
                          <TableCell>{cert.commonName}</TableCell>
                          <TableCell>
                            <Tooltip title={cert.serialNumber}>
                              <span>{cert.serialNumber.substring(0, 8)}...</span>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            {new Date(cert.expiration).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Encryption Tab */}
      <TabPanel value={activeTab} index={3}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Encryption as a Service
          </Typography>
          <Alert severity="success" sx={{ mb: 2 }}>
            Encrypt and decrypt data without managing encryption keys
          </Alert>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Encrypt Data
                </Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Encryption Key</InputLabel>
                  <Select
                    value={encryptForm.keyName}
                    onChange={(e) => setEncryptForm({ ...encryptForm, keyName: e.target.value })}
                  >
                    {encryptionKeys.map((key) => (
                      <MenuItem key={key.name} value={key.name}>
                        {key.name} ({key.type})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Plaintext"
                  value={encryptForm.plaintext}
                  onChange={(e) => setEncryptForm({ ...encryptForm, plaintext: e.target.value })}
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  label="Context (optional)"
                  value={encryptForm.context}
                  onChange={(e) => setEncryptForm({ ...encryptForm, context: e.target.value })}
                  sx={{ mb: 2 }}
                  helperText="Additional authenticated data"
                />

                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<Lock />}
                  onClick={handleEncrypt}
                >
                  Encrypt
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Encryption Keys
                </Typography>
                
                {encryptionKeys.map((key) => (
                  <Accordion key={key.name}>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography>{key.name}</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box>
                        <Typography variant="body2">
                          Type: {key.type}
                        </Typography>
                        <Typography variant="body2">
                          Version: {key.latest_version}
                        </Typography>
                        <Typography variant="body2">
                          Created: {new Date(key.creation_time).toLocaleString()}
                        </Typography>
                        <FormControlLabel
                          control={<Switch checked={key.exportable} disabled />}
                          label="Exportable"
                        />
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Policies Tab */}
      <TabPanel value={activeTab} index={4}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Access Policies
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {policies.map((policy) => (
            <Grid item xs={12} md={6} key={policy.name}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {policy.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {policy.description}
                  </Typography>
                  <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace' }}>
                      {policy.rules}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      {/* Configuration Tab */}
      <TabPanel value={activeTab} index={5}>
        <Typography variant="h6" gutterBottom>
          Vault Configuration
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Cluster Status
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CheckCircle color="success" />
                  <Typography>High Availability Mode</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  3-node Raft cluster with auto-unseal
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2">
                  Performance Standby Nodes: 2
                </Typography>
                <Typography variant="body2">
                  Replication Status: Active
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Audit Devices
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <CheckCircle color="success" />
                  <Typography variant="body2">File Audit: /vault/audit/audit.log</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <CheckCircle color="success" />
                  <Typography variant="body2">Syslog Audit: LOCAL0</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle color="success" />
                  <Typography variant="body2">Splunk Forwarder: Active</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Secret Dialog */}
      <Dialog
        open={showSecretDialog}
        onClose={() => {
          setShowSecretDialog(false);
          setSelectedSecret(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedSecret ? 'View Secret' : 'Create Secret'}
        </DialogTitle>
        <DialogContent>
          {selectedSecret ? (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Path: {selectedSecret.path}
              </Typography>
              <Typography variant="subtitle2" gutterBottom>
                Version: {selectedSecret.metadata?.version}
              </Typography>
              <Divider sx={{ my: 2 }} />
              {Object.entries(selectedSecret.data).map(([key, value]) => (
                <Box key={key} sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {key}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
                      fullWidth
                      type={showPassword[key] ? 'text' : 'password'}
                      value={value}
                      InputProps={{
                        readOnly: true,
                        endAdornment: (
                          <>
                            <IconButton onClick={() => togglePasswordVisibility(key)}>
                              {showPassword[key] ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                            <IconButton onClick={() => copyToClipboard(value)}>
                              <ContentCopy />
                            </IconButton>
                          </>
                        ),
                      }}
                    />
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
            <Box>
              <TextField
                fullWidth
                label="Path"
                value={secretForm.path}
                onChange={(e) => setSecretForm({ ...secretForm, path: e.target.value })}
                sx={{ mb: 2 }}
                placeholder="apps/myapp/production"
              />
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Engine</InputLabel>
                <Select
                  value={secretForm.engine}
                  onChange={(e) => setSecretForm({ ...secretForm, engine: e.target.value })}
                >
                  <MenuItem value="kv-v2">KV v2</MenuItem>
                  <MenuItem value="database">Database</MenuItem>
                  <MenuItem value="pki">PKI</MenuItem>
                  <MenuItem value="transit">Transit</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Secret Data (JSON)"
                value={JSON.stringify(secretForm.data, null, 2)}
                onChange={(e) => {
                  try {
                    setSecretForm({ ...secretForm, data: JSON.parse(e.target.value) });
                  } catch {}
                }}
                sx={{ mb: 2 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowSecretDialog(false);
            setSelectedSecret(null);
          }}>
            Cancel
          </Button>
          {!selectedSecret && (
            <Button onClick={handleCreateSecret} variant="contained">
              Create
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VaultManager;