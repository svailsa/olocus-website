---
id: metrics
title: Metrics Collection and Export
sidebar_position: 5
---

# Metrics Collection and Export

The Metrics extension provides comprehensive instrumentation, collection, and export capabilities for monitoring Olocus Protocol performance, health, and operational metrics. It supports multiple export formats and sampling strategies for integration with existing monitoring infrastructure.

## Overview

Metrics collection enables monitoring of:

- **Performance Metrics**: Latency, throughput, error rates
- **Health Metrics**: Resource utilization, connection status, consensus state
- **Business Metrics**: Block production rates, transaction counts, validator performance
- **System Metrics**: Memory usage, CPU utilization, disk I/O

```rust
use olocus_metrics::*;

// Configure metrics collection
let metrics_config = MetricsConfig {
    export_format: ExportFormat::Prometheus {
        bind_addr: "0.0.0.0:9090".parse()?,
        path: "/metrics".to_string(),
        registry_name: "olocus".to_string(),
    },
    sampling_strategy: SamplingStrategy::Adaptive {
        base_rate: 0.1,
        max_rate: 1.0,
        window_size: Duration::from_secs(60),
    },
    aggregation_interval: Duration::from_secs(30),
    retention_period: Duration::from_secs(3600),
    health_check_interval: Duration::from_secs(10),
};

let metrics_registry = MetricsRegistry::new(metrics_config).await?;
```

## Metrics Trait Interface

### Core Metrics Traits

```rust
use olocus_metrics::traits::*;
use olocus_core::*;

#[async_trait::async_trait]
pub trait MetricsCollector: Send + Sync {
    async fn record_counter(&self, name: &str, value: u64, labels: &[(&str, &str)]) -> Result<()>;
    async fn record_gauge(&self, name: &str, value: f64, labels: &[(&str, &str)]) -> Result<()>;
    async fn record_histogram(&self, name: &str, value: f64, labels: &[(&str, &str)]) -> Result<()>;
    async fn record_timer(&self, name: &str, duration: Duration, labels: &[(&str, &str)]) -> Result<()>;
    
    async fn increment_counter(&self, name: &str, labels: &[(&str, &str)]) -> Result<()>;
    async fn set_gauge(&self, name: &str, value: f64, labels: &[(&str, &str)]) -> Result<()>;
    async fn observe_histogram(&self, name: &str, value: f64, labels: &[(&str, &str)]) -> Result<()>;
    
    fn start_timer(&self, name: &str) -> Timer;
    async fn get_metrics_snapshot(&self) -> Result<MetricsSnapshot>;
}

#[async_trait::async_trait]
pub trait ExportFormat: Send + Sync {
    async fn export_metrics(&self, snapshot: &MetricsSnapshot) -> Result<Vec<u8>>;
    async fn start_server(&self, registry: Arc<MetricsRegistry>) -> Result<()>;
    fn content_type(&self) -> &'static str;
    fn file_extension(&self) -> &'static str;
}

#[async_trait::async_trait]
pub trait SamplingStrategy: Send + Sync {
    async fn should_sample(&mut self, metric_name: &str, current_load: f64) -> bool;
    async fn update_sampling_rate(&mut self, metric_name: &str, new_rate: f64);
    fn get_current_rate(&self, metric_name: &str) -> f64;
}

#[derive(Debug, Clone)]
pub struct Timer {
    pub name: String,
    pub start_time: Instant,
    pub labels: Vec<(String, String)>,
}

impl Timer {
    pub fn finish(self, collector: &dyn MetricsCollector) -> Result<Duration> {
        let duration = self.start_time.elapsed();
        let labels: Vec<(&str, &str)> = self.labels.iter()
            .map(|(k, v)| (k.as_str(), v.as_str()))
            .collect();
        
        futures::executor::block_on(
            collector.record_timer(&self.name, duration, &labels)
        )?;
        
        Ok(duration)
    }
}

#[derive(Debug, Clone)]
pub struct MetricsSnapshot {
    pub timestamp: SystemTime,
    pub counters: HashMap<String, CounterMetric>,
    pub gauges: HashMap<String, GaugeMetric>,
    pub histograms: HashMap<String, HistogramMetric>,
    pub timers: HashMap<String, TimerMetric>,
}
```

