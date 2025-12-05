---
id: hsm-integration
title: HSM Integration
sidebar_position: 1
---

# HSM Integration

Enterprise-grade hardware security module (HSM) integration for Olocus Protocol, providing FIPS 140-2/3 compliant key management and cryptographic operations.

## Overview

The `olocus-hsm` extension provides comprehensive HSM integration for enterprise environments requiring the highest levels of cryptographic security. This extension supports both on-premise and cloud HSM solutions with standardized PKCS#11 interfaces.

### Key Features

- **FIPS 140-2 Level 2/3 Compliance**: Certified hardware security for regulated industries
- **Multi-Vendor Support**: Works with Thales Luna, Entrust nShield, Utimaco, and SoftHSM
- **Cloud HSM Integration**: Native support for AWS CloudHSM, Azure Key Vault, Google Cloud HSM
- **Session Pooling**: High-throughput operations with connection pooling
- **Key Rotation**: Automated key lifecycle management with version history
- **Health Monitoring**: Real-time HSM status and performance metrics

## Architecture

### HSM Backend Abstraction

```rust
use olocus_hsm::{HSMBackend, HSMResult, KeyId, SignRequest};

pub trait HSMBackend: Send + Sync {
    /// Initialize HSM connection with credentials
    async fn initialize(&mut self, config: HSMConfig) -> HSMResult<()>;
    
    /// Generate new key pair in HSM
    async fn generate_keypair(
        &self,
        key_type: KeyType,
        attributes: KeyAttributes
    ) -> HSMResult<KeyId>;
    
    /// Sign data using HSM-stored private key
    async fn sign(
        &self,
        key_id: &KeyId,
        request: &SignRequest
    ) -> HSMResult<Vec<u8>>;
    
    /// Verify signature using HSM-stored public key
    async fn verify(
        &self,
        key_id: &KeyId,
        data: &[u8],
        signature: &[u8]
    ) -> HSMResult<bool>;
    
    /// Encrypt data using HSM key
    async fn encrypt(
        &self,
        key_id: &KeyId,
        plaintext: &[u8]
    ) -> HSMResult<Vec<u8>>;
    
    /// Get HSM health status
    async fn health_check(&self) -> HSMResult<HSMStatus>;
}
```

### Session Management

```rust
use olocus_hsm::session::{SessionPool, SessionConfig};

// Configure session pool for high throughput
let session_config = SessionConfig {
    min_sessions: 5,
    max_sessions: 50,
    idle_timeout: Duration::from_secs(300),
    health_check_interval: Duration::from_secs(60),
};

let session_pool = SessionPool::new(hsm_backend, session_config).await?;

// Use pooled sessions for signing operations
let signature = session_pool.with_session(|session| {
    session.sign(&key_id, &sign_request)
}).await?;
```

## Enterprise Deployment Patterns

### High Availability Configuration

```rust
use olocus_hsm::cluster::{HSMCluster, ClusterConfig, FailoverPolicy};

// Configure HSM cluster for high availability
let cluster_config = ClusterConfig {
    primary_hsm: "hsm-primary.company.com",
    backup_hsms: vec![
        "hsm-backup-1.company.com",
        "hsm-backup-2.company.com"
    ],
    failover_policy: FailoverPolicy::Automatic,
    health_check_interval: Duration::from_secs(30),
    failover_threshold: 3,
};

let hsm_cluster = HSMCluster::new(cluster_config).await?;

// Automatic failover on HSM failure
let signature = hsm_cluster.sign(&key_id, &data).await?;
```

### Load Balancing

```rust
use olocus_hsm::balancer::{LoadBalancer, BalancingStrategy};

// Distribute load across multiple HSMs
let load_balancer = LoadBalancer::new(
    vec![hsm1, hsm2, hsm3],
    BalancingStrategy::RoundRobin
);

// Operations automatically distributed
for request in signing_requests {
    let signature = load_balancer.sign(&key_id, &request).await?;
    signatures.push(signature);
}
```

## Security Features

### Key Attestation

