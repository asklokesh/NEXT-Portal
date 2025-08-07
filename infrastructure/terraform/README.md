
# Terraform Infrastructure

This directory contains the Terraform configuration for provisioning the cloud infrastructure for the Enhanced Plugin Management System.

## Prerequisites

- Terraform v1.5.0 or later
- AWS CLI configured with appropriate credentials
- Vault CLI (optional, for secret management)

## Initialization

Before applying the configuration, you need to initialize the Terraform working directory. Run the following command:

```bash
terraform init
```

## Planning

To create an execution plan, run the following command. This will show you what Terraform will do before making any changes.

```bash
terraform plan -var-file="production.tfvars" -var-file="secrets.tfvars"
```

## Applying

To apply the configuration and provision the infrastructure, run the following command:

```bash
terraform apply -var-file="production.tfvars" -var-file="secrets.tfvars" -auto-approve
```

## Destroying

To destroy the infrastructure and all its resources, run the following command:

```bash
terraform destroy -var-file="production.tfvars" -var-file="secrets.tfvars" -auto-approve
```

## Secret Management with Vault

For enhanced security, we recommend using HashiCorp Vault to manage sensitive values. Here's how you can use Vault with this Terraform configuration:

1.  **Start a Vault server.** You can use the provided `docker-compose.yml` file in the `vault` directory to start a local Vault server.

2.  **Initialize and unseal Vault.**

3.  **Write the secrets to Vault.** You can use the `vault kv put` command to write the secrets from your `secrets.tfvars` file to Vault.

4.  **Configure Terraform to use Vault.** You will need to configure the Vault provider in `main.tf` and use the `vault_generic_secret` data source to read the secrets from Vault.

By using Vault, you can avoid storing sensitive values in plaintext files and enhance the security of your infrastructure.