## Prometheus Export

Prometheus integration for industry-standard monitoring:

### Implementation

```rust
use olocus_metrics::export::prometheus::*;
use prometheus::{Registry, Counter, Gauge, Histogram, Opts};

#[derive(Debug)]
pub struct PrometheusExporter {
    config: PrometheusConfig,
    registry: Registry,
    server_handle: Option<JoinHandle<()>>,
}

#[derive(Debug, Clone)]
pub struct PrometheusConfig {
    pub bind_addr: SocketAddr,
    pub path: String,
    pub registry_name: String,
    pub namespace: String,
    pub subsystem: String,
    pub help_text: bool,
    pub include_timestamp: bool,
}

impl Default for PrometheusConfig {
    fn default() -> Self {
        Self {
            bind_addr: "0.0.0.0:9090".parse().unwrap(),
            path: "/metrics".to_string(),
            registry_name: "olocus".to_string(),
            namespace: "olocus".to_string(),
            subsystem: "".to_string(),
            help_text: true,
            include_timestamp: true,
        }
    }
}

#[async_trait::async_trait]
impl ExportFormat for PrometheusExporter {
    async fn export_metrics(&self, snapshot: &MetricsSnapshot) -> Result<Vec<u8>> {
        let mut output = Vec::new();
        
        // Export counters
        for (name, metric) in &snapshot.counters {
            let metric_name = self.format_metric_name(name);
            
            if self.config.help_text {
                writeln!(&mut output, "# HELP {} {}", metric_name, metric.description)?;
                writeln!(&mut output, "# TYPE {} counter", metric_name)?;
            }
            
            for sample in &metric.samples {
                let labels = self.format_labels(&sample.labels);
                writeln!(&mut output, "{}{} {} {}", 
                    metric_name, labels, sample.value, 
                    snapshot.timestamp.duration_since(SystemTime::UNIX_EPOCH)?.as_millis())?;
            }
        }
        
        // Export gauges
        for (name, metric) in &snapshot.gauges {
            let metric_name = self.format_metric_name(name);
            
            if self.config.help_text {
                writeln!(&mut output, "# HELP {} {}", metric_name, metric.description)?;
                writeln!(&mut output, "# TYPE {} gauge", metric_name)?;
            }
            
            for sample in &metric.samples {
                let labels = self.format_labels(&sample.labels);
                writeln!(&mut output, "{}{} {} {}", 
                    metric_name, labels, sample.value,
                    snapshot.timestamp.duration_since(SystemTime::UNIX_EPOCH)?.as_millis())?;
            }
        }
        
        // Export histograms
        for (name, metric) in &snapshot.histograms {
            let metric_name = self.format_metric_name(name);
            
            if self.config.help_text {
                writeln!(&mut output, "# HELP {} {}", metric_name, metric.description)?;
                writeln!(&mut output, "# TYPE {} histogram", metric_name)?;
            }
            
            for sample in &metric.samples {
                let base_labels = &sample.labels;
                
                // Export buckets
                for (bucket, count) in &sample.buckets {
                    let mut labels = base_labels.clone();
                    labels.push(("le".to_string(), bucket.to_string()));
                    let labels_str = self.format_labels(&labels);
                    writeln!(&mut output, "{}_bucket{} {} {}", 
                        metric_name, labels_str, count,
                        snapshot.timestamp.duration_since(SystemTime::UNIX_EPOCH)?.as_millis())?;
                }
                
                // Export count and sum
                let labels_str = self.format_labels(base_labels);
                writeln!(&mut output, "{}_count{} {} {}", 
                    metric_name, labels_str, sample.count,
                    snapshot.timestamp.duration_since(SystemTime::UNIX_EPOCH)?.as_millis())?;
                writeln!(&mut output, "{}_sum{} {} {}", 
                    metric_name, labels_str, sample.sum,
                    snapshot.timestamp.duration_since(SystemTime::UNIX_EPOCH)?.as_millis())?;
            }
        }
        
        Ok(output)
    }
    
    async fn start_server(&self, registry: Arc<MetricsRegistry>) -> Result<()> {
        let bind_addr = self.config.bind_addr;
        let path = self.config.path.clone();
        
        let server = warp::path(path.trim_start_matches('/'))
            .and(warp::get())
            .and_then(move || {
                let registry = registry.clone();
                async move {
                    match registry.get_metrics_snapshot().await {
                        Ok(snapshot) => {
                            let exporter = PrometheusExporter::new(PrometheusConfig::default());
                            match exporter.export_metrics(&snapshot).await {
                                Ok(data) => {
                                    Ok(warp::reply::with_header(
                                        data,
                                        "content-type",
                                        "text/plain; charset=utf-8"
                                    ))
                                }
                                Err(e) => Err(warp::reject::custom(MetricsError::Export(e.to_string())))
                            }
                        }
                        Err(e) => Err(warp::reject::custom(MetricsError::Collection(e.to_string())))
                    }
                }
            });
        
        warp::serve(server).run(bind_addr).await;
        Ok(())
    }
    
    fn content_type(&self) -> &'static str {
        "text/plain; charset=utf-8"
    }
    
    fn file_extension(&self) -> &'static str {
        "txt"
    }
}

impl PrometheusExporter {
    pub fn new(config: PrometheusConfig) -> Self {
        Self {
            config,
            registry: Registry::new(),
            server_handle: None,
        }
    }
    
    fn format_metric_name(&self, name: &str) -> String {
        let mut formatted = name.to_lowercase().replace("-", "_");
        
        if !self.config.namespace.is_empty() {
            formatted = format!("{}_{}", self.config.namespace, formatted);
        }
        
        if !self.config.subsystem.is_empty() {
            formatted = format!("{}_{}", formatted, self.config.subsystem);
        }
        
        formatted
    }
    
    fn format_labels(&self, labels: &[(String, String)]) -> String {
        if labels.is_empty() {
            return String::new();
        }
        
        let formatted_labels: Vec<String> = labels.iter()
            .map(|(k, v)| format!("{}=\"{}\"", k, v.replace("\"", "\\\"")))
            .collect();
        
        format!("{{{}}}", formatted_labels.join(","))
    }
}
```

