"""
Real-time Streaming Data Pipeline DAG
Integrates with Kafka and Flink for real-time data processing
"""

from datetime import datetime, timedelta
from typing import Dict, Any

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
from airflow.providers.postgres.operators.postgres import PostgresOperator
from airflow.sensors.filesystem import FileSensor
from airflow.models import Variable

# Default arguments
default_args = {
    'owner': 'streaming-team',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 5,
    'retry_delay': timedelta(minutes=2),
    'sla': timedelta(minutes=30),
}

# DAG for streaming pipeline management
dag = DAG(
    'streaming_pipeline_manager',
    default_args=default_args,
    description='Manage Flink streaming jobs and Kafka topics',
    schedule_interval=timedelta(minutes=15),
    catchup=False,
    max_active_runs=1,
    tags=['streaming', 'kafka', 'flink', 'real-time'],
)

def check_kafka_topics(**context) -> Dict[str, Any]:
    """Check Kafka topics and their status"""
    from kafka import KafkaConsumer, KafkaProducer
    from kafka.admin import KafkaAdminClient, NewTopic
    import json
    
    # Kafka configuration
    bootstrap_servers = Variable.get("kafka_bootstrap_servers", "localhost:9092")
    
    try:
        admin_client = KafkaAdminClient(
            bootstrap_servers=bootstrap_servers,
            client_id='streaming_pipeline_monitor'
        )
        
        # Get existing topics
        topics = admin_client.list_topics()
        
        required_topics = [
            'user_events',
            'transaction_events', 
            'system_metrics',
            'processed_events'
        ]
        
        topic_status = {}
        for topic in required_topics:
            if topic in topics:
                # Get topic metadata
                metadata = admin_client.describe_topics([topic])
                topic_status[topic] = {
                    'exists': True,
                    'partitions': len(metadata[topic].partitions),
                    'status': 'healthy'
                }
            else:
                topic_status[topic] = {
                    'exists': False,
                    'status': 'missing'
                }
        
        # Store status for downstream tasks
        context['task_instance'].xcom_push(key='topic_status', value=topic_status)
        
        return topic_status
        
    except Exception as e:
        raise Exception(f"Failed to check Kafka topics: {str(e)}")

def create_missing_topics(**context) -> None:
    """Create any missing Kafka topics"""
    from kafka.admin import KafkaAdminClient, NewTopic
    
    # Get topic status from previous task
    topic_status = context['task_instance'].xcom_pull(task_ids='check_kafka_topics', key='topic_status')
    
    bootstrap_servers = Variable.get("kafka_bootstrap_servers", "localhost:9092")
    admin_client = KafkaAdminClient(bootstrap_servers=bootstrap_servers)
    
    topics_to_create = []
    
    for topic_name, status in topic_status.items():
        if not status['exists']:
            topic_config = {
                'cleanup.policy': 'delete',
                'retention.ms': '604800000',  # 7 days
                'compression.type': 'gzip'
            }
            
            new_topic = NewTopic(
                name=topic_name,
                num_partitions=3,
                replication_factor=1,
                topic_configs=topic_config
            )
            topics_to_create.append(new_topic)
    
    if topics_to_create:
        admin_client.create_topics(topics_to_create)
        print(f"Created {len(topics_to_create)} topics")
    else:
        print("All required topics exist")

def submit_flink_job(**context) -> str:
    """Submit Flink streaming job"""
    import requests
    import json
    
    flink_jobmanager_url = Variable.get("flink_jobmanager_url", "http://localhost:8081")
    
    # Flink job configuration
    job_config = {
        "entryClass": "com.example.StreamingETL",
        "programArgs": [
            "--kafka.bootstrap.servers", Variable.get("kafka_bootstrap_servers", "localhost:9092"),
            "--input.topics", "user_events,transaction_events",
            "--output.topic", "processed_events",
            "--checkpoint.interval", "60000",
            "--parallelism", "4"
        ],
        "savepointPath": None,
        "allowNonRestoredState": True
    }
    
    # Submit job
    jar_id = Variable.get("streaming_job_jar_id")
    response = requests.post(
        f"{flink_jobmanager_url}/jars/{jar_id}/run",
        json=job_config,
        timeout=60
    )
    
    if response.status_code == 200:
        job_result = response.json()
        job_id = job_result['jobid']
        
        # Store job ID for monitoring
        context['task_instance'].xcom_push(key='flink_job_id', value=job_id)
        
        return job_id
    else:
        raise Exception(f"Failed to submit Flink job: {response.status_code} {response.text}")

