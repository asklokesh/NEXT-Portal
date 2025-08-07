#!/bin/bash

# Kafka Initialization Script
# Creates required topics and configurations

set -e

KAFKA_BOOTSTRAP_SERVERS="localhost:9092,localhost:9093,localhost:9094"

echo "Waiting for Kafka to be ready..."
sleep 10

echo "Creating Kafka topics..."

# Create event topics
docker exec backstage-kafka1 kafka-topics --create \
  --bootstrap-server kafka1:29092 \
  --topic backstage.events \
  --partitions 10 \
  --replication-factor 3 \
  --config retention.ms=604800000 \
  --config compression.type=gzip \
  --config max.message.bytes=1048576 \
  --if-not-exists

# Create command topic
docker exec backstage-kafka1 kafka-topics --create \
  --bootstrap-server kafka1:29092 \
  --topic backstage.commands \
  --partitions 5 \
  --replication-factor 3 \
  --config retention.ms=86400000 \
  --config compression.type=gzip \
  --if-not-exists

# Create query topic
docker exec backstage-kafka1 kafka-topics --create \
  --bootstrap-server kafka1:29092 \
  --topic backstage.queries \
  --partitions 5 \
  --replication-factor 3 \
  --config retention.ms=86400000 \
  --config compression.type=gzip \
  --if-not-exists

# Create audit topic with compaction
docker exec backstage-kafka1 kafka-topics --create \
  --bootstrap-server kafka1:29092 \
  --topic backstage.audit \
  --partitions 3 \
  --replication-factor 3 \
  --config retention.ms=2592000000 \
  --config compression.type=gzip \
  --config cleanup.policy=compact \
  --if-not-exists

# Create dead letter queue
docker exec backstage-kafka1 kafka-topics --create \
  --bootstrap-server kafka1:29092 \
  --topic backstage.dlq \
  --partitions 3 \
  --replication-factor 3 \
  --config retention.ms=604800000 \
  --config compression.type=gzip \
  --if-not-exists

# Create saga topic
docker exec backstage-kafka1 kafka-topics --create \
  --bootstrap-server kafka1:29092 \
  --topic backstage.saga \
  --partitions 5 \
  --replication-factor 3 \
  --config retention.ms=172800000 \
  --config compression.type=gzip \
  --if-not-exists

# Create catalog entity topics
docker exec backstage-kafka1 kafka-topics --create \
  --bootstrap-server kafka1:29092 \
  --topic catalog.entities \
  --partitions 10 \
  --replication-factor 3 \
  --config retention.ms=604800000 \
  --config compression.type=gzip \
  --if-not-exists

# Create plugin management topics
docker exec backstage-kafka1 kafka-topics --create \
  --bootstrap-server kafka1:29092 \
  --topic plugins.lifecycle \
  --partitions 5 \
  --replication-factor 3 \
  --config retention.ms=604800000 \
  --config compression.type=gzip \
  --if-not-exists

# Create template execution topics
docker exec backstage-kafka1 kafka-topics --create \
  --bootstrap-server kafka1:29092 \
  --topic templates.executions \
  --partitions 5 \
  --replication-factor 3 \
  --config retention.ms=604800000 \
  --config compression.type=gzip \
  --if-not-exists

# Create monitoring topics
docker exec backstage-kafka1 kafka-topics --create \
  --bootstrap-server kafka1:29092 \
  --topic monitoring.metrics \
  --partitions 3 \
  --replication-factor 3 \
  --config retention.ms=86400000 \
  --config compression.type=gzip \
  --if-not-exists

echo "Topics created successfully!"

# List all topics
echo "\nListing all topics:"
docker exec backstage-kafka1 kafka-topics --list --bootstrap-server kafka1:29092

echo "\nKafka initialization complete!"