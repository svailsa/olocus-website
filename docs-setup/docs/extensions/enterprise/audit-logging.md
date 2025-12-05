---
id: audit-logging
title: Audit Logging
sidebar_position: 2
---

# Audit Logging

Enterprise-grade immutable audit logging and compliance framework for Olocus Protocol, supporting regulatory requirements including GDPR, HIPAA, SOC2, and PCI-DSS.

## Overview

The `olocus-audit` extension provides comprehensive audit logging capabilities designed for enterprise environments requiring detailed compliance tracking and regulatory adherence. All audit events are immutably recorded in the Olocus Protocol chain, providing tamper-evident audit trails.

### Key Features

- **Immutable Audit Trail**: All events recorded in tamper-evident blockchain structure
- **Compliance Frameworks**: Built-in support for GDPR, HIPAA, SOC2, PCI-DSS templates
- **Privacy Controls**: Field masking, redaction, and anonymization capabilities
- **Multi-Format Export**: CSV, JSON, Parquet, and Syslog export formats
- **Real-Time Monitoring**: Live audit event streaming and alerting
- **Query Interface**: Powerful search and filtering capabilities

## Architecture

### Core Audit Types

```rust
use olocus_audit::{AuditEvent, ActorIdentity, ResourceIdentity, AuditContext};
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub event_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub event_type: String,
    pub actor: ActorIdentity,
    pub resource: ResourceIdentity,
    pub action: String,
    pub outcome: AuditOutcome,
    pub context: AuditContext,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuditOutcome {
    Success,
    Failure { reason: String },
    Partial { details: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActorIdentity {
    pub user_id: String,
    pub session_id: Option<String>,
    pub role: String,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceIdentity {
    pub resource_type: String,
    pub resource_id: String,
    pub resource_path: Option<String>,
    pub parent_resource: Option<Box<ResourceIdentity>>,
}
```

### Audit Recorder Interface

```rust
use olocus_audit::{AuditRecorder, AuditResult, AuditQuery};

pub trait AuditRecorder: Send + Sync {
    /// Record a new audit event
    async fn record_event(&self, event: AuditEvent) -> AuditResult<()>;
    
    /// Record multiple events in batch
    async fn record_batch(&self, events: Vec<AuditEvent>) -> AuditResult<()>;
    
    /// Query audit events with filters
    async fn query_events(&self, query: &AuditQuery) -> AuditResult<Vec<AuditEvent>>;
    
    /// Get audit statistics
    async fn get_statistics(
        &self,
        from: DateTime<Utc>,
        to: DateTime<Utc>
    ) -> AuditResult<AuditStatistics>;
    
    /// Export audit data
    async fn export(
        &self,
        query: &AuditQuery,
        format: ExportFormat
    ) -> AuditResult<Vec<u8>>;
}
```

## Enterprise Compliance Features

### GDPR Compliance

```rust
use olocus_audit::compliance::gdpr::{GDPRFramework, DataSubjectRights, LegalBasis};

// Configure GDPR compliance framework
let gdpr_framework = GDPRFramework::new(GDPRConfig {
    controller_name: "Company Ltd".to_string(),
    dpo_contact: "dpo@company.com".to_string(),
    lawful_basis: LegalBasis::LegitimateInterest,
    retention_period: Duration::days(2555), // 7 years
    auto_anonymization: true,
});

// Record GDPR-compliant audit event
let gdpr_event = AuditEvent {
    event_id: Uuid::new_v4(),
    timestamp: Utc::now(),
    event_type: "data_access".to_string(),
    actor: ActorIdentity {
        user_id: "user123".to_string(),
        role: "data_analyst".to_string(),
        session_id: Some("session_abc".to_string()),
        ip_address: Some("192.168.1.100".to_string()),
        user_agent: Some("Mozilla/5.0...".to_string()),
    },
    resource: ResourceIdentity {
        resource_type: "customer_data".to_string(),
        resource_id: "customer_456".to_string(),
        resource_path: Some("/api/customers/456".to_string()),
        parent_resource: None,
    },
    action: "read".to_string(),
    outcome: AuditOutcome::Success,
    context: AuditContext {
        request_id: Some("req_789".to_string()),
        correlation_id: Some("corr_xyz".to_string()),
        business_process: Some("customer_inquiry".to_string()),
        compliance_tags: vec!["gdpr".to_string(), "personal_data".to_string()],
    },
    metadata: hashmap! {
        "gdpr_legal_basis".to_string() => "legitimate_interest".to_string(),
        "data_classification".to_string() => "personal".to_string(),
        "retention_class".to_string() => "standard_7y".to_string(),
    },
};

audit_recorder.record_event(gdpr_event).await?;

// Handle data subject access requests
let subject_data = gdpr_framework.handle_access_request(
    "user123",
    TimeRange::last_year()
).await?;
```

