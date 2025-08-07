import React, { useEffect, useState } from 'react';
import { SecurityDashboardService, SecurityData } from '@/services/security/security-dashboard-service';

const securityService = new SecurityDashboardService();

export const SecurityDashboard: React.FC = () => {
  const [data, setData] = useState<SecurityData | null>(null);

  useEffect(() => {
    securityService.getSecurityData().then(setData);
  }, []);

  if (!data) {
    return <div>Loading security data...</div>;
  }

  return (
    <div>
      <h1>Security Dashboard</h1>
      <div>
        <h2>Vulnerabilities</h2>
        <p>Critical: {data.vulnerabilities.critical}</p>
        <p>High: {data.vulnerabilities.high}</p>
        <p>Medium: {data.vulnerabilities.medium}</p>
        <p>Low: {data.vulnerabilities.low}</p>
      </div>
      <div>
        <h2>Compliance</h2>
        <p>SOC2: {data.compliance.soc2 ? 'Compliant' : 'Non-compliant'}</p>
        <p>GDPR: {data.compliance.gdpr ? 'Compliant' : 'Non-compliant'}</p>
      </div>
    </div>
  );
};
