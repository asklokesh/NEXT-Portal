-- ============================================
-- PERFORMANCE BENCHMARKS AND MONITORING
-- Database Performance Monitoring and SLA Tracking
-- ============================================

-- ============================================
-- PERFORMANCE BASELINE METRICS
-- ============================================

-- Create performance benchmarks table
CREATE TABLE IF NOT EXISTS performance_benchmarks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    benchmark_name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL, -- 'query', 'transaction', 'index', 'cache'
    description TEXT,
    target_value FLOAT NOT NULL,
    warning_threshold FLOAT NOT NULL,
    critical_threshold FLOAT NOT NULL,
    unit TEXT NOT NULL, -- 'ms', 'ops/sec', 'mb', 'percent'
    measurement_query TEXT,
    measurement_frequency TEXT DEFAULT '5m', -- How often to measure
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert baseline performance benchmarks
INSERT INTO performance_benchmarks (benchmark_name, category, description, target_value, warning_threshold, critical_threshold, unit, measurement_query) VALUES
-- Query Performance Benchmarks
('plugin_search_query', 'query', 'Plugin search query performance', 50, 100, 200, 'ms', 
 'SELECT COUNT(*) FROM plugins WHERE name ILIKE ''%kubernetes%'''),

('plugin_analytics_aggregation', 'query', 'Analytics aggregation query performance', 100, 250, 500, 'ms',
 'SELECT plugin_id, COUNT(*), AVG(duration) FROM plugin_analytics WHERE timestamp >= NOW() - INTERVAL ''24 hours'' GROUP BY plugin_id'),

('plugin_dependency_graph', 'query', 'Plugin dependency graph traversal', 75, 150, 300, 'ms',
 'WITH RECURSIVE deps AS (SELECT plugin_id, depends_on_id, 1 as level FROM plugin_dependencies WHERE plugin_id = ''test-plugin'' UNION ALL SELECT pd.plugin_id, pd.depends_on_id, d.level + 1 FROM plugin_dependencies pd JOIN deps d ON pd.plugin_id = d.depends_on_id WHERE d.level < 5) SELECT * FROM deps'),

('user_plugin_permissions', 'query', 'User plugin permissions check', 25, 50, 100, 'ms',
 'SELECT p.* FROM plugins p WHERE EXISTS (SELECT 1 FROM permissions perm JOIN team_members tm ON perm.team_id = tm.team_id WHERE tm.user_id = ''test-user'' AND perm.resource = ''plugin'')'),

-- Transaction Performance Benchmarks
('plugin_installation', 'transaction', 'Plugin installation transaction', 200, 500, 1000, 'ms',
 'BEGIN; INSERT INTO plugin_deployments (plugin_version_id, environment, status, deployed_by) VALUES (''test-version'', ''test'', ''PENDING'', ''test-user''); UPDATE plugin_versions SET is_deployed = true WHERE id = ''test-version''; COMMIT;'),

('approval_workflow', 'transaction', 'Approval workflow transaction', 100, 250, 500, 'ms',
 'BEGIN; INSERT INTO plugin_approvals (governance_id, request_type, requested_by) VALUES (''test-governance'', ''INSTALL'', ''test-user''); UPDATE plugin_governance SET updated_at = NOW() WHERE id = ''test-governance''; COMMIT;'),

-- Index Performance Benchmarks
('plugin_search_index_usage', 'index', 'Plugin search index utilization', 95, 80, 60, 'percent',
 'SELECT (idx_scan::float / NULLIF(seq_scan + idx_scan, 0) * 100) as index_usage FROM pg_stat_user_tables WHERE relname = ''plugins'''),

('analytics_index_hit_rate', 'index', 'Analytics index hit rate', 98, 90, 80, 'percent',
 'SELECT (idx_blks_hit::float / NULLIF(idx_blks_hit + idx_blks_read, 0) * 100) as hit_rate FROM pg_statio_user_indexes WHERE indexrelname LIKE ''idx_plugin_analytics%'''),