```rust
use olocus_hsm::attestation::{AttestationRequest, AttestationProof};

// Generate attestation proof for key authenticity
let attestation_request = AttestationRequest {
    key_id: key_id.clone(),
    challenge: random_challenge(),
    include_certificate_chain: true,
};

let proof = hsm.attest_key(&attestation_request).await?;

// Verify key was generated in genuine HSM
assert!(proof.verify_hsm_authenticity());
assert!(proof.verify_key_properties(&expected_attributes));
```

### Secure Key Import/Export

```rust
use olocus_hsm::transport::{KeyTransport, WrapMethod};

// Secure key transport between HSMs
let transport = KeyTransport::new(WrapMethod::AES256GCM);

// Export key wrapped for secure transport
let wrapped_key = hsm_source.export_key(
    &key_id,
    &transport.wrapping_key()
).await?;

// Import wrapped key to destination HSM
let new_key_id = hsm_destination.import_key(
    &wrapped_key,
    &transport
).await?;
```

## Key Lifecycle Management

### Automated Rotation

```rust
use olocus_hsm::rotation::{RotationPolicy, RotationScheduler};
use chrono::Duration;

// Configure automatic key rotation
let rotation_policy = RotationPolicy {
    rotation_interval: Duration::days(90),
    overlap_period: Duration::days(7),
    max_key_versions: 5,
    notification_advance: Duration::days(7),
};

let scheduler = RotationScheduler::new(
    hsm.clone(),
    rotation_policy
);

// Start automated rotation
scheduler.start().await?;

// Manual rotation trigger
let new_key_id = scheduler.rotate_key(&current_key_id).await?;
```

### Version Management

```rust
use olocus_hsm::versioning::{KeyVersion, VersionManager};

// Track key versions with metadata
let version_manager = VersionManager::new(hsm.clone());

// Create new version during rotation
let new_version = version_manager.create_version(
    &key_id,
    KeyVersion {
        version: 2,
        created_at: Utc::now(),
        expires_at: Some(Utc::now() + Duration::days(365)),
        metadata: hashmap! {
            "rotation_reason".to_string() => "scheduled".to_string(),
            "compliance_requirement".to_string() => "annual".to_string(),
        },
    }
).await?;

// List all versions for audit
let versions = version_manager.list_versions(&key_id).await?;
```

## Cloud HSM Integration

### AWS CloudHSM

```rust
use olocus_hsm::providers::aws::{CloudHSMBackend, CloudHSMConfig};

// Configure AWS CloudHSM connection
let aws_config = CloudHSMConfig {
    cluster_id: "cluster-1234567890abcdef".to_string(),
    hsm_ca_cert: include_str!("aws-hsm-ca.pem").to_string(),
    client_cert: include_str!("client-cert.pem").to_string(),
    client_key: include_str!("client-key.pem").to_string(),
    hsm_user: "crypto_user".to_string(),
    hsm_password: env::var("HSM_PASSWORD")?,
    region: "us-east-1".to_string(),
};

let aws_hsm = CloudHSMBackend::new(aws_config).await?;
```

### Azure Key Vault

```rust
use olocus_hsm::providers::azure::{KeyVaultBackend, KeyVaultConfig};

// Configure Azure Key Vault HSM
let azure_config = KeyVaultConfig {
    vault_url: "https://company-vault.vault.azure.net/".to_string(),
    tenant_id: "tenant-id".to_string(),
    client_id: "client-id".to_string(),
    client_secret: env::var("AZURE_CLIENT_SECRET")?,
    hsm_tier: azure::HSMTier::Premium,
};

let azure_hsm = KeyVaultBackend::new(azure_config).await?;
```

### Google Cloud HSM

```rust
use olocus_hsm::providers::gcp::{CloudHSMBackend, CloudHSMConfig};

// Configure Google Cloud HSM
let gcp_config = CloudHSMConfig {
    project_id: "company-project".to_string(),
    location: "us-central1".to_string(),
    key_ring: "olocus-keys".to_string(),
    service_account_key: include_str!("service-account.json").to_string(),
};

let gcp_hsm = CloudHSMBackend::new(gcp_config).await?;
```