### HIPAA Compliance

```rust
use olocus_audit::compliance::hipaa::{HIPAAFramework, PHIAccess, MinimumNecessary};

// Configure HIPAA compliance
let hipaa_framework = HIPAAFramework::new(HIPAAConfig {
    covered_entity: "Healthcare Corp".to_string(),
    privacy_officer: "privacy@healthcare.com".to_string(),
    minimum_necessary_policy: MinimumNecessary::Strict,
    breach_notification_enabled: true,
    audit_retention_years: 6,
});

// Record PHI access with HIPAA controls
let phi_access_event = AuditEvent {
    event_type: "phi_access".to_string(),
    actor: ActorIdentity {
        user_id: "doctor_smith".to_string(),
        role: "physician".to_string(),
        session_id: Some("medical_session_123".to_string()),
        ip_address: Some("10.0.1.50".to_string()),
        user_agent: Some("EMR System v2.1".to_string()),
    },
    resource: ResourceIdentity {
        resource_type: "patient_record".to_string(),
        resource_id: "patient_789".to_string(),
        resource_path: Some("/emr/patients/789".to_string()),
        parent_resource: None,
    },
    action: "view_medical_history".to_string(),
    outcome: AuditOutcome::Success,
    context: AuditContext {
        business_process: Some("patient_consultation".to_string()),
        compliance_tags: vec!["hipaa".to_string(), "phi".to_string()],
        ..Default::default()
    },
    metadata: hashmap! {
        "patient_relationship".to_string() => "treating_physician".to_string(),
        "minimum_necessary_verified".to_string() => "true".to_string(),
        "access_purpose".to_string() => "treatment".to_string(),
        "phi_elements_accessed".to_string() => "diagnosis,medication,allergies".to_string(),
    },
    ..Default::default()
};

hipaa_framework.record_phi_access(phi_access_event).await?;

// Automated breach detection
if let Some(breach) = hipaa_framework.detect_potential_breach(&access_pattern).await? {
    hipaa_framework.initiate_breach_response(breach).await?;
}
```

### SOC2 Compliance

```rust
use olocus_audit::compliance::soc2::{SOC2Framework, TrustServicesCriteria, SecurityEvent};

// Configure SOC2 Type 2 controls
let soc2_framework = SOC2Framework::new(SOC2Config {
    service_organization: "SaaS Company Inc".to_string(),
    report_period: Duration::days(365),
    criteria: vec![
        TrustServicesCriteria::Security,
        TrustServicesCriteria::Availability,
        TrustServicesCriteria::ProcessingIntegrity,
        TrustServicesCriteria::Confidentiality,
    ],
    continuous_monitoring: true,
});

// Record security control events
let security_event = SecurityEvent {
    control_id: "CC6.1".to_string(), // Logical access controls
    control_activity: "user_authentication".to_string(),
    timestamp: Utc::now(),
    operator: "system".to_string(),
    outcome: AuditOutcome::Success,
    evidence: hashmap! {
        "authentication_method".to_string() => "mfa".to_string(),
        "session_duration".to_string() => "3600".to_string(),
        "risk_assessment".to_string() => "low".to_string(),
    },
};

soc2_framework.record_control_event(security_event).await?;

// Generate SOC2 compliance report
let compliance_report = soc2_framework.generate_report(
    Utc::now() - Duration::days(365),
    Utc::now()
).await?;
```

## Privacy and Data Protection

### Field Masking and Redaction

