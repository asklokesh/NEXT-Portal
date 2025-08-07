# Vault Secret Governance Policies with Open Policy Agent (OPA)
# These policies enforce security, compliance, and operational governance

package vault.governance

import rego.v1

# Default deny - all requests must be explicitly allowed
default allow := false

# Allow requests that pass all governance checks
allow if {
    not deny_request
    path_allowed
    user_authorized
    time_restrictions_met
    compliance_check_passed
    risk_assessment_acceptable
}

# Deny request if any critical violation is found
deny_request if {
    critical_violation
}

# Critical violations that always deny access
critical_violation if {
    # Prevent access to root tokens
    input.auth.policies[_] == "root"
    not input.user.emergency_access
}

critical_violation if {
    # Block access during maintenance windows
    input.request.operation != "read"
    maintenance_window_active
}

critical_violation if {
    # Prevent unauthorized policy modifications
    startswith(input.request.path, "sys/policies/")
    input.request.operation in ["create", "update", "delete"]
    not input.user.admin
}

# Path-based access controls
path_allowed if {
    # Personal secrets access
    startswith(input.request.path, sprintf("secret/data/users/%s/", [input.user.id]))
}

path_allowed if {
    # Application secrets for developers
    startswith(input.request.path, "secret/data/apps/")
    input.user.role == "developer"
    app_name := split(input.request.path, "/")[3]
    app_name in input.user.authorized_apps
}

path_allowed if {
    # Database credentials with proper justification
    startswith(input.request.path, "database/creds/")
    input.request.justification
    count(input.request.justification) > 10
}

path_allowed if {
    # PKI certificate issuance
    startswith(input.request.path, "pki_int/issue/")
    certificate_request_valid
}

path_allowed if {
    # Transit encryption operations
    startswith(input.request.path, "transit/")
    transit_operation_allowed
}

# User authorization checks
user_authorized if {
    # Emergency access override
    input.user.emergency_access
    emergency_access_valid
}

user_authorized if {
    # Regular user with valid session
    input.user.authenticated
    not input.user.account_locked
    session_within_limits
}

user_authorized if {
    # Service accounts with proper attestation
    input.user.type == "service_account"
    service_account_attestation_valid
}

# Time-based restrictions
time_restrictions_met if {
    # Allow during business hours for regular users
    input.user.type == "human"
    business_hours_active
}

time_restrictions_met if {
    # Service accounts can operate 24/7
    input.user.type == "service_account"
}

time_restrictions_met if {
    # Emergency access override
    input.user.emergency_access
}

# Compliance checks for different regulations
compliance_check_passed if {
    gdpr_compliance_check
    sox_compliance_check
    pci_compliance_check
    hipaa_compliance_check
}

gdpr_compliance_check if {
    # GDPR compliance for personal data
    not contains_personal_data
}

gdpr_compliance_check if {
    contains_personal_data
    gdpr_consent_verified
    gdpr_purpose_legitimate
    gdpr_retention_compliant
}

sox_compliance_check if {
    # SOX compliance for financial data
    not contains_financial_data
}

sox_compliance_check if {
    contains_financial_data
    sox_segregation_of_duties
    sox_audit_trail_enabled
}

pci_compliance_check if {
    # PCI-DSS compliance for payment data
    not contains_payment_data
}

pci_compliance_check if {
    contains_payment_data
    pci_network_segmentation
    pci_encryption_standards
    pci_access_logging
}

hipaa_compliance_check if {
    # HIPAA compliance for health data
    not contains_health_data
}

hipaa_compliance_check if {
    contains_health_data
    hipaa_minimum_necessary
    hipaa_authorization_valid
}

# Risk assessment
risk_assessment_acceptable if {
    calculated_risk_score <= risk_threshold
}

calculated_risk_score := score if {
    score := sum([
        base_risk_score,
        user_risk_adjustment,
        path_risk_adjustment,
        operation_risk_adjustment,
        time_risk_adjustment,
        context_risk_adjustment
    ])
}

base_risk_score := 1  # Base score for any operation

user_risk_adjustment := adjustment if {
    input.user.risk_level == "high"
    adjustment := 3
} else := adjustment if {
    input.user.risk_level == "medium"
    adjustment := 2
} else := 1

path_risk_adjustment := adjustment if {
    high_risk_paths[_] == input.request.path
    adjustment := 4
} else := adjustment if {
    medium_risk_paths[_] == input.request.path
    adjustment := 2
} else := 1