def monitor_flink_job(**context) -> Dict[str, Any]:
    """Monitor Flink job health and metrics"""
    import requests
    import time
    
    flink_jobmanager_url = Variable.get("flink_jobmanager_url", "http://localhost:8081")
    job_id = context['task_instance'].xcom_pull(task_ids='submit_flink_job', key='flink_job_id')
    
    if not job_id:
        raise Exception("No Flink job ID found")
    
    # Get job status
    response = requests.get(f"{flink_jobmanager_url}/jobs/{job_id}")
    
    if response.status_code == 200:
        job_info = response.json()
        
        # Get job metrics
        metrics_response = requests.get(f"{flink_jobmanager_url}/jobs/{job_id}/metrics")
        metrics_data = metrics_response.json() if metrics_response.status_code == 200 else []
        
        job_status = {
            'job_id': job_id,
            'state': job_info.get('state'),
            'start_time': job_info.get('start-time'),
            'duration': job_info.get('duration'),
            'vertices': len(job_info.get('vertices', [])),
            'metrics': {metric['id']: metric.get('value', 0) for metric in metrics_data}
        }
        
        # Store metrics for alerting
        context['task_instance'].xcom_push(key='job_metrics', value=job_status)
        
        return job_status
    else:
        raise Exception(f"Failed to get job status: {response.status_code}")

def check_data_quality_streaming(**context) -> Dict[str, Any]:
    """Monitor streaming data quality"""
    from kafka import KafkaConsumer
    import json
    
    bootstrap_servers = Variable.get("kafka_bootstrap_servers", "localhost:9092")
    
    # Sample recent messages from processed events topic
    consumer = KafkaConsumer(
        'processed_events',
        bootstrap_servers=bootstrap_servers,
        auto_offset_reset='latest',
        enable_auto_commit=False,
        consumer_timeout_ms=30000,  # 30 seconds timeout
        value_deserializer=lambda m: json.loads(m.decode('utf-8'))
    )
    
    messages = []
    message_count = 0
    
    for message in consumer:
        messages.append(message.value)
        message_count += 1
        
        # Sample first 100 messages
        if message_count >= 100:
            break
    
    consumer.close()
    
    if not messages:
        print("No messages found in processed_events topic")
        return {'status': 'no_data', 'message_count': 0}
    
    # Quality checks
    null_count = sum(1 for msg in messages if any(v is None for v in msg.values()))
    schema_violations = sum(1 for msg in messages if not all(
        key in msg for key in ['user_id', 'event_type', 'timestamp', 'processed_at']
    ))
    
    quality_metrics = {
        'total_messages': len(messages),
        'null_values': null_count,
        'schema_violations': schema_violations,
        'quality_score': ((len(messages) - null_count - schema_violations) / len(messages)) * 100,
        'avg_processing_latency': sum(
            (datetime.fromisoformat(msg.get('processed_at', '1970-01-01T00:00:00')) - 
             datetime.fromisoformat(msg.get('timestamp', '1970-01-01T00:00:00'))).total_seconds()
            for msg in messages if msg.get('processed_at') and msg.get('timestamp')
        ) / len(messages) if messages else 0
    }
    
    # Store quality metrics
    context['task_instance'].xcom_push(key='quality_metrics', value=quality_metrics)
    
    return quality_metrics

def generate_streaming_alerts(**context) -> None:
    """Generate alerts based on streaming metrics"""
    
    # Get metrics from monitoring tasks
    job_metrics = context['task_instance'].xcom_pull(task_ids='monitor_flink_job', key='job_metrics')
    quality_metrics = context['task_instance'].xcom_pull(task_ids='check_data_quality', key='quality_metrics')
    
    alerts = []
    
    # Check Flink job health
    if job_metrics and job_metrics.get('state') != 'RUNNING':
        alerts.append({
            'type': 'job_failure',
            'severity': 'critical',
            'message': f"Flink job {job_metrics['job_id']} is in state: {job_metrics['state']}"
        })
    
    # Check backpressure
    if job_metrics and job_metrics.get('metrics', {}).get('backpressure', 0) > 0.8:
        alerts.append({
            'type': 'high_backpressure',
            'severity': 'high',
            'message': f"High backpressure detected: {job_metrics['metrics']['backpressure']}"
        })
    
    # Check data quality
    if quality_metrics and quality_metrics.get('quality_score', 100) < 95:
        alerts.append({
            'type': 'data_quality',
            'severity': 'medium',
            'message': f"Data quality score below threshold: {quality_metrics['quality_score']}%"
        })
    
    # Check processing latency
    if quality_metrics and quality_metrics.get('avg_processing_latency', 0) > 5:
        alerts.append({
            'type': 'high_latency',
            'severity': 'medium',
            'message': f"High processing latency: {quality_metrics['avg_processing_latency']:.2f} seconds"
        })
    
    if alerts:
        # Send alerts (in real implementation)
        for alert in alerts:
            print(f"ALERT [{alert['severity']}] {alert['type']}: {alert['message']}")
    else:
        print("All streaming metrics are healthy")

