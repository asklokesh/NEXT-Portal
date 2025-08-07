# Enhanced Plugin Management System - Infrastructure as Code
# Terraform configuration for multi-cloud deployment

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.10"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 4.70"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.60"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "~> 3.18"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  backend "s3" {
    bucket         = "portal-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

# Local values for configuration
locals {
  common_tags = {
    Project     = "enhanced-plugin-management"
    Environment = var.environment
    ManagedBy   = "terraform"
    Owner       = "platform-team"
    CostCenter  = "engineering"
  }

  # Environment-specific configurations
  env_configs = {
    development = {
      instance_count     = 1
      instance_size     = "small"
      database_size     = "db.t3.micro"
      cache_node_type   = "cache.t3.micro"
      min_capacity      = 1
      max_capacity      = 3
      backup_retention  = 7
    }
    staging = {
      instance_count     = 2
      instance_size     = "medium"
      database_size     = "db.t3.small"
      cache_node_type   = "cache.t3.small"
      min_capacity      = 2
      max_capacity      = 6
      backup_retention  = 14
    }
    production = {
      instance_count     = 3
      instance_size     = "large"
      database_size     = "db.r5.large"
      cache_node_type   = "cache.r5.large"
      min_capacity      = 3
      max_capacity      = 20
      backup_retention  = 30
    }
  }

  current_config = local.env_configs[var.environment]
}

# Data sources for existing infrastructure
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# Random password generation
resource "random_password" "database_password" {
  length  = 32
  special = true
}

resource "random_password" "redis_auth_token" {
  length  = 64
  special = false
}

# TLS certificate for internal communications
resource "tls_private_key" "internal_ca" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "tls_self_signed_cert" "internal_ca" {
  private_key_pem = tls_private_key.internal_ca.private_key_pem

  subject {
    common_name  = "Portal Internal CA"
    organization = "Platform Engineering"
  }

  validity_period_hours = 8760 # 1 year
  is_ca_certificate     = true

  allowed_uses = [
    "key_encipherment",
    "digital_signature",
    "cert_signing",
  ]
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = local.common_tags
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
  
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
    
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
    }
  }
}

# VPC Configuration
module "vpc" {
  source = "./modules/vpc"

  environment = var.environment
  region      = var.aws_region
  
  vpc_cidr = var.vpc_cidr
  availability_zones = data.aws_availability_zones.available.names

  enable_nat_gateway = true
  enable_vpn_gateway = var.enable_vpn_gateway
  enable_dns_hostnames = true
  enable_dns_support = true

  tags = local.common_tags
}

# EKS Cluster
module "eks" {
  source = "./modules/eks"

  cluster_name    = "portal-${var.environment}"
  cluster_version = var.kubernetes_version
  
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnets
  
  node_groups = {
    system = {
      instance_types = ["m5.large"]
      scaling_config = {
        desired_size = 2
        max_size     = 4
        min_size     = 2
      }
      labels = {
        role = "system"
      }
      taints = {
        dedicated = "system:NoSchedule"
      }
    }
    
    application = {
      instance_types = ["m5.xlarge"]
      scaling_config = {
        desired_size = local.current_config.min_capacity
        max_size     = local.current_config.max_capacity
        min_size     = local.current_config.min_capacity
      }
      labels = {
        role = "application"
      }
    }
    
    compute = {
      instance_types = ["c5.2xlarge"]
      scaling_config = {
        desired_size = 1
        max_size     = 10
        min_size     = 0
      }
      labels = {
        role = "compute-intensive"
      }
    }
  }

  tags = local.common_tags
}

# RDS PostgreSQL Database
module "database" {
  source = "./modules/rds"

  identifier = "portal-${var.environment}"
  engine     = "postgres"
  engine_version = "15.3"
  
  instance_class = local.current_config.database_size
  allocated_storage = 100
  max_allocated_storage = 1000
  
  db_name  = "portal"
  username = "portal_user"
  password = random_password.database_password.result
  
  vpc_security_group_ids = [module.security_groups.database_sg_id]
  db_subnet_group_name   = module.vpc.database_subnet_group
  
  backup_retention_period = local.current_config.backup_retention
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  multi_az = var.environment == "production"
  
  performance_insights_enabled = true
  monitoring_interval         = 60
  
  deletion_protection = var.environment == "production"
  
  tags = merge(local.common_tags, {
    Name = "portal-${var.environment}-database"
  })
}

# ElastiCache Redis Cluster
module "redis" {
  source = "./modules/elasticache"

  cluster_id         = "portal-${var.environment}"
  engine             = "redis"
  engine_version     = "7.0"
  node_type          = local.current_config.cache_node_type
  port               = 6379
  parameter_group_name = "default.redis7"
  
  num_cache_nodes    = var.environment == "production" ? 3 : 1
  
  subnet_group_name   = module.vpc.elasticache_subnet_group
  security_group_ids  = [module.security_groups.redis_sg_id]
  
  auth_token                 = random_password.redis_auth_token.result
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  
  snapshot_retention_limit = local.current_config.backup_retention
  snapshot_window         = "03:00-05:00"
  
  tags = merge(local.common_tags, {
    Name = "portal-${var.environment}-cache"
  })
}

# Security Groups
module "security_groups" {
  source = "./modules/security-groups"
  
  vpc_id = module.vpc.vpc_id
  
  environment = var.environment
  vpc_cidr    = var.vpc_cidr
  
  tags = local.common_tags
}