operation_risk_adjustment := adjustment if {
    input.request.operation in ["delete", "destroy", "revoke"]
    adjustment := 3
} else := adjustment if {
    input.request.operation in ["create", "update"]
    adjustment := 2
} else := 1

time_risk_adjustment := adjustment if {
    not business_hours_active
    adjustment := 2
} else := 1

context_risk_adjustment := adjustment if {
    input.client.ip_reputation == "suspicious"
    adjustment := 3
} else := adjustment if {
    input.client.new_location
    adjustment := 2
} else := 1

risk_threshold := threshold if {
    input.user.type == "service_account"
    threshold := 12
} else := threshold if {
    input.user.emergency_access
    threshold := 15
} else := 8

# Certificate request validation
certificate_request_valid if {
    input.request.data.common_name
    valid_domain(input.request.data.common_name)
    certificate_duration_acceptable
}

valid_domain(domain) if {
    allowed_domains := [
        "*.backstage.local",
        "*.company.com",
        "*.internal.company.com"
    ]
    
    some allowed_domain in allowed_domains
    glob.match(allowed_domain, [], domain)
}

certificate_duration_acceptable if {
    ttl_seconds := time.parse_duration_ns(input.request.data.ttl) / 1000000000
    ttl_seconds <= max_certificate_duration
}

max_certificate_duration := duration if {
    input.user.type == "service_account"
    duration := 2592000  # 30 days
} else := 86400  # 1 day for human users

# Transit operation controls
transit_operation_allowed if {
    input.request.operation == "encrypt"
    encrypt_operation_allowed
}

transit_operation_allowed if {
    input.request.operation == "decrypt"
    decrypt_operation_allowed
}

encrypt_operation_allowed if {
    # Allow encryption for authorized applications
    key_name := split(input.request.path, "/")[2]
    key_name in input.user.authorized_encryption_keys
}

decrypt_operation_allowed if {
    # Allow decryption with additional controls
    key_name := split(input.request.path, "/")[2]
    key_name in input.user.authorized_encryption_keys
    input.request.justification
    count(input.request.justification) > 20
}

# Emergency access validation
emergency_access_valid if {
    input.user.emergency_ticket
    emergency_ticket_valid(input.user.emergency_ticket)
    emergency_approver_validated
}

emergency_ticket_valid(ticket) if {
    ticket.status == "approved"
    time.now_ns() < time.parse_rfc3339_ns(ticket.expires_at)
    ticket.approver in emergency_approvers
}

emergency_approver_validated if {
    input.user.emergency_ticket.approver_signature
    # In production, verify cryptographic signature
    input.user.emergency_ticket.approver_signature != ""
}

# Service account attestation
service_account_attestation_valid if {
    input.auth.metadata.kubernetes_service_account
    input.auth.metadata.kubernetes_namespace
    kubernetes_rbac_validated
}

kubernetes_rbac_validated if {
    # Validate Kubernetes RBAC allows this operation
    # This would integrate with Kubernetes API in production
    input.auth.metadata.kubernetes_service_account in authorized_service_accounts
}

# Session validation
session_within_limits if {
    session_age_seconds := (time.now_ns() - time.parse_rfc3339_ns(input.auth.issued_at)) / 1000000000
    session_age_seconds < max_session_duration
}

max_session_duration := duration if {
    input.user.type == "service_account"
    duration := 86400  # 24 hours
} else := duration if {
    input.user.emergency_access
    duration := 7200   # 2 hours
} else := 28800  # 8 hours

# Business hours check
business_hours_active if {
    current_hour := time.clock([time.now_ns(), "UTC"])[3]
    current_hour >= 8
    current_hour <= 18
    
    current_weekday := time.weekday(time.now_ns())
    current_weekday in [1, 2, 3, 4, 5]  # Monday to Friday
}

# Maintenance window check
maintenance_window_active if {
    some window in maintenance_windows
    time.now_ns() >= time.parse_rfc3339_ns(window.start)
    time.now_ns() <= time.parse_rfc3339_ns(window.end)
}

# Data classification checks
contains_personal_data if {
    personal_data_paths := [
        "secret/data/users/",
        "secret/data/pii/",
        "secret/data/personal/"
    ]
    
    some path in personal_data_paths
    startswith(input.request.path, path)
}