def create_checkpoint(**context) -> str:
    """Create a checkpoint for the Flink job"""
    import requests
    
    flink_jobmanager_url = Variable.get("flink_jobmanager_url", "http://localhost:8081")
    job_id = context['task_instance'].xcom_pull(task_ids='submit_flink_job', key='flink_job_id')
    
    checkpoint_dir = Variable.get("flink_checkpoint_dir", "/tmp/checkpoints")
    
    # Trigger savepoint
    response = requests.post(
        f"{flink_jobmanager_url}/jobs/{job_id}/savepoints",
        json={"target-directory": checkpoint_dir}
    )
    
    if response.status_code == 202:
        savepoint_info = response.json()
        request_id = savepoint_info['request-id']
        
        # Poll for completion
        import time
        for _ in range(60):  # Wait up to 5 minutes
            status_response = requests.get(
                f"{flink_jobmanager_url}/jobs/{job_id}/savepoints/{request_id}"
            )
            
            if status_response.status_code == 200:
                status_data = status_response.json()
                if status_data['status']['id'] == 'COMPLETED':
                    savepoint_path = status_data['operation']['location']
                    print(f"Checkpoint created: {savepoint_path}")
                    return savepoint_path
                elif status_data['status']['id'] == 'FAILED':
                    raise Exception(f"Checkpoint failed: {status_data['operation']['failure-cause']}")
            
            time.sleep(5)
        
        raise Exception("Checkpoint creation timeout")
    else:
        raise Exception(f"Failed to create checkpoint: {response.status_code}")

# Task definitions

# Check Kafka infrastructure
kafka_check = PythonOperator(
    task_id='check_kafka_topics',
    python_callable=check_kafka_topics,
    dag=dag,
)

# Create missing topics
create_topics = PythonOperator(
    task_id='create_missing_topics',
    python_callable=create_missing_topics,
    dag=dag,
)

# Submit Flink streaming job
submit_job = PythonOperator(
    task_id='submit_flink_job',
    python_callable=submit_flink_job,
    dag=dag,
)

# Monitor job health
monitor_job = PythonOperator(
    task_id='monitor_flink_job',
    python_callable=monitor_flink_job,
    dag=dag,
)

# Check streaming data quality
quality_check = PythonOperator(
    task_id='check_data_quality',
    python_callable=check_data_quality_streaming,
    dag=dag,
)

# Generate alerts
alerting = PythonOperator(
    task_id='generate_alerts',
    python_callable=generate_streaming_alerts,
    dag=dag,
)

# Create checkpoint
checkpoint = PythonOperator(
    task_id='create_checkpoint',
    python_callable=create_checkpoint,
    dag=dag,
)

# Update streaming metrics in database
update_metrics = PostgresOperator(
    task_id='update_streaming_metrics',
    postgres_conn_id='warehouse_postgres',
    sql="""
    INSERT INTO streaming_metrics (
        pipeline_id,
        job_id,
        execution_date,
        messages_processed,
        quality_score,
        processing_latency,
        backpressure,
        created_at
    ) VALUES (
        'streaming_pipeline_manager',
        '{{ ti.xcom_pull(task_ids='submit_flink_job', key='flink_job_id') }}',
        '{{ execution_date }}',
        {{ ti.xcom_pull(task_ids='check_data_quality', key='quality_metrics')['total_messages'] or 0 }},
        {{ ti.xcom_pull(task_ids='check_data_quality', key='quality_metrics')['quality_score'] or 0 }},
        {{ ti.xcom_pull(task_ids='check_data_quality', key='quality_metrics')['avg_processing_latency'] or 0 }},
        COALESCE({{ ti.xcom_pull(task_ids='monitor_flink_job', key='job_metrics')['metrics']['backpressure'] or 'NULL' }}, 0),
        CURRENT_TIMESTAMP
    );
    """,
    dag=dag,
)

# Define task dependencies
kafka_check >> create_topics
create_topics >> submit_job
submit_job >> [monitor_job, quality_check]
[monitor_job, quality_check] >> alerting
alerting >> checkpoint
checkpoint >> update_metrics

# Add sensor for external trigger
from airflow.sensors.s3_key_sensor import S3KeySensor

# Example: trigger pipeline when new data arrives
data_arrival_sensor = S3KeySensor(
    task_id='wait_for_new_data',
    bucket_name='streaming-data-bucket',
    bucket_key='raw-data/{{ ds }}/data.json',
    wildcard_match=True,
    timeout=300,
    poke_interval=30,
    dag=dag,
)

# Connect sensor to main pipeline
data_arrival_sensor >> kafka_check