```rust
use olocus_audit::privacy::{PrivacyController, MaskingRule, RedactionPolicy};

// Configure privacy controls
let privacy_controller = PrivacyController::new(PrivacyConfig {
    default_masking: MaskingRule::PartialMask { visible_chars: 4 },
    pii_redaction: RedactionPolicy::Full,
    retention_enforcement: true,
});

// Define field-specific masking rules
privacy_controller.add_masking_rules(vec![
    MaskingRule::field("email").mask_domain(),
    MaskingRule::field("ssn").redact_fully(),
    MaskingRule::field("phone").mask_partial(4),
    MaskingRule::field("credit_card").mask_middle(4),
]);

// Apply privacy controls to audit event
let protected_event = privacy_controller.apply_privacy_controls(
    &audit_event,
    &access_context
).await?;

// Different privacy levels for different roles
match access_context.user_role {
    "auditor" => {
        // Auditors see masked PII
        privacy_controller.apply_role_policy("auditor", &event).await?
    }
    "compliance_officer" => {
        // Compliance officers see full data
        event
    }
    "analyst" => {
        // Analysts see anonymized data
        privacy_controller.anonymize_event(&event).await?
    }
    _ => {
        // Default: full redaction
        privacy_controller.redact_event(&event).await?
    }
}
```

### Data Anonymization

```rust
use olocus_audit::privacy::anonymization::{AnonymizationEngine, KAnonymity, LDiversity};

// Configure k-anonymity and l-diversity
let anonymization_engine = AnonymizationEngine::new(AnonymizationConfig {
    k_anonymity: 5,
    l_diversity: Some(3),
    quasi_identifiers: vec!["age", "zipcode", "gender"],
    sensitive_attributes: vec!["salary", "medical_condition"],
});

// Anonymize audit data for analytics
let anonymized_events = anonymization_engine.anonymize_batch(
    &audit_events,
    AnonymizationLevel::Strong
).await?;

// Verify anonymization quality
let privacy_metrics = anonymization_engine.calculate_privacy_metrics(
    &original_events,
    &anonymized_events
).await?;

assert!(privacy_metrics.k_anonymity >= 5);
assert!(privacy_metrics.information_loss < 0.3); // Less than 30% information loss
```

## Real-Time Monitoring and Alerting

### Event Stream Processing

```rust
use olocus_audit::streaming::{EventStream, StreamProcessor, AlertRule};
use tokio_stream::StreamExt;

// Create real-time audit event stream
let event_stream = EventStream::new(audit_recorder.clone());

// Configure alert rules
let alert_rules = vec![
    AlertRule::new("suspicious_access")
        .condition("failed_login_count > 5 AND time_window < 300s")
        .severity(AlertSeverity::High)
        .action(AlertAction::NotifySecurityTeam),
    
    AlertRule::new("privilege_escalation")
        .condition("role_change AND elevated_permissions")
        .severity(AlertSeverity::Critical)
        .action(AlertAction::BlockUser),
    
    AlertRule::new("data_exfiltration")
        .condition("export_volume > threshold AND off_hours")
        .severity(AlertSeverity::High)
        .action(AlertAction::RequireApproval),
];

// Process audit events in real-time
let stream_processor = StreamProcessor::new(alert_rules);

let mut event_stream = event_stream.into_stream();
while let Some(event) = event_stream.next().await {
    let alerts = stream_processor.process_event(&event).await?;
    
    for alert in alerts {
        match alert.severity {
            AlertSeverity::Critical => {
                security_team.notify_immediate(alert).await?;
                incident_response.trigger(alert).await?;
            }
            AlertSeverity::High => {
                security_team.notify(alert).await?;
            }
            AlertSeverity::Medium => {
                audit_log.record_alert(alert).await?;
            }
            _ => {}
        }
    }
}
```

### Anomaly Detection

```rust
use olocus_audit::analytics::{AnomalyDetector, BaselineModel, StatisticalMethod};

// Train baseline behavior model
let anomaly_detector = AnomalyDetector::new(AnomalyConfig {
    baseline_period: Duration::days(30),
    sensitivity: 0.95,
    methods: vec![
        StatisticalMethod::IsolationForest,
        StatisticalMethod::OneClassSVM,
        StatisticalMethod::LocalOutlierFactor,
    ],
});

// Train on historical data
let baseline_model = anomaly_detector.train_baseline(
    &historical_events,
    BaselineFeatures {
        temporal_patterns: true,
        user_behavior: true,
        access_patterns: true,
        resource_usage: true,
    }
).await?;

// Detect anomalies in real-time
let anomaly_score = anomaly_detector.calculate_anomaly_score(
    &new_event,
    &baseline_model
).await?;

if anomaly_score > 0.95 {
    let anomaly_alert = AnomalyAlert {
        event_id: new_event.event_id,
        score: anomaly_score,
        anomaly_type: anomaly_detector.classify_anomaly(&new_event).await?,
        context: anomaly_detector.get_context(&new_event, &baseline_model).await?,
        recommended_actions: vec![
            "Investigate user behavior".to_string(),
            "Verify legitimate access".to_string(),
            "Consider temporary access restriction".to_string(),
        ],
    };
    
    security_team.notify_anomaly(anomaly_alert).await?;
}
```