contains_financial_data if {
    financial_data_paths := [
        "secret/data/financial/",
        "secret/data/accounting/",
        "database/creds/finance"
    ]
    
    some path in financial_data_paths
    startswith(input.request.path, path)
}

contains_payment_data if {
    payment_data_paths := [
        "secret/data/payments/",
        "secret/data/cards/",
        "secret/data/merchant/"
    ]
    
    some path in payment_data_paths
    startswith(input.request.path, path)
}

contains_health_data if {
    health_data_paths := [
        "secret/data/health/",
        "secret/data/medical/",
        "secret/data/patient/"
    ]
    
    some path in health_data_paths
    startswith(input.request.path, path)
}

# GDPR specific checks
gdpr_consent_verified if {
    input.request.metadata.gdpr_consent_id
    # In production, verify consent in consent management system
    input.request.metadata.gdpr_consent_id != ""
}

gdpr_purpose_legitimate if {
    gdpr_purposes := [
        "legitimate_interest",
        "contract_performance",
        "legal_obligation",
        "vital_interests",
        "public_task",
        "consent"
    ]
    
    input.request.metadata.gdpr_purpose in gdpr_purposes
}

gdpr_retention_compliant if {
    # Check data retention period
    retention_days := input.request.metadata.retention_days
    retention_days <= max_retention_days
}

max_retention_days := 2555  # 7 years default

# SOX specific checks
sox_segregation_of_duties if {
    # Ensure segregation of duties for financial operations
    not (input.user.roles.preparer && input.user.roles.approver)
}

sox_audit_trail_enabled if {
    input.request.metadata.audit_required == true
}

# PCI-DSS specific checks
pci_network_segmentation if {
    # Verify request comes from PCI-compliant network segment
    pci_networks := [
        "10.1.0.0/16",
        "192.168.100.0/24"
    ]
    
    some network in pci_networks
    net.cidr_contains(network, input.client.ip)
}

pci_encryption_standards if {
    # Verify encryption standards for PCI data
    input.request.metadata.encryption_standard in ["AES256", "RSA2048"]
}

pci_access_logging if {
    input.request.metadata.log_level == "detailed"
}

# HIPAA specific checks
hipaa_minimum_necessary if {
    # Verify minimum necessary standard
    input.request.metadata.minimum_necessary_justified == true
}

hipaa_authorization_valid if {
    input.request.metadata.hipaa_authorization_id
    # In production, verify with authorization system
    input.request.metadata.hipaa_authorization_id != ""
}

# Configuration data
high_risk_paths := [
    "sys/",
    "auth/",
    "secret/data/admin/",
    "secret/data/root/"
]

medium_risk_paths := [
    "database/creds/",
    "pki_int/issue/",
    "secret/data/infrastructure/"
]

emergency_approvers := [
    "security-manager",
    "cto",
    "ciso"
]

authorized_service_accounts := [
    "backstage-app",
    "vault-agent",
    "monitoring-service"
]

maintenance_windows := [
    {
        "start": "2024-08-07T02:00:00Z",
        "end": "2024-08-07T04:00:00Z",
        "description": "Weekly maintenance"
    }
]

# Helper functions for policy decisions
deny_reason := reason if {
    critical_violation
    reason := "Critical security violation detected"
} else := reason if {
    not path_allowed
    reason := "Access to requested path is not permitted"
} else := reason if {
    not user_authorized
    reason := "User authorization failed"
} else := reason if {
    not time_restrictions_met
    reason := "Time-based access restrictions not met"
} else := reason if {
    not compliance_check_passed
    reason := "Compliance requirements not satisfied"
} else := reason if {
    not risk_assessment_acceptable
    reason := sprintf("Risk score %d exceeds threshold %d", [calculated_risk_score, risk_threshold])
} else := "Access denied by policy"

# Policy metadata for debugging and auditing
policy_decision := {
    "allow": allow,
    "risk_score": calculated_risk_score,
    "risk_threshold": risk_threshold,
    "business_hours": business_hours_active,
    "maintenance_window": maintenance_window_active,
    "compliance_flags": {
        "gdpr": gdpr_compliance_check,
        "sox": sox_compliance_check,
        "pci": pci_compliance_check,
        "hipaa": hipaa_compliance_check
    },
    "path_classification": {
        "personal_data": contains_personal_data,
        "financial_data": contains_financial_data,
        "payment_data": contains_payment_data,
        "health_data": contains_health_data
    }
}