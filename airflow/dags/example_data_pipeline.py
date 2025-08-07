"""
Example Data Pipeline DAG for Backstage Data Pipeline System
"""

from datetime import datetime, timedelta
from typing import Dict, Any

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
from airflow.providers.postgres.operators.postgres import PostgresOperator
from airflow.providers.http.sensors.http import HttpSensor
from airflow.providers.postgres.hooks.postgres import PostgresHook
from airflow.models import Variable

# Default arguments for the DAG
default_args = {
    'owner': 'data-platform-team',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 3,
    'retry_delay': timedelta(minutes=5),
    'sla': timedelta(hours=2),
}

# DAG definition
dag = DAG(
    'example_data_pipeline',
    default_args=default_args,
    description='Example data pipeline demonstrating ETL patterns',
    schedule_interval='@daily',
    catchup=False,
    max_active_runs=1,
    tags=['etl', 'example', 'postgres', 'python'],
)

def extract_from_api(**context) -> Dict[str, Any]:
    """Extract data from external API"""
    import requests
    import json
    
    # Mock API call
    api_url = Variable.get("source_api_url", "https://api.example.com/data")
    
    try:
        response = requests.get(api_url, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        # Store extracted data count for monitoring
        context['task_instance'].xcom_push(key='extracted_count', value=len(data))
        
        # Transform data for loading
        transformed_data = []
        for record in data:
            transformed_record = {
                'id': record.get('id'),
                'name': record.get('name', '').strip(),
                'value': float(record.get('value', 0)),
                'created_at': datetime.now(),
                'source': 'api_extract'
            }
            transformed_data.append(transformed_record)
        
        return transformed_data
        
    except requests.RequestException as e:
        raise Exception(f"Failed to extract data from API: {str(e)}")

def validate_data_quality(**context) -> bool:
    """Run data quality checks"""
    
    # Get data from previous task
    extracted_data = context['task_instance'].xcom_pull(task_ids='extract_data')
    
    if not extracted_data:
        raise ValueError("No data received from extraction task")
    
    # Quality checks
    checks = {
        'row_count': len(extracted_data) > 0,
        'null_check': all(record.get('id') is not None for record in extracted_data),
        'value_range': all(0 <= record.get('value', 0) <= 1000000 for record in extracted_data),
        'name_length': all(len(record.get('name', '')) <= 100 for record in extracted_data)
    }
    
    failed_checks = [check for check, passed in checks.items() if not passed]
    
    if failed_checks:
        raise ValueError(f"Data quality checks failed: {', '.join(failed_checks)}")
    
    # Log successful validation
    context['task_instance'].xcom_push(key='quality_checks_passed', value=len(checks))
    
    return True

def transform_data(**context) -> Dict[str, Any]:
    """Transform data according to business rules"""
    
    # Get data from extraction task
    extracted_data = context['task_instance'].xcom_pull(task_ids='extract_data')
    
    transformed_records = []
    
    for record in extracted_data:
        # Apply business transformations
        transformed_record = {
            'id': record['id'],
            'name': record['name'].upper(),  # Standardize to uppercase
            'value': round(record['value'] * 1.1, 2),  # Apply 10% markup
            'category': 'HIGH' if record['value'] > 500 else 'NORMAL',
            'processed_at': datetime.now(),
            'pipeline_run_id': context['run_id']
        }
        transformed_records.append(transformed_record)
    
    # Store transformation metrics
    context['task_instance'].xcom_push(key='transformed_count', value=len(transformed_records))
    
    return transformed_records

def load_to_warehouse(**context) -> None:
    """Load transformed data to data warehouse"""
    
    # Get transformed data
    transformed_data = context['task_instance'].xcom_pull(task_ids='transform_data')
    
    if not transformed_data:
        raise ValueError("No transformed data to load")
    
    # Connect to PostgreSQL
    postgres_hook = PostgresHook(postgres_conn_id='warehouse_postgres')
    
    # Prepare batch insert
    insert_sql = """
        INSERT INTO processed_data (id, name, value, category, processed_at, pipeline_run_id)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            value = EXCLUDED.value,
            category = EXCLUDED.category,
            processed_at = EXCLUDED.processed_at,
            pipeline_run_id = EXCLUDED.pipeline_run_id
    """
    
    # Prepare data for insertion
    insert_data = [
        (
            record['id'],
            record['name'],
            record['value'],
            record['category'],
            record['processed_at'],
            record['pipeline_run_id']
        )
        for record in transformed_data
    ]
    
    # Execute batch insert
    postgres_hook.insert_rows(
        table='processed_data',
        rows=insert_data,
        target_fields=['id', 'name', 'value', 'category', 'processed_at', 'pipeline_run_id'],
        replace=True
    )
    
    # Store load metrics
    context['task_instance'].xcom_push(key='loaded_count', value=len(insert_data))

def generate_data_lineage(**context) -> None:
    """Generate and store data lineage information"""
    
    lineage_info = {
        'pipeline_id': 'example_data_pipeline',
        'run_id': context['run_id'],
        'execution_date': context['execution_date'].isoformat(),
        'sources': [
            {
                'type': 'api',
                'name': 'external_data_api',
                'location': Variable.get("source_api_url", "https://api.example.com/data")
            }
        ],
        'destinations': [
            {
                'type': 'database',
                'name': 'warehouse_postgres',
                'table': 'processed_data'
            }
        ],
        'transformations': [
            {
                'step': 'extract_data',
                'type': 'api_extraction',
                'description': 'Extract data from external API'
            },
            {
                'step': 'validate_data_quality',
                'type': 'quality_validation',
                'description': 'Validate data quality and completeness'
            },
            {
                'step': 'transform_data',
                'type': 'business_transformation',
                'description': 'Apply business rules and transformations'
            }
        ],
        'metrics': {
            'extracted_count': context['task_instance'].xcom_pull(task_ids='extract_data', key='extracted_count'),
            'transformed_count': context['task_instance'].xcom_pull(task_ids='transform_data', key='transformed_count'),
            'loaded_count': context['task_instance'].xcom_pull(task_ids='load_data', key='loaded_count')
        }
    }
    
    # Store lineage information (in real implementation, send to lineage system)
    print(f"Data Lineage: {lineage_info}")

def send_completion_notification(**context) -> None:
    """Send pipeline completion notification"""
    
    # Gather metrics from all tasks
    extracted_count = context['task_instance'].xcom_pull(task_ids='extract_data', key='extracted_count')
    transformed_count = context['task_instance'].xcom_pull(task_ids='transform_data', key='transformed_count')
    loaded_count = context['task_instance'].xcom_pull(task_ids='load_data', key='loaded_count')
    
    notification_message = f"""
    Data Pipeline Completed Successfully
    
    Pipeline: example_data_pipeline
    Run ID: {context['run_id']}
    Execution Date: {context['execution_date']}
    
    Metrics:
    - Records Extracted: {extracted_count}
    - Records Transformed: {transformed_count}
    - Records Loaded: {loaded_count}
    
    Duration: {datetime.now() - context['execution_date']}
    """
    
    # In real implementation, send to notification service
    print(notification_message)

# Task definitions

# Check if source API is available
api_sensor = HttpSensor(
    task_id='check_api_availability',
    http_conn_id='source_api',
    endpoint='health',
    timeout=60,
    poke_interval=10,
    dag=dag,
)

# Create target table if it doesn't exist
create_table = PostgresOperator(
    task_id='create_target_table',
    postgres_conn_id='warehouse_postgres',
    sql="""
    CREATE TABLE IF NOT EXISTS processed_data (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        value DECIMAL(10,2) NOT NULL,
        category VARCHAR(20) NOT NULL,
        processed_at TIMESTAMP NOT NULL,
        pipeline_run_id VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_processed_data_category ON processed_data(category);
    CREATE INDEX IF NOT EXISTS idx_processed_data_processed_at ON processed_data(processed_at);
    """,
    dag=dag,
)

# Extract data from source
extract_task = PythonOperator(
    task_id='extract_data',
    python_callable=extract_from_api,
    dag=dag,
)

# Validate data quality
quality_check = PythonOperator(
    task_id='validate_data_quality',
    python_callable=validate_data_quality,
    dag=dag,
)

# Transform data
transform_task = PythonOperator(
    task_id='transform_data',
    python_callable=transform_data,
    dag=dag,
)

# Load to warehouse
load_task = PythonOperator(
    task_id='load_data',
    python_callable=load_to_warehouse,
    dag=dag,
)

# Generate lineage
lineage_task = PythonOperator(
    task_id='generate_lineage',
    python_callable=generate_data_lineage,
    dag=dag,
)

# Data quality report
quality_report = PostgresOperator(
    task_id='generate_quality_report',
    postgres_conn_id='warehouse_postgres',
    sql="""
    INSERT INTO data_quality_reports (
        pipeline_id,
        run_id,
        execution_date,
        total_records,
        quality_score,
        report_data,
        created_at
    )
    SELECT 
        'example_data_pipeline' as pipeline_id,
        '{{ run_id }}' as run_id,
        '{{ execution_date }}' as execution_date,
        COUNT(*) as total_records,
        CASE 
            WHEN COUNT(CASE WHEN value > 0 AND name != '' THEN 1 END) = COUNT(*) THEN 100.0
            ELSE (COUNT(CASE WHEN value > 0 AND name != '' THEN 1 END) * 100.0 / COUNT(*))
        END as quality_score,
        jsonb_build_object(
            'categories', jsonb_agg(DISTINCT category),
            'avg_value', AVG(value),
            'max_value', MAX(value),
            'min_value', MIN(value)
        ) as report_data,
        CURRENT_TIMESTAMP as created_at
    FROM processed_data
    WHERE pipeline_run_id = '{{ run_id }}';
    """,
    dag=dag,
)

# Send notification
notification_task = PythonOperator(
    task_id='send_notification',
    python_callable=send_completion_notification,
    dag=dag,
)

# Cleanup old data (retention policy)
cleanup_task = PostgresOperator(
    task_id='cleanup_old_data',
    postgres_conn_id='warehouse_postgres',
    sql="""
    DELETE FROM processed_data 
    WHERE created_at < CURRENT_DATE - INTERVAL '90 days';
    
    DELETE FROM data_quality_reports 
    WHERE created_at < CURRENT_DATE - INTERVAL '30 days';
    """,
    dag=dag,
)

# Define task dependencies
api_sensor >> create_table
create_table >> extract_task
extract_task >> quality_check
quality_check >> transform_task
transform_task >> load_task
load_task >> [lineage_task, quality_report]
[lineage_task, quality_report] >> notification_task
notification_task >> cleanup_task

# Task group example for related operations
from airflow.utils.task_group import TaskGroup

with TaskGroup("data_validation", dag=dag) as validation_group:
    schema_validation = PythonOperator(
        task_id='validate_schema',
        python_callable=lambda **context: print("Schema validation passed"),
    )
    
    business_rules_validation = PythonOperator(
        task_id='validate_business_rules',
        python_callable=lambda **context: print("Business rules validation passed"),
    )
    
    schema_validation >> business_rules_validation

# Insert validation group into main pipeline
quality_check >> validation_group >> transform_task