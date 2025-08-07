-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('PENDING', 'VALIDATING', 'READY', 'DEPLOYING', 'DEPLOYED', 'FAILED', 'ROLLED_BACK', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VersionSource" AS ENUM ('NPM', 'GIT', 'LOCAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DeploymentStrategy" AS ENUM ('ROLLING', 'BLUE_GREEN', 'CANARY', 'IMMEDIATE');

-- CreateEnum
CREATE TYPE "BackupType" AS ENUM ('FULL', 'INCREMENTAL', 'CONFIGURATION', 'DATABASE_SNAPSHOT', 'FILE_SYSTEM', 'COMBINED');

-- CreateEnum
CREATE TYPE "BackupSource" AS ENUM ('AUTOMATIC', 'MANUAL', 'SCHEDULED', 'PRE_DEPLOYMENT', 'POST_DEPLOYMENT', 'ROLLBACK');

-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('PENDING', 'CREATING', 'UPLOADING', 'COMPLETED', 'FAILED', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "RestoreType" AS ENUM ('POINT_IN_TIME', 'VERSION_ROLLBACK', 'CONFIGURATION_ONLY', 'DATABASE_ONLY', 'FULL_RESTORE');

-- CreateEnum
CREATE TYPE "MigrationType" AS ENUM ('DATABASE_SCHEMA', 'CONFIGURATION', 'FILE_SYSTEM', 'PERMISSIONS', 'DEPENDENCIES', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MigrationStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'ROLLED_BACK', 'SKIPPED');

-- CreateEnum
CREATE TYPE "DisasterRecoveryType" AS ENUM ('FULL_BACKUP', 'INCREMENTAL_BACKUP', 'RESTORE_TEST', 'ACTUAL_RECOVERY', 'SCHEDULED_TEST');

-- CreateEnum
CREATE TYPE "DisasterRecoveryStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'VERIFIED');

-- CreateTable
CREATE TABLE "plugins" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "author" TEXT,
    "repository" TEXT,
    "homepage" TEXT,
    "npm" TEXT,
    "isInstalled" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_versions" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "semverMajor" INTEGER NOT NULL,
    "semverMinor" INTEGER NOT NULL,
    "semverPatch" INTEGER NOT NULL,
    "prereleaseTag" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "isDeployed" BOOLEAN NOT NULL DEFAULT false,
    "status" "VersionStatus" NOT NULL DEFAULT 'PENDING',
    "changelog" TEXT,
    "dependencies" JSONB,
    "configuration" JSONB,
    "migrationScript" TEXT,
    "installSource" "VersionSource" NOT NULL DEFAULT 'NPM',
    "gitCommit" TEXT,
    "gitBranch" TEXT,
    "deployedBy" TEXT,
    "deployedAt" TIMESTAMP(3),
    "rollbackOf" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_deployments" (
    "id" TEXT NOT NULL,
    "pluginVersionId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "status" "DeploymentStatus" NOT NULL DEFAULT 'PENDING',
    "strategy" "DeploymentStrategy" NOT NULL DEFAULT 'ROLLING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "logs" TEXT,
    "error" TEXT,
    "healthCheck" JSONB,
    "rollbackPlan" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "deployedBy" TEXT NOT NULL,
    "rollbackDeadline" TIMESTAMP(3),

    CONSTRAINT "plugin_deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_configurations" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_backups" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "beforeVersionId" TEXT,
    "afterVersionId" TEXT,
    "backupType" "BackupType" NOT NULL,
    "source" "BackupSource" NOT NULL DEFAULT 'AUTOMATIC',
    "status" "BackupStatus" NOT NULL DEFAULT 'PENDING',
    "size" BIGINT,
    "compression" TEXT,
    "encryption" BOOLEAN NOT NULL DEFAULT true,
    "storageProvider" TEXT NOT NULL DEFAULT 's3',
    "storagePath" TEXT NOT NULL,
    "storageRegion" TEXT,
    "metadata" JSONB,
    "checksumAlgorithm" TEXT NOT NULL DEFAULT 'sha256',
    "checksum" TEXT,
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "expiresAt" TIMESTAMP(3),
    "error" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restore_points" (
    "id" TEXT NOT NULL,
    "backupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "restoreType" "RestoreType" NOT NULL,
    "metadata" JSONB,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restore_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_migration_executions" (
    "id" TEXT NOT NULL,
    "pluginVersionId" TEXT NOT NULL,
    "type" "MigrationType" NOT NULL,
    "script" TEXT NOT NULL,
    "status" "MigrationStatus" NOT NULL DEFAULT 'PENDING',
    "output" TEXT,
    "error" TEXT,
    "executionTime" INTEGER,
    "rollbackScript" TEXT,
    "executedBy" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_migration_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disaster_recovery_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" JSONB NOT NULL,
    "backupSchedule" TEXT NOT NULL,
    "retentionPolicy" JSONB NOT NULL,
    "storageProviders" JSONB NOT NULL,
    "alertChannels" JSONB NOT NULL,
    "testSchedule" TEXT,
    "lastTestAt" TIMESTAMP(3),
    "nextTestAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disaster_recovery_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disaster_recovery_executions" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "type" "DisasterRecoveryType" NOT NULL,
    "status" "DisasterRecoveryStatus" NOT NULL DEFAULT 'PENDING',
    "triggerReason" TEXT,
    "scope" JSONB,
    "metrics" JSONB,
    "verificationResults" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "executedBy" TEXT,

    CONSTRAINT "disaster_recovery_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plugins_name_key" ON "plugins"("name");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_versions_pluginId_version_key" ON "plugin_versions"("pluginId", "version");

-- CreateIndex
CREATE INDEX "plugin_versions_pluginId_isCurrent_idx" ON "plugin_versions"("pluginId", "isCurrent");

-- CreateIndex
CREATE INDEX "plugin_versions_status_deployedAt_idx" ON "plugin_versions"("status", "deployedAt");

-- CreateIndex
CREATE INDEX "plugin_deployments_status_startedAt_idx" ON "plugin_deployments"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_configurations_pluginId_environment_key" ON "plugin_configurations"("pluginId", "environment");

-- CreateIndex
CREATE INDEX "plugin_backups_pluginId_createdAt_idx" ON "plugin_backups"("pluginId", "createdAt");

-- CreateIndex
CREATE INDEX "plugin_backups_status_expiresAt_idx" ON "plugin_backups"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "plugin_migration_executions_pluginVersionId_type_idx" ON "plugin_migration_executions"("pluginVersionId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "disaster_recovery_plans_name_key" ON "disaster_recovery_plans"("name");

-- CreateIndex
CREATE INDEX "disaster_recovery_executions_planId_startedAt_idx" ON "disaster_recovery_executions"("planId", "startedAt");

-- AddForeignKey
ALTER TABLE "plugin_versions" ADD CONSTRAINT "plugin_versions_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_versions" ADD CONSTRAINT "plugin_versions_rollbackOf_fkey" FOREIGN KEY ("rollbackOf") REFERENCES "plugin_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_deployments" ADD CONSTRAINT "plugin_deployments_pluginVersionId_fkey" FOREIGN KEY ("pluginVersionId") REFERENCES "plugin_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_configurations" ADD CONSTRAINT "plugin_configurations_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_backups" ADD CONSTRAINT "plugin_backups_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_backups" ADD CONSTRAINT "plugin_backups_beforeVersionId_fkey" FOREIGN KEY ("beforeVersionId") REFERENCES "plugin_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_backups" ADD CONSTRAINT "plugin_backups_afterVersionId_fkey" FOREIGN KEY ("afterVersionId") REFERENCES "plugin_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restore_points" ADD CONSTRAINT "restore_points_backupId_fkey" FOREIGN KEY ("backupId") REFERENCES "plugin_backups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_migration_executions" ADD CONSTRAINT "plugin_migration_executions_pluginVersionId_fkey" FOREIGN KEY ("pluginVersionId") REFERENCES "plugin_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disaster_recovery_executions" ADD CONSTRAINT "disaster_recovery_executions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "disaster_recovery_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;