-- Cache Performance Benchmarks
('redis_hit_rate', 'cache', 'Redis cache hit rate', 95, 85, 70, 'percent', 
 'SELECT 95.0'), -- This would be measured from Redis metrics

('query_cache_effectiveness', 'cache', 'Query result cache effectiveness', 90, 75, 60, 'percent',
 'SELECT 90.0'); -- This would be measured from application metrics

-- ============================================
-- PERFORMANCE MONITORING VIEWS
-- ============================================

-- Real-time query performance view
CREATE OR REPLACE VIEW performance.query_performance AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    stddev_time,
    min_time,
    max_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
WHERE calls > 10
ORDER BY mean_time DESC
LIMIT 50;

-- Table performance overview
CREATE OR REPLACE VIEW performance.table_performance AS
SELECT 
    schemaname,
    tablename,
    n_tup_ins AS inserts,
    n_tup_upd AS updates,
    n_tup_del AS deletes,
    n_tup_hot_upd AS hot_updates,
    n_live_tup AS live_tuples,
    n_dead_tup AS dead_tuples,
    CASE WHEN n_live_tup > 0 
         THEN round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2) 
         ELSE 0 
    END AS dead_tuple_percent,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze,
    vacuum_count,
    autovacuum_count,
    analyze_count,
    autoanalyze_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND (tablename LIKE 'plugin%' OR tablename IN ('users', 'organizations', 'teams'))
ORDER BY dead_tuple_percent DESC, n_live_tup DESC;

-- Index utilization view
CREATE OR REPLACE VIEW performance.index_utilization AS
SELECT 
    t.schemaname,
    t.tablename,
    indexname,
    c.reltuples::bigint AS num_rows,
    pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
    pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
    CASE WHEN i.idx_scan > 0 THEN 'Used' ELSE 'Unused' END AS usage_status,
    i.idx_scan AS index_scans,
    i.idx_tup_read AS tuples_read,
    i.idx_tup_fetch AS tuples_fetched,
    CASE WHEN i.idx_scan > 0 
         THEN round(i.idx_tup_fetch::numeric / i.idx_scan, 2) 
         ELSE 0 
    END AS avg_tuples_per_scan
FROM pg_stat_user_indexes i
JOIN pg_stat_user_tables t ON i.relid = t.relid
JOIN pg_class c ON c.oid = i.relid
WHERE t.schemaname = 'public'
  AND (t.tablename LIKE 'plugin%' OR t.tablename IN ('users', 'organizations', 'teams'))
ORDER BY i.idx_scan DESC, pg_relation_size(i.indexrelid) DESC;

-- Connection and activity monitoring
CREATE OR REPLACE VIEW performance.connection_activity AS
SELECT 
    datname AS database,
    state,
    COUNT(*) AS connection_count,
    MAX(EXTRACT(EPOCH FROM (NOW() - query_start))) AS longest_query_seconds,
    MAX(EXTRACT(EPOCH FROM (NOW() - state_change))) AS longest_idle_seconds
FROM pg_stat_activity 
WHERE datname IS NOT NULL
GROUP BY datname, state
ORDER BY connection_count DESC;

-- Lock monitoring view
CREATE OR REPLACE VIEW performance.lock_monitoring AS
SELECT 
    pl.locktype,
    pl.database,
    pl.relation::regclass AS relation,
    pl.mode,
    pl.granted,
    pa.query_start,
    pa.query,
    pa.state,
    pa.application_name,
    EXTRACT(EPOCH FROM (NOW() - pa.query_start)) AS duration_seconds
FROM pg_locks pl
JOIN pg_stat_activity pa ON pl.pid = pa.pid
WHERE NOT pl.granted
  OR EXTRACT(EPOCH FROM (NOW() - pa.query_start)) > 30
ORDER BY pa.query_start;

-- ============================================
-- PERFORMANCE MEASUREMENT FUNCTIONS
-- ============================================