### Usage Example

```rust
use olocus_metrics::export::prometheus::*;

// Configure Prometheus export
let prometheus_config = PrometheusConfig {
    bind_addr: "0.0.0.0:9090".parse()?,
    path: "/metrics".to_string(),
    namespace: "olocus".to_string(),
    subsystem: "consensus".to_string(),
    help_text: true,
    include_timestamp: true,
};

let exporter = PrometheusExporter::new(prometheus_config);

// Start metrics server
let metrics_registry = Arc::new(MetricsRegistry::new(MetricsConfig::default()).await?);
exporter.start_server(metrics_registry.clone()).await?;

// Record some metrics
metrics_registry.increment_counter("blocks_produced", &[("validator", "node1")]).await?;
metrics_registry.set_gauge("memory_usage_bytes", 1024.0 * 1024.0 * 512.0, &[]).await?;

// Start histogram timer
let timer = metrics_registry.start_timer("block_processing_duration");
// ... do block processing ...
timer.finish(&*metrics_registry)?;
```

## Built-in Metrics

The extension provides built-in metrics for common Olocus Protocol operations:

### Consensus Metrics

```rust
use olocus_metrics::builtin::consensus::*;

// Block production metrics
metrics.increment_counter("olocus_blocks_produced_total", &[
    ("validator", validator_id),
    ("algorithm", "pbft"),
]);

metrics.record_histogram("olocus_block_production_duration_seconds", 
    production_time.as_secs_f64(), &[
    ("validator", validator_id),
    ("success", "true"),
]);

// Consensus participation
metrics.set_gauge("olocus_consensus_participation_rate", 
    participation_rate, &[
    ("validator", validator_id),
]);

metrics.increment_counter("olocus_votes_cast_total", &[
    ("validator", validator_id),
    ("vote_type", "prepare"),
]);
```