# Application Load Balancer
module "alb" {
  source = "./modules/alb"
  
  name     = "portal-${var.environment}"
  vpc_id   = module.vpc.vpc_id
  subnets  = module.vpc.public_subnets
  
  security_groups = [module.security_groups.alb_sg_id]
  
  certificate_arn = var.ssl_certificate_arn
  
  tags = local.common_tags
}

# Vault for Secrets Management
module "vault" {
  source = "./modules/vault"
  
  cluster_name = "portal-vault-${var.environment}"
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets
  
  instance_type = var.environment == "production" ? "m5.large" : "t3.medium"
  node_count    = var.environment == "production" ? 3 : 1
  
  kms_key_id = aws_kms_key.vault.key_id
  
  tags = local.common_tags
}

# KMS Key for Vault
resource "aws_kms_key" "vault" {
  description             = "KMS key for Vault auto-unseal"
  deletion_window_in_days = 7
  
  tags = merge(local.common_tags, {
    Name = "portal-vault-${var.environment}"
  })
}

resource "aws_kms_alias" "vault" {
  name          = "alias/portal-vault-${var.environment}"
  target_key_id = aws_kms_key.vault.key_id
}

# S3 Bucket for Application Assets
resource "aws_s3_bucket" "assets" {
  bucket = "portal-assets-${var.environment}-${random_id.bucket_suffix.hex}"
  
  tags = merge(local.common_tags, {
    Name = "portal-assets-${var.environment}"
  })
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "assets" {
  count = var.enable_cdn ? 1 : 0
  
  origin {
    domain_name = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.assets.bucket}"
    
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.assets[0].cloudfront_access_identity_path
    }
  }
  
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  
  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.assets.bucket}"
    
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
    
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }
  
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  
  viewer_certificate {
    cloudfront_default_certificate = var.ssl_certificate_arn == null
    acm_certificate_arn            = var.ssl_certificate_arn
    ssl_support_method             = var.ssl_certificate_arn != null ? "sni-only" : null
  }
  
  tags = merge(local.common_tags, {
    Name = "portal-assets-${var.environment}"
  })
}

resource "aws_cloudfront_origin_access_identity" "assets" {
  count = var.enable_cdn ? 1 : 0
  comment = "Portal assets OAI for ${var.environment}"
}

# Route53 DNS Records
resource "aws_route53_record" "portal" {
  count = var.domain_name != null ? 1 : 0
  
  zone_id = var.route53_zone_id
  name    = var.environment == "production" ? var.domain_name : "${var.environment}.${var.domain_name}"
  type    = "A"
  
  alias {
    name                   = module.alb.dns_name
    zone_id                = module.alb.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "api" {
  count = var.domain_name != null ? 1 : 0
  
  zone_id = var.route53_zone_id
  name    = var.environment == "production" ? "api.${var.domain_name}" : "api-${var.environment}.${var.domain_name}"
  type    = "A"
  
  alias {
    name                   = module.alb.dns_name
    zone_id                = module.alb.zone_id
    evaluate_target_health = true
  }
}

# IAM Roles for Services
resource "aws_iam_role" "portal_service_role" {
  name = "portal-service-role-${var.environment}"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRoleWithWebIdentity"
        Effect = "Allow"
        Principal = {
          Federated = module.eks.oidc_provider_arn
        }
        Condition = {
          StringEquals = {
            "${module.eks.oidc_provider}:sub" = "system:serviceaccount:developer-portal:portal-service"
            "${module.eks.oidc_provider}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })
  
  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "portal_service_policy" {
  role       = aws_iam_role.portal_service_role.name
  policy_arn = aws_iam_policy.portal_service_policy.arn
}

resource "aws_iam_policy" "portal_service_policy" {
  name        = "portal-service-policy-${var.environment}"
  description = "IAM policy for portal service"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.assets.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.assets.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:portal/${var.environment}/*"
        ]
      }
    ]
  })
  
  tags = local.common_tags
}

# Secrets Manager for Application Secrets
resource "aws_secretsmanager_secret" "database_credentials" {
  name = "portal/${var.environment}/database"
  description = "Database credentials for portal ${var.environment}"
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "database_credentials" {
  secret_id = aws_secretsmanager_secret.database_credentials.id
  secret_string = jsonencode({
    username = module.database.username
    password = module.database.password
    endpoint = module.database.endpoint
    port     = module.database.port
    dbname   = module.database.db_name
  })
}

resource "aws_secretsmanager_secret" "redis_credentials" {
  name = "portal/${var.environment}/redis"
  description = "Redis credentials for portal ${var.environment}"
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "redis_credentials" {
  secret_id = aws_secretsmanager_secret.redis_credentials.id
  secret_string = jsonencode({
    endpoint   = module.redis.endpoint
    port       = module.redis.port
    auth_token = random_password.redis_auth_token.result
  })
}

# Monitoring and Logging
module "monitoring" {
  source = "./modules/monitoring"
  
  cluster_name = module.eks.cluster_name
  environment  = var.environment
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets
  
  enable_prometheus = true
  enable_grafana    = true
  enable_alertmanager = true
  
  grafana_admin_password = var.grafana_admin_password
  
  tags = local.common_tags
}

# Backup Configuration
module "backup" {
  source = "./modules/backup"
  
  environment = var.environment
  
  database_arn = module.database.arn
  
  backup_retention_days = local.current_config.backup_retention
  backup_schedule       = var.backup_schedule
  
  tags = local.common_tags
}