## Query and Export Capabilities

### Advanced Query Interface

```rust
use olocus_audit::query::{AuditQueryBuilder, FilterOperator, SortOrder};

// Build complex audit queries
let query = AuditQueryBuilder::new()
    .time_range(
        Utc::now() - Duration::days(30),
        Utc::now()
    )
    .filter("actor.user_id", FilterOperator::In, vec!["user1", "user2"])
    .filter("action", FilterOperator::Contains, "delete")
    .filter("outcome", FilterOperator::Equals, AuditOutcome::Success)
    .filter("resource.resource_type", FilterOperator::Equals, "sensitive_data")
    .sort_by("timestamp", SortOrder::Descending)
    .limit(1000)
    .build()?;

// Execute query
let results = audit_recorder.query_events(&query).await?;

// Aggregate query results
let aggregation = AuditQueryBuilder::new()
    .time_range(start_date, end_date)
    .group_by("actor.role")
    .aggregate("action", AggregateFunction::Count)
    .aggregate("resource.resource_type", AggregateFunction::Distinct)
    .build_aggregation()?;

let summary = audit_recorder.aggregate_events(&aggregation).await?;
```

### Multi-Format Export

```rust
use olocus_audit::export::{ExportFormat, ExportOptions, CompressionType};

// Export to different formats
let export_options = ExportOptions {
    format: ExportFormat::Parquet,
    compression: Some(CompressionType::Snappy),
    include_metadata: true,
    apply_privacy_controls: true,
    max_file_size: Some(100 * 1024 * 1024), // 100MB
};

// Export audit data for compliance reporting
let export_result = audit_recorder.export(
    &compliance_query,
    export_options
).await?;

// Export to multiple formats
let formats = vec![
    (ExportFormat::CSV, "audit_report.csv"),
    (ExportFormat::JSON, "audit_report.json"),
    (ExportFormat::Parquet, "audit_report.parquet"),
];

for (format, filename) in formats {
    let data = audit_recorder.export(
        &query,
        ExportOptions { format, ..Default::default() }
    ).await?;
    
    tokio::fs::write(filename, data).await?;
}
```

### Syslog Integration

```rust
use olocus_audit::syslog::{SyslogExporter, SyslogConfig, SyslogFormat};

// Configure syslog export for SIEM integration
let syslog_config = SyslogConfig {
    server: "siem.company.com:514".to_string(),
    facility: syslog::Facility::LOG_AUDIT,
    format: SyslogFormat::RFC5424,
    tls_enabled: true,
    certificate_path: Some("/etc/ssl/siem.pem".to_string()),
};

let syslog_exporter = SyslogExporter::new(syslog_config)?;

// Stream audit events to SIEM
let mut event_stream = audit_recorder.stream_events().await?;
while let Some(event) = event_stream.next().await {
    syslog_exporter.send_event(&event).await?;
}
```

## Integration with Enterprise Systems

### Active Directory Integration

```rust
use olocus_audit::integration::activedirectory::{ADIntegration, ADConfig};

// Configure Active Directory integration
let ad_config = ADConfig {
    server: "ldap://ad.company.com:389".to_string(),
    base_dn: "DC=company,DC=com".to_string(),
    service_account: "CN=audit-service,OU=Services,DC=company,DC=com".to_string(),
    service_password: env::var("AD_SERVICE_PASSWORD")?,
    user_base: "OU=Users,DC=company,DC=com".to_string(),
    group_base: "OU=Groups,DC=company,DC=com".to_string(),
};

let ad_integration = ADIntegration::new(ad_config).await?;

// Enrich audit events with AD information
let enriched_event = ad_integration.enrich_event(&audit_event).await?;

// Enriched event includes:
// - Full user display name
// - Department and manager information
// - Group memberships
// - Account status and last login
```

### SIEM Integration