### Network Metrics

```rust
use olocus_metrics::builtin::network::*;

// Connection metrics
metrics.set_gauge("olocus_network_connections_active", 
    active_connections as f64, &[
    ("transport", "tcp"),
]);

metrics.increment_counter("olocus_network_messages_sent_total", &[
    ("message_type", "block"),
    ("peer", peer_id),
]);

metrics.record_histogram("olocus_network_latency_seconds", 
    latency.as_secs_f64(), &[
    ("peer", peer_id),
    ("message_type", "block"),
]);
```

### Storage Metrics

```rust
use olocus_metrics::builtin::storage::*;

// Storage operations
metrics.record_timer("olocus_storage_operation_duration", 
    operation_duration, &[
    ("operation", "write"),
    ("backend", "rocksdb"),
]);

metrics.set_gauge("olocus_storage_size_bytes", 
    storage_size as f64, &[
    ("backend", "rocksdb"),
]);

metrics.increment_counter("olocus_storage_operations_total", &[
    ("operation", "read"),
    ("status", "success"),
]);
```

## Performance Characteristics

| Export Format | Overhead | Latency | Bandwidth | Compatibility |
|---------------|----------|---------|-----------|---------------|
| Prometheus    | Low      | Low     | Medium    | Excellent |
| OpenTelemetry | Medium   | Medium  | Low       | Good |
| StatsD        | Very Low | Very Low| High      | Good |
| JSON          | Medium   | Low     | High      | Excellent |

## Configuration Examples

### Production Monitoring Setup

```rust
use olocus_metrics::*;

// High-performance production configuration
let config = MetricsConfig {
    export_format: ExportFormat::Prometheus {
        bind_addr: "0.0.0.0:9090".parse()?,
        path: "/metrics".to_string(),
        registry_name: "olocus_production".to_string(),
    },
    sampling_strategy: SamplingStrategy::Adaptive {
        base_rate: 0.05, // 5% sampling under normal load
        max_rate: 0.2,   // Maximum 20% sampling
        window_size: Duration::from_secs(300), // 5-minute window
    },
    aggregation_interval: Duration::from_secs(15),
    retention_period: Duration::from_secs(86400), // 24 hours
    health_check_interval: Duration::from_secs(30),
};

let registry = MetricsRegistry::new(config).await?;
```

### Development Environment

```rust
// Development configuration with full sampling
let config = MetricsConfig {
    export_format: ExportFormat::Prometheus {
        bind_addr: "127.0.0.1:9090".parse()?,
        path: "/metrics".to_string(),
        registry_name: "olocus_dev".to_string(),
    },
    sampling_strategy: SamplingStrategy::Fixed { rate: 1.0 }, // 100% sampling
    aggregation_interval: Duration::from_secs(5),
    retention_period: Duration::from_secs(3600), // 1 hour
    health_check_interval: Duration::from_secs(10),
};
```

## Error Handling

```rust
use olocus_metrics::error::*;

#[derive(Debug, thiserror::Error)]
pub enum MetricsError {
    #[error("Collection error: {0}")]
    Collection(String),
    
    #[error("Export error: {0}")]
    Export(String),
    
    #[error("Sampling error: {0}")]
    Sampling(String),
    
    #[error("Health check error: {0}")]
    HealthCheck(String),
    
    #[error("Configuration error: {0}")]
    Configuration(String),
    
    #[error("Network error: {0}")]
    Network(#[from] NetworkError),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}
```

The Metrics extension provides comprehensive observability for Olocus Protocol deployments, enabling monitoring, alerting, and performance optimization through industry-standard metrics formats and adaptive sampling strategies.