## Compliance and Auditing

### FIPS 140-2 Validation

```rust
use olocus_hsm::compliance::{FIPSValidator, ComplianceLevel};

// Validate FIPS 140-2 compliance
let validator = FIPSValidator::new();

let compliance_check = validator.validate_hsm(&hsm).await?;
assert_eq!(compliance_check.level, ComplianceLevel::Level3);
assert!(compliance_check.is_compliant());

// Generate compliance report
let report = validator.generate_report(&compliance_check).await?;
```

### Audit Trail

```rust
use olocus_hsm::audit::{AuditLogger, AuditEvent, AuditLevel};

// Configure audit logging
let audit_logger = AuditLogger::new(AuditLevel::All);

// All HSM operations are automatically audited
hsm.set_audit_logger(audit_logger);

// Query audit trail
let events = audit_logger.query_events(
    Utc::now() - Duration::days(30),
    Utc::now()
).await?;

for event in events {
    match event.event_type {
        AuditEvent::KeyGeneration { key_id, algorithm } => {
            println!("Key {} generated using {}", key_id, algorithm);
        }
        AuditEvent::SignOperation { key_id, data_hash } => {
            println!("Signing operation with key {}", key_id);
        }
        AuditEvent::KeyRotation { old_key, new_key } => {
            println!("Key rotated: {} -> {}", old_key, new_key);
        }
        _ => {}
    }
}
```

## Performance Optimization

### Connection Pooling

```rust
use olocus_hsm::pool::{ConnectionPool, PoolConfig};

// Optimize for high-throughput environments
let pool_config = PoolConfig {
    min_connections: 10,
    max_connections: 100,
    connection_timeout: Duration::from_secs(5),
    idle_timeout: Duration::from_secs(300),
    max_lifetime: Duration::from_secs(3600),
    health_check_interval: Duration::from_secs(30),
};

let connection_pool = ConnectionPool::new(hsm_config, pool_config).await?;

// Concurrent operations with pooled connections
let signing_tasks: Vec<_> = requests.into_iter().map(|request| {
    let pool = connection_pool.clone();
    tokio::spawn(async move {
        pool.with_connection(|hsm| {
            hsm.sign(&request.key_id, &request.data)
        }).await
    })
}).collect();

let signatures = futures::try_join_all(signing_tasks).await?;
```

### Batch Operations

```rust
use olocus_hsm::batch::{BatchProcessor, BatchConfig};

// Process multiple operations in batches
let batch_config = BatchConfig {
    max_batch_size: 50,
    max_wait_time: Duration::from_millis(100),
    max_concurrent_batches: 5,
};

let batch_processor = BatchProcessor::new(hsm.clone(), batch_config);

// Submit operations for batching
for request in sign_requests {
    batch_processor.submit_sign_request(request).await?;
}

// Wait for all batches to complete
batch_processor.flush().await?;
```

## Integration with Olocus Core

### HSM-Backed Block Signing

```rust
use olocus_core::{Block, BlockPayload};
use olocus_hsm::OlocusHSMExtension;

// Configure Olocus with HSM backend
let hsm_extension = OlocusHSMExtension::new(hsm_backend);

// Create block with HSM signing
let payload = MyPayload::new(data);
let block = Block::new(
    payload,
    previous_hash,
    &hsm_extension.signing_key()
).await?;

// Block is automatically signed using HSM
assert!(block.verify_signature(&hsm_extension.verification_key()).await?);
```

### Key Derivation

```rust
use olocus_hsm::derivation::{KeyDerivation, DerivationPath};

// Derive keys using HSM master key
let master_key = hsm.generate_master_key().await?;
let derivation_path = DerivationPath::parse("m/44'/0'/0'/0/0")?;

let derived_key = hsm.derive_key(
    &master_key,
    &derivation_path
).await?;
```

## Monitoring and Alerts

### Health Monitoring