```rust
use olocus_audit::integration::siem::{SIEMConnector, SIEMFormat, FieldMapping};

// Configure SIEM integration (Splunk, QRadar, ArcSight)
let siem_connector = SIEMConnector::new(SIEMConfig {
    siem_type: SIEMType::Splunk,
    endpoint: "https://splunk.company.com:8088/services/collector".to_string(),
    auth_token: env::var("SPLUNK_HEC_TOKEN")?,
    source_type: "olocus_audit".to_string(),
    index: "security".to_string(),
});

// Map Olocus audit fields to SIEM schema
let field_mapping = FieldMapping::new(vec![
    ("actor.user_id", "user"),
    ("actor.ip_address", "src_ip"),
    ("resource.resource_id", "object"),
    ("action", "action"),
    ("outcome", "result"),
    ("timestamp", "time"),
]);

siem_connector.set_field_mapping(field_mapping);

// Send events to SIEM
siem_connector.send_batch(&audit_events).await?;
```

## Performance and Scalability

### Batch Processing

```rust
use olocus_audit::batch::{BatchProcessor, BatchConfig};

// Configure batch processing for high-volume environments
let batch_config = BatchConfig {
    max_batch_size: 1000,
    max_wait_time: Duration::from_secs(5),
    max_concurrent_batches: 10,
    compression_enabled: true,
    retry_policy: RetryPolicy::ExponentialBackoff {
        max_retries: 3,
        base_delay: Duration::from_millis(100),
    },
};

let batch_processor = BatchProcessor::new(audit_recorder.clone(), batch_config);

// Process high-volume audit events efficiently
for event in audit_events {
    batch_processor.submit(event).await?;
}

// Ensure all batches are processed
batch_processor.flush().await?;
```

### Distributed Storage

```rust
use olocus_audit::storage::{DistributedStorage, ShardingStrategy, ReplicationConfig};

// Configure distributed audit storage
let storage_config = DistributedStorageConfig {
    sharding_strategy: ShardingStrategy::TimeBasedMonthly,
    replication: ReplicationConfig {
        factor: 3,
        consistency_level: ConsistencyLevel::Quorum,
    },
    compression: CompressionConfig {
        algorithm: CompressionAlgorithm::LZ4,
        level: 6,
    },
    retention_policy: RetentionPolicy {
        hot_storage_days: 90,
        warm_storage_days: 1095, // 3 years
        cold_storage_days: 2555, // 7 years
    },
};

let distributed_storage = DistributedStorage::new(storage_config).await?;
```

## Configuration Reference

```yaml
# audit-config.yaml
audit:
  # Core configuration
  enabled: true
  level: "all"  # all, security, compliance, minimal
  
  # Storage settings
  storage:
    backend: "distributed"  # memory, file, database, distributed
    retention_days: 2555    # 7 years
    compression: "lz4"
    encryption_at_rest: true
    
  # Compliance frameworks
  compliance:
    frameworks:
      - gdpr:
          enabled: true
          controller: "Company Ltd"
          dpo_contact: "dpo@company.com"
          retention_period: "7y"
      - hipaa:
          enabled: true
          covered_entity: "Healthcare Corp"
          privacy_officer: "privacy@healthcare.com"
      - soc2:
          enabled: true
          criteria: ["security", "availability", "confidentiality"]
          
  # Privacy controls
  privacy:
    default_masking: "partial_mask"
    pii_fields: ["email", "ssn", "phone", "address"]
    anonymization:
      k_anonymity: 5
      l_diversity: 3
      
  # Real-time monitoring
  monitoring:
    enabled: true
    stream_processing: true
    anomaly_detection: true
    alert_rules:
      - name: "suspicious_access"
        condition: "failed_login_count > 5"
        severity: "high"
      - name: "privilege_escalation"
        condition: "role_change AND elevated_permissions"
        severity: "critical"
        
  # Export settings
  export:
    formats: ["csv", "json", "parquet", "syslog"]
    compression: "snappy"
    max_file_size: "100MB"
    
  # Integration
  integration:
    siem:
      enabled: true
      type: "splunk"
      endpoint: "https://splunk.company.com:8088"
      source_type: "olocus_audit"
    active_directory:
      enabled: true
      server: "ldap://ad.company.com"
      base_dn: "DC=company,DC=com"
```

The audit logging extension provides comprehensive enterprise-grade audit capabilities while maintaining seamless integration with the Olocus Protocol's immutable chain structure.