-- Function to measure query performance
CREATE OR REPLACE FUNCTION performance.measure_query_performance(
    query_name TEXT,
    test_query TEXT,
    iterations INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    execution_times FLOAT[] := '{}';
    avg_time FLOAT;
    min_time FLOAT;
    max_time FLOAT;
    stddev_time FLOAT;
    i INTEGER;
BEGIN
    -- Warm up the cache
    EXECUTE test_query;
    
    -- Run the test multiple times
    FOR i IN 1..iterations LOOP
        start_time := clock_timestamp();
        EXECUTE test_query;
        end_time := clock_timestamp();
        
        execution_times := array_append(
            execution_times, 
            EXTRACT(MILLISECONDS FROM (end_time - start_time))
        );
    END LOOP;
    
    -- Calculate statistics
    SELECT 
        AVG(unnest), 
        MIN(unnest), 
        MAX(unnest),
        STDDEV(unnest)
    INTO avg_time, min_time, max_time, stddev_time
    FROM unnest(execution_times);
    
    -- Return results
    RETURN jsonb_build_object(
        'query_name', query_name,
        'iterations', iterations,
        'avg_time_ms', round(avg_time, 2),
        'min_time_ms', round(min_time, 2),
        'max_time_ms', round(max_time, 2),
        'stddev_ms', round(stddev_time, 2),
        'all_times', execution_times,
        'measured_at', NOW()
    );
END;
$$;

-- Function to run all benchmarks
CREATE OR REPLACE FUNCTION performance.run_all_benchmarks()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    benchmark_record RECORD;
    results JSONB := '{}';
    measurement_result JSONB;
BEGIN
    FOR benchmark_record IN 
        SELECT * FROM performance_benchmarks WHERE is_active = true
    LOOP
        IF benchmark_record.measurement_query IS NOT NULL THEN
            measurement_result := performance.measure_query_performance(
                benchmark_record.benchmark_name,
                benchmark_record.measurement_query,
                5
            );
            
            results := jsonb_set(
                results, 
                ARRAY[benchmark_record.benchmark_name], 
                measurement_result
            );
        END IF;
    END LOOP;
    
    -- Add system metrics
    results := jsonb_set(results, '{system_metrics}', jsonb_build_object(
        'database_size', (SELECT pg_size_pretty(pg_database_size(current_database()))),
        'active_connections', (SELECT count(*) FROM pg_stat_activity WHERE state = 'active'),
        'cache_hit_ratio', (
            SELECT round(
                100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read) + 1), 2
            )
            FROM pg_stat_database WHERE datname = current_database()
        )
    ));
    
    return results;
END;
$$;