```rust
use olocus_hsm::monitoring::{HSMMonitor, HealthMetrics, AlertConfig};

// Configure HSM health monitoring
let alert_config = AlertConfig {
    latency_threshold: Duration::from_millis(500),
    error_rate_threshold: 0.01, // 1%
    connection_threshold: 0.8,   // 80% of pool
    notification_webhook: Some("https://alerts.company.com/hsm".to_string()),
};

let monitor = HSMMonitor::new(hsm.clone(), alert_config);

// Start monitoring
monitor.start().await?;

// Get current metrics
let metrics = monitor.get_metrics().await?;
println!("Average latency: {}ms", metrics.avg_latency.as_millis());
println!("Error rate: {:.2}%", metrics.error_rate * 100.0);
println!("Active connections: {}", metrics.active_connections);
```

### Performance Metrics

```rust
use olocus_hsm::metrics::{MetricsCollector, MetricType};

// Collect detailed performance metrics
let metrics = MetricsCollector::new();

// Track operation latencies
metrics.record_latency(MetricType::SignOperation, latency);
metrics.record_latency(MetricType::KeyGeneration, latency);

// Export metrics to monitoring system
let prometheus_metrics = metrics.export_prometheus().await?;
```

## Best Practices

### Security Hardening

1. **Network Isolation**: Deploy HSMs in isolated network segments
2. **Access Control**: Implement role-based access with principle of least privilege
3. **Certificate Management**: Use strong PKI for HSM authentication
4. **Audit Logging**: Enable comprehensive audit trails for all operations
5. **Backup and Recovery**: Implement secure key backup and disaster recovery

### Performance Tuning

1. **Connection Pooling**: Use appropriate pool sizes for your workload
2. **Batch Operations**: Group multiple operations when possible
3. **Async Processing**: Leverage asynchronous operations for better throughput
4. **Load Balancing**: Distribute load across multiple HSM instances
5. **Caching**: Cache public keys and certificates when appropriate

### Operational Excellence

1. **Monitoring**: Implement comprehensive HSM health monitoring
2. **Alerting**: Set up proactive alerts for HSM issues
3. **Documentation**: Maintain detailed operational runbooks
4. **Testing**: Regular disaster recovery and failover testing
5. **Training**: Ensure operations teams are trained on HSM procedures

## Error Handling

The HSM extension uses standardized error codes in the range 100-109:

```rust
use olocus_hsm::{HSMError, HSMErrorCode};

match hsm_result {
    Err(HSMError::ConnectionFailed { code: 100, .. }) => {
        // Retry with exponential backoff
        tokio::time::sleep(backoff_duration).await;
        retry_operation().await?;
    }
    Err(HSMError::KeyNotFound { code: 101, .. }) => {
        // Generate new key
        let new_key = hsm.generate_keypair(key_type, attributes).await?;
    }
    Err(HSMError::AuthenticationFailed { code: 102, .. }) => {
        // Refresh credentials and retry
        hsm.refresh_authentication().await?;
    }
    Ok(result) => {
        // Process successful result
    }
}
```

## Configuration Reference

### HSM Provider Configuration

```yaml
# hsm-config.yaml
hsm:
  provider: "thales_luna"  # thales_luna, entrust_nshield, utimaco, softhsm, aws_cloudhsm, azure_keyvault, gcp_hsm
  
  # Connection settings
  connection:
    host: "192.168.1.100"
    port: 1792
    timeout: 30s
    retry_attempts: 3
    
  # Authentication
  auth:
    username: "crypto_user"
    password_env: "HSM_PASSWORD"
    certificate_path: "/etc/hsm/client.pem"
    private_key_path: "/etc/hsm/client-key.pem"
    
  # Session pool
  pool:
    min_sessions: 5
    max_sessions: 50
    idle_timeout: 300s
    health_check_interval: 60s
    
  # Key management
  keys:
    rotation_interval: 90d
    overlap_period: 7d
    max_versions: 5
    
  # Monitoring
  monitoring:
    enabled: true
    metrics_interval: 30s
    health_check_interval: 60s
    alert_latency_threshold: 500ms
    alert_error_rate_threshold: 0.01
```

The HSM integration extension provides enterprise-grade cryptographic security while maintaining the flexibility and extensibility of the Olocus Protocol architecture.