-- Function to check SLA compliance
CREATE OR REPLACE FUNCTION performance.check_sla_compliance()
RETURNS TABLE (
    benchmark_name TEXT,
    current_value FLOAT,
    target_value FLOAT,
    warning_threshold FLOAT,
    critical_threshold FLOAT,
    status TEXT,
    deviation_percent FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    benchmark_results JSONB;
BEGIN
    -- Run benchmarks
    benchmark_results := performance.run_all_benchmarks();
    
    -- Compare against thresholds
    RETURN QUERY
    SELECT 
        pb.benchmark_name::TEXT,
        (benchmark_results->pb.benchmark_name->>'avg_time_ms')::FLOAT as current_value,
        pb.target_value,
        pb.warning_threshold,
        pb.critical_threshold,
        CASE 
            WHEN (benchmark_results->pb.benchmark_name->>'avg_time_ms')::FLOAT <= pb.target_value THEN 'OK'
            WHEN (benchmark_results->pb.benchmark_name->>'avg_time_ms')::FLOAT <= pb.warning_threshold THEN 'WARNING'
            WHEN (benchmark_results->pb.benchmark_name->>'avg_time_ms')::FLOAT <= pb.critical_threshold THEN 'CRITICAL'
            ELSE 'SEVERE'
        END::TEXT as status,
        ROUND(
            (((benchmark_results->pb.benchmark_name->>'avg_time_ms')::FLOAT - pb.target_value) / pb.target_value) * 100,
            2
        ) as deviation_percent
    FROM performance_benchmarks pb
    WHERE pb.is_active = true
      AND benchmark_results ? pb.benchmark_name;
END;
$$;

-- ============================================
-- AUTOMATED PERFORMANCE MONITORING
-- ============================================

-- Table to store performance measurements over time
CREATE TABLE IF NOT EXISTS performance_measurements (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    benchmark_name TEXT NOT NULL,
    measured_value FLOAT NOT NULL,
    unit TEXT NOT NULL,
    status TEXT NOT NULL, -- 'OK', 'WARNING', 'CRITICAL', 'SEVERE'
    metadata JSONB,
    measured_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (benchmark_name) REFERENCES performance_benchmarks(benchmark_name)
);

-- Create indexes for performance measurements
CREATE INDEX IF NOT EXISTS idx_performance_measurements_benchmark_time 
ON performance_measurements(benchmark_name, measured_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_measurements_status_time 
ON performance_measurements(status, measured_at DESC) 
WHERE status IN ('WARNING', 'CRITICAL', 'SEVERE');

-- Function to record performance measurement
CREATE OR REPLACE FUNCTION performance.record_measurement(
    p_benchmark_name TEXT,
    p_measured_value FLOAT,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    benchmark_info RECORD;
    measurement_status TEXT;
BEGIN
    -- Get benchmark thresholds
    SELECT * INTO benchmark_info
    FROM performance_benchmarks
    WHERE benchmark_name = p_benchmark_name;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Benchmark % not found', p_benchmark_name;
    END IF;
    
    -- Determine status based on thresholds
    measurement_status := CASE 
        WHEN p_measured_value <= benchmark_info.target_value THEN 'OK'
        WHEN p_measured_value <= benchmark_info.warning_threshold THEN 'WARNING'
        WHEN p_measured_value <= benchmark_info.critical_threshold THEN 'CRITICAL'
        ELSE 'SEVERE'
    END;
    
    -- Record measurement
    INSERT INTO performance_measurements (
        benchmark_name, measured_value, unit, status, metadata
    ) VALUES (
        p_benchmark_name, p_measured_value, benchmark_info.unit, measurement_status, p_metadata
    );
    
    -- Create alert if performance degrades
    IF measurement_status IN ('WARNING', 'CRITICAL', 'SEVERE') THEN
        INSERT INTO plugin_alerts (
            plugin_id, alert_type, severity, title, message, 
            current_value, threshold, details
        ) VALUES (
            'system',
            'PERFORMANCE_ISSUE',
            CASE measurement_status
                WHEN 'WARNING' THEN 'WARNING'
                WHEN 'CRITICAL' THEN 'CRITICAL'
                ELSE 'CRITICAL'
            END,
            format('Performance degradation in %s', p_benchmark_name),
            format('%s performance is %s (target: %s, current: %s%s)', 
                   p_benchmark_name, measurement_status, 
                   benchmark_info.target_value, p_measured_value, benchmark_info.unit),
            p_measured_value,
            benchmark_info.target_value,
            jsonb_build_object(
                'benchmark_name', p_benchmark_name,
                'measurement_metadata', p_metadata
            )
        );
    END IF;
END;
$$;

-- ============================================
-- PERFORMANCE TRENDING AND ANALYSIS
-- ============================================

-- Function to get performance trends
CREATE OR REPLACE FUNCTION performance.get_performance_trends(
    p_benchmark_name TEXT,
    p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
    hour_bucket TIMESTAMP,
    avg_value FLOAT,
    min_value FLOAT,
    max_value FLOAT,
    measurement_count BIGINT,
    status_distribution JSONB
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        date_trunc('hour', measured_at) AS hour_bucket,
        AVG(measured_value) AS avg_value,
        MIN(measured_value) AS min_value,
        MAX(measured_value) AS max_value,
        COUNT(*) AS measurement_count,
        jsonb_object_agg(status, status_count) AS status_distribution
    FROM (
        SELECT 
            measured_at,
            measured_value,
            status,
            COUNT(*) OVER (PARTITION BY date_trunc('hour', measured_at), status) AS status_count
        FROM performance_measurements
        WHERE benchmark_name = p_benchmark_name
          AND measured_at >= NOW() - (p_hours || ' hours')::INTERVAL
    ) subq
    GROUP BY date_trunc('hour', measured_at)
    ORDER BY hour_bucket DESC;
$$;

-- Function to detect performance anomalies
CREATE OR REPLACE FUNCTION performance.detect_anomalies(
    p_benchmark_name TEXT,
    p_hours INTEGER DEFAULT 24,
    p_sensitivity FLOAT DEFAULT 2.0 -- Standard deviations for anomaly detection
)
RETURNS TABLE (
    measured_at TIMESTAMP,
    measured_value FLOAT,
    expected_range_min FLOAT,
    expected_range_max FLOAT,
    anomaly_score FLOAT,
    anomaly_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    baseline_avg FLOAT;
    baseline_stddev FLOAT;
BEGIN
    -- Calculate baseline statistics (last 7 days, excluding current period)
    SELECT AVG(measured_value), STDDEV(measured_value)
    INTO baseline_avg, baseline_stddev
    FROM performance_measurements
    WHERE benchmark_name = p_benchmark_name
      AND measured_at >= NOW() - INTERVAL '7 days'
      AND measured_at < NOW() - (p_hours || ' hours')::INTERVAL;
    
    -- Return anomalies in the specified time period
    RETURN QUERY
    SELECT 
        pm.measured_at,
        pm.measured_value,
        (baseline_avg - (p_sensitivity * baseline_stddev)) AS expected_range_min,
        (baseline_avg + (p_sensitivity * baseline_stddev)) AS expected_range_max,
        ABS(pm.measured_value - baseline_avg) / NULLIF(baseline_stddev, 0) AS anomaly_score,
        CASE 
            WHEN pm.measured_value > (baseline_avg + (p_sensitivity * baseline_stddev)) THEN 'HIGH'
            WHEN pm.measured_value < (baseline_avg - (p_sensitivity * baseline_stddev)) THEN 'LOW'
            ELSE 'NORMAL'
        END AS anomaly_type
    FROM performance_measurements pm
    WHERE pm.benchmark_name = p_benchmark_name
      AND pm.measured_at >= NOW() - (p_hours || ' hours')::INTERVAL
      AND (
          pm.measured_value > (baseline_avg + (p_sensitivity * baseline_stddev)) OR
          pm.measured_value < (baseline_avg - (p_sensitivity * baseline_stddev))
      )
    ORDER BY pm.measured_at DESC;
END;
$$;

-- ============================================
-- AUTOMATED MAINTENANCE RECOMMENDATIONS
-- ============================================

-- Function to generate maintenance recommendations
CREATE OR REPLACE FUNCTION performance.maintenance_recommendations()
RETURNS TABLE (
    category TEXT,
    recommendation TEXT,
    priority TEXT,
    impact TEXT,
    effort TEXT,
    sql_command TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Index recommendations
    RETURN QUERY
    SELECT 
        'INDEX'::TEXT,
        format('Consider adding index on %s.%s (table scanned %s times)', 
               schemaname, tablename, seq_scan)::TEXT,
        CASE WHEN seq_scan > 10000 THEN 'HIGH' 
             WHEN seq_scan > 1000 THEN 'MEDIUM' 
             ELSE 'LOW' END::TEXT,
        'Query Performance'::TEXT,
        'LOW'::TEXT,
        format('-- Review queries on %s.%s table', schemaname, tablename)::TEXT
    FROM pg_stat_user_tables 
    WHERE seq_scan > 100 
      AND seq_tup_read / NULLIF(seq_scan, 0) > 10000
      AND (schemaname = 'public' AND (tablename LIKE 'plugin%' OR tablename IN ('users', 'organizations')))
    ORDER BY seq_scan DESC
    LIMIT 5;
    
    -- Vacuum recommendations
    RETURN QUERY
    SELECT 
        'VACUUM'::TEXT,
        format('Table %s.%s needs vacuuming (%.1f%% dead tuples)', 
               schemaname, tablename, 
               100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0))::TEXT,
        CASE WHEN n_dead_tup::FLOAT / NULLIF(n_live_tup + n_dead_tup, 0) > 0.3 THEN 'HIGH'
             WHEN n_dead_tup::FLOAT / NULLIF(n_live_tup + n_dead_tup, 0) > 0.1 THEN 'MEDIUM'
             ELSE 'LOW' END::TEXT,
        'Storage Efficiency'::TEXT,
        'LOW'::TEXT,
        format('VACUUM ANALYZE %s.%s;', schemaname, tablename)::TEXT
    FROM pg_stat_user_tables
    WHERE n_dead_tup > 1000
      AND n_dead_tup::FLOAT / NULLIF(n_live_tup + n_dead_tup, 0) > 0.05
      AND (schemaname = 'public' AND (tablename LIKE 'plugin%' OR tablename IN ('users', 'organizations')))
    ORDER BY n_dead_tup::FLOAT / NULLIF(n_live_tup + n_dead_tup, 0) DESC
    LIMIT 5;
    
    -- Connection recommendations
    IF (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'idle') > 50 THEN
        RETURN QUERY
        SELECT 
            'CONNECTION'::TEXT,
            'High number of idle connections detected. Consider connection pooling.'::TEXT,
            'MEDIUM'::TEXT,
            'Resource Usage'::TEXT,
            'MEDIUM'::TEXT,
            '-- Configure connection pooling (PgBouncer, connection pool settings)'::TEXT;
    END IF;
    
    -- Statistics recommendations
    RETURN QUERY
    SELECT 
        'STATISTICS'::TEXT,
        format('Update statistics for %s.%s (last analyzed: %s)', 
               schemaname, tablename, COALESCE(last_autoanalyze, last_analyze))::TEXT,
        'MEDIUM'::TEXT,
        'Query Planning'::TEXT,
        'LOW'::TEXT,
        format('ANALYZE %s.%s;', schemaname, tablename)::TEXT
    FROM pg_stat_user_tables
    WHERE (last_autoanalyze IS NULL AND last_analyze IS NULL)
       OR COALESCE(last_autoanalyze, last_analyze) < NOW() - INTERVAL '7 days'
       AND (schemaname = 'public' AND (tablename LIKE 'plugin%' OR tablename IN ('users', 'organizations')))
    ORDER BY COALESCE(last_autoanalyze, last_analyze, '1970-01-01'::timestamp)
    LIMIT 5;
END;
$$;

-- ============================================
-- PERFORMANCE MONITORING AUTOMATION
-- ============================================

-- Function for continuous performance monitoring (to be called by cron/scheduler)
CREATE OR REPLACE FUNCTION performance.continuous_monitoring()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    monitoring_results JSONB := '{}';
    sla_results JSONB;
    benchmark_record RECORD;
    measurement_result JSONB;
BEGIN
    -- Run SLA compliance check
    SELECT jsonb_agg(
        jsonb_build_object(
            'benchmark_name', sla.benchmark_name,
            'status', sla.status,
            'current_value', sla.current_value,
            'target_value', sla.target_value,
            'deviation_percent', sla.deviation_percent
        )
    ) INTO sla_results
    FROM performance.check_sla_compliance() sla;
    
    monitoring_results := jsonb_set(monitoring_results, '{sla_compliance}', sla_results);
    
    -- Record individual measurements
    FOR benchmark_record IN 
        SELECT * FROM performance_benchmarks WHERE is_active = true
    LOOP
        IF benchmark_record.measurement_query IS NOT NULL THEN
            measurement_result := performance.measure_query_performance(
                benchmark_record.benchmark_name,
                benchmark_record.measurement_query,
                3
            );
            
            PERFORM performance.record_measurement(
                benchmark_record.benchmark_name,
                (measurement_result->>'avg_time_ms')::FLOAT,
                measurement_result
            );
        END IF;
    END LOOP;
    
    -- Add timestamp
    monitoring_results := jsonb_set(monitoring_results, '{monitoring_run_at}', to_jsonb(NOW()));
    
    -- Log monitoring run
    INSERT INTO audit_logs (user_id, action, resource, metadata)
    VALUES ('system', 'performance_monitoring', 'system', monitoring_results);
    
    RETURN monitoring_results;
END;
$$;

-- ============================================
-- PERFORMANCE REPORTING VIEWS
-- ============================================

-- Daily performance summary
CREATE OR REPLACE VIEW performance.daily_summary AS
SELECT 
    DATE(measured_at) as report_date,
    benchmark_name,
    AVG(measured_value) as avg_performance,
    MIN(measured_value) as best_performance,
    MAX(measured_value) as worst_performance,
    STDDEV(measured_value) as performance_stddev,
    COUNT(*) FILTER (WHERE status = 'OK') as ok_count,
    COUNT(*) FILTER (WHERE status = 'WARNING') as warning_count,
    COUNT(*) FILTER (WHERE status = 'CRITICAL') as critical_count,
    COUNT(*) FILTER (WHERE status = 'SEVERE') as severe_count,
    COUNT(*) as total_measurements
FROM performance_measurements
WHERE measured_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(measured_at), benchmark_name
ORDER BY report_date DESC, benchmark_name;

-- Performance health score
CREATE OR REPLACE VIEW performance.health_score AS
WITH benchmark_scores AS (
    SELECT 
        benchmark_name,
        CASE 
            WHEN AVG(CASE WHEN status = 'OK' THEN 100 
                          WHEN status = 'WARNING' THEN 75
                          WHEN status = 'CRITICAL' THEN 25
                          ELSE 0 END) >= 90 THEN 'EXCELLENT'
            WHEN AVG(CASE WHEN status = 'OK' THEN 100 
                          WHEN status = 'WARNING' THEN 75
                          WHEN status = 'CRITICAL' THEN 25
                          ELSE 0 END) >= 70 THEN 'GOOD'
            WHEN AVG(CASE WHEN status = 'OK' THEN 100 
                          WHEN status = 'WARNING' THEN 75
                          WHEN status = 'CRITICAL' THEN 25
                          ELSE 0 END) >= 50 THEN 'FAIR'
            ELSE 'POOR'
        END as health_grade,
        AVG(CASE WHEN status = 'OK' THEN 100 
                 WHEN status = 'WARNING' THEN 75
                 WHEN status = 'CRITICAL' THEN 25
                 ELSE 0 END) as health_score
    FROM performance_measurements
    WHERE measured_at >= NOW() - INTERVAL '24 hours'
    GROUP BY benchmark_name
)
SELECT 
    *,
    RANK() OVER (ORDER BY health_score DESC) as performance_rank
FROM benchmark_scores
ORDER BY health_score DESC;

-- ============================================
-- PERFORMANCE ALERTING
-- ============================================

-- Function to check for performance alerts
CREATE OR REPLACE FUNCTION performance.check_alerts()
RETURNS TABLE (
    alert_type TEXT,
    severity TEXT,
    message TEXT,
    details JSONB
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    -- Check for sustained poor performance
    SELECT 
        'SUSTAINED_POOR_PERFORMANCE'::TEXT,
        'CRITICAL'::TEXT,
        format('%s has been performing poorly for %s consecutive measurements', 
               benchmark_name, consecutive_poor_count)::TEXT,
        jsonb_build_object(
            'benchmark_name', benchmark_name,
            'consecutive_poor_count', consecutive_poor_count,
            'latest_measurement', latest_measurement
        )
    FROM (
        SELECT 
            benchmark_name,
            COUNT(*) as consecutive_poor_count,
            MAX(measured_value) as latest_measurement
        FROM (
            SELECT 
                benchmark_name,
                measured_value,
                status,
                ROW_NUMBER() OVER (PARTITION BY benchmark_name ORDER BY measured_at DESC) as rn
            FROM performance_measurements
            WHERE measured_at >= NOW() - INTERVAL '1 hour'
              AND status IN ('CRITICAL', 'SEVERE')
        ) recent_poor
        WHERE rn <= 5  -- Last 5 measurements
        GROUP BY benchmark_name
        HAVING COUNT(*) >= 3  -- 3 or more consecutive poor measurements
    ) sustained_issues
    
    UNION ALL
    
    -- Check for performance degradation trends
    SELECT 
        'PERFORMANCE_DEGRADATION'::TEXT,
        'WARNING'::TEXT,
        format('%s shows degrading trend: %s%% worse than baseline', 
               benchmark_name, 
               ROUND(((current_avg - baseline_avg) / baseline_avg * 100)::numeric, 1))::TEXT,
        jsonb_build_object(
            'benchmark_name', benchmark_name,
            'current_avg', current_avg,
            'baseline_avg', baseline_avg,
            'degradation_percent', ROUND(((current_avg - baseline_avg) / baseline_avg * 100)::numeric, 1)
        )
    FROM (
        SELECT 
            benchmark_name,
            AVG(measured_value) FILTER (WHERE measured_at >= NOW() - INTERVAL '1 hour') as current_avg,
            AVG(measured_value) FILTER (WHERE measured_at >= NOW() - INTERVAL '25 hours' 
                                        AND measured_at < NOW() - INTERVAL '1 hour') as baseline_avg
        FROM performance_measurements
        WHERE measured_at >= NOW() - INTERVAL '25 hours'
        GROUP BY benchmark_name
        HAVING COUNT(*) FILTER (WHERE measured_at >= NOW() - INTERVAL '1 hour') >= 3
           AND COUNT(*) FILTER (WHERE measured_at >= NOW() - INTERVAL '25 hours' 
                               AND measured_at < NOW() - INTERVAL '1 hour') >= 10
    ) trends
    WHERE current_avg > baseline_avg * 1.2  -- 20% degradation threshold
$$;

-- ============================================
-- COMMENTS AND DOCUMENTATION
-- ============================================

COMMENT ON TABLE performance_benchmarks IS 'Defines performance benchmarks and SLA targets for database operations';
COMMENT ON TABLE performance_measurements IS 'Stores historical performance measurements for trend analysis';

COMMENT ON VIEW performance.query_performance IS 'Real-time view of query performance statistics';
COMMENT ON VIEW performance.table_performance IS 'Table-level performance metrics and health indicators';
COMMENT ON VIEW performance.index_utilization IS 'Index usage statistics and optimization opportunities';

COMMENT ON FUNCTION performance.measure_query_performance(TEXT, TEXT, INTEGER) IS 'Measures query performance with statistical analysis';
COMMENT ON FUNCTION performance.run_all_benchmarks() IS 'Executes all active performance benchmarks';
COMMENT ON FUNCTION performance.check_sla_compliance() IS 'Checks current performance against SLA targets';
COMMENT ON FUNCTION performance.continuous_monitoring() IS 'Main function for automated performance monitoring';

-- Grant permissions
GRANT SELECT ON ALL TABLES IN SCHEMA performance TO monitoring_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA performance TO monitoring_role;

-- ============================================
-- SAMPLE MONITORING QUERIES
-- ============================================

/*
-- Check current performance status
SELECT * FROM performance.check_sla_compliance();

-- Get performance trends for a specific benchmark
SELECT * FROM performance.get_performance_trends('plugin_search_query', 48);

-- Detect recent performance anomalies
SELECT * FROM performance.detect_anomalies('plugin_analytics_aggregation', 24, 2.5);

-- Get maintenance recommendations
SELECT * FROM performance.maintenance_recommendations();

-- View daily performance summary
SELECT * FROM performance.daily_summary WHERE report_date >= CURRENT_DATE - 7;

-- Check for performance alerts
SELECT * FROM performance.check_alerts();

-- Run continuous monitoring (typically called by cron job)
SELECT performance.continuous_monitoring();
*/