---
id: hsm-integration
title: HSM Integration
sidebar_position: 3
---

# HSM Integration

The HSM extension provides enterprise-grade Hardware Security Module integration for cryptographic operations with FIPS 140-2/3 compliance and high-assurance key management.

## Overview

The HSM extension supports multiple HSM types and provides unified APIs for:

- **PKCS#11**: On-premise HSMs (Thales Luna, Entrust nShield, Utimaco)
- **Cloud HSMs**: AWS CloudHSM, Azure Key Vault, Google Cloud HSM
- **Session Management**: Connection pooling and load balancing
- **Key Management**: Generation, rotation, archival with versioning
- **Compliance**: FIPS 140-2 Level 2/3, Common Criteria
- **Monitoring**: Health checks, performance metrics, audit logging

```rust
use olocus_hsm::*;

// Configure HSM backend
let hsm_config = HSMConfig {
    backend: HSMBackend::PKCS11 {
        library_path: "/usr/lib/libCryptoki2_64.so".to_string(),
        slot_id: 0,
        pin: "your_hsm_pin".to_string(),
        token_label: Some("OlocusToken".to_string()),
    },
    session_pool: SessionPoolConfig {
        min_sessions: 2,
        max_sessions: 10,
        idle_timeout: Duration::from_mins(30),
    },
    key_rotation: KeyRotationConfig {
        enabled: true,
        rotation_interval: Duration::from_days(90),
        retention_versions: 3,
    },
};

let hsm = HSMManager::new(hsm_config).await?;
```

## PKCS#11 Integration

PKCS#11 provides standardized access to cryptographic tokens and HSMs:

### PKCS#11 Implementation

```rust
use olocus_hsm::pkcs11::*;
use pkcs11::{Ctx, Session, Mechanism, ObjectClass, KeyType};

pub struct PKCS11HSM {
    context: Ctx,
    session_pool: Arc<Mutex<SessionPool>>,
    config: PKCS11Config,
    slot_id: u64,
}

#[derive(Debug, Clone)]
pub struct PKCS11Config {
    pub library_path: String,
    pub slot_id: u64,
    pub pin: String,
    pub token_label: Option<String>,
    pub auto_login: bool,
    pub read_only: bool,
}

impl HSMBackend for PKCS11HSM {
    async fn initialize(&mut self) -> Result<()> {
        // Initialize PKCS#11 library
        self.context = Ctx::new_and_initialize(&self.config.library_path)
            .map_err(|e| HSMError::InitializationFailed(e.to_string()))?;
            
        // Get slot information
        let slots = self.context.get_slots_with_initialized_token()
            .map_err(|e| HSMError::SlotError(e.to_string()))?;
            
        if !slots.contains(&self.slot_id) {
            return Err(HSMError::SlotNotFound(self.slot_id));
        }
        
        // Verify token is present
        let token_info = self.context.get_token_info(self.slot_id)
            .map_err(|e| HSMError::TokenError(e.to_string()))?;
            
        if let Some(ref expected_label) = self.config.token_label {
            if token_info.label.trim() != expected_label {
                return Err(HSMError::TokenLabelMismatch {
                    expected: expected_label.clone(),
                    found: token_info.label.clone(),
                });
            }
        }
        
        // Initialize session pool
        self.initialize_session_pool().await?;
        
        Ok(())
    }
    
    async fn generate_key_pair(&self, key_spec: &KeySpec) -> Result<HSMKeyHandle> {
        let session = self.acquire_session().await?;
        
        let key_handle = match key_spec.algorithm {
            KeyAlgorithm::Ed25519 => {
                self.generate_ed25519_key_pair(&session, key_spec).await?
            },
            KeyAlgorithm::ECDSA(curve) => {
                self.generate_ecdsa_key_pair(&session, key_spec, curve).await?
            },
            KeyAlgorithm::RSA(key_size) => {
                self.generate_rsa_key_pair(&session, key_spec, key_size).await?
            }
        };
        
        self.release_session(session).await?;
        Ok(key_handle)
    }
    
    async fn sign(&self, key_handle: &HSMKeyHandle, data: &[u8]) -> Result<Vec<u8>> {
        let session = self.acquire_session().await?;
        
        // Get private key object
        let private_key = self.get_private_key_object(&session, &key_handle.private_key_id).await?;
        
        // Choose mechanism based on key algorithm
        let mechanism = match key_handle.algorithm {
            KeyAlgorithm::Ed25519 => Mechanism::EdDSA,
            KeyAlgorithm::ECDSA(_) => Mechanism::ECDSA,
            KeyAlgorithm::RSA(_) => Mechanism::RsaPkcs,
        };
        
        // Initialize signing operation
        session.sign_init(&mechanism, &private_key)
            .map_err(|e| HSMError::SigningFailed(e.to_string()))?;
            
        // Perform signing
        let signature = session.sign(data)
            .map_err(|e| HSMError::SigningFailed(e.to_string()))?;
            
        self.release_session(session).await?;
        
        // Log signing operation
        self.log_cryptographic_operation(CryptoOperation {
            operation_type: OperationType::Sign,
            key_id: key_handle.key_id.clone(),
            algorithm: key_handle.algorithm.clone(),
            timestamp: SystemTime::now(),
            success: true,
        }).await?;
        
        Ok(signature)
    }
    
    async fn verify(&self, key_handle: &HSMKeyHandle, data: &[u8], signature: &[u8]) -> Result<bool> {
        let session = self.acquire_session().await?;
        
        // Get public key object
        let public_key = self.get_public_key_object(&session, &key_handle.public_key_id).await?;
        
        let mechanism = match key_handle.algorithm {
            KeyAlgorithm::Ed25519 => Mechanism::EdDSA,
            KeyAlgorithm::ECDSA(_) => Mechanism::ECDSA,
            KeyAlgorithm::RSA(_) => Mechanism::RsaPkcs,
        };
        
        // Initialize verification
        session.verify_init(&mechanism, &public_key)
            .map_err(|e| HSMError::VerificationFailed(e.to_string()))?;
            
        // Perform verification
        let is_valid = session.verify(data, signature).is_ok();
        
        self.release_session(session).await?;
        
        Ok(is_valid)
    }
}
```

### Session Pool Management

```rust
use tokio::sync::Semaphore;

pub struct SessionPool {
    sessions: VecDeque<HSMSession>,
    config: SessionPoolConfig,
    semaphore: Arc<Semaphore>,
    metrics: SessionPoolMetrics,
}

#[derive(Debug, Clone)]
pub struct SessionPoolConfig {
    pub min_sessions: usize,
    pub max_sessions: usize,
    pub idle_timeout: Duration,
    pub health_check_interval: Duration,
    pub retry_attempts: u32,
}

#[derive(Debug)]
pub struct HSMSession {
    pub session: Session,
    pub created_at: SystemTime,
    pub last_used: SystemTime,
    pub operation_count: u64,
    pub is_healthy: bool,
}

impl SessionPool {
    pub async fn new(context: &Ctx, slot_id: u64, config: SessionPoolConfig) -> Result<Self> {
        let mut pool = Self {
            sessions: VecDeque::new(),
            config: config.clone(),
            semaphore: Arc::new(Semaphore::new(config.max_sessions)),
            metrics: SessionPoolMetrics::new(),
        };
        
        // Create minimum number of sessions
        for _ in 0..config.min_sessions {
            let session = pool.create_session(context, slot_id).await?;
            pool.sessions.push_back(session);
        }
        
        Ok(pool)
    }
    
    pub async fn acquire_session(&mut self) -> Result<HSMSession> {
        // Wait for available slot
        let _permit = self.semaphore.acquire().await
            .map_err(|_| HSMError::SessionPoolExhausted)?;
            
        // Try to get existing session
        if let Some(mut session) = self.sessions.pop_front() {
            // Check if session is still healthy
            if self.is_session_healthy(&session).await? {
                session.last_used = SystemTime::now();
                session.operation_count += 1;
                self.metrics.sessions_acquired += 1;
                return Ok(session);
            } else {
                // Session is unhealthy, create new one
                self.metrics.sessions_recycled += 1;
            }
        }
        
        // Create new session if needed
        if self.sessions.len() + 1 <= self.config.max_sessions {
            let session = self.create_session(&self.context, self.slot_id).await?;
            self.metrics.sessions_created += 1;
            Ok(session)
        } else {
            Err(HSMError::SessionPoolExhausted)
        }
    }
    
    pub async fn release_session(&mut self, session: HSMSession) {
        // Check if we should keep this session
        let should_keep = self.sessions.len() < self.config.min_sessions ||
                         (session.is_healthy && 
                          SystemTime::now().duration_since(session.created_at).unwrap_or_default() < 
                          Duration::from_hours(1));
                          
        if should_keep {
            self.sessions.push_back(session);
        } else {
            // Close the session
            let _ = session.session.close();
            self.metrics.sessions_destroyed += 1;
        }
        
        self.metrics.sessions_released += 1;
    }
    
    async fn create_session(&self, context: &Ctx, slot_id: u64) -> Result<HSMSession> {
        let flags = pkcs11::types::CKF_SERIAL_SESSION | pkcs11::types::CKF_RW_SESSION;
        
        let session = context.open_session(slot_id, flags, None, None)
            .map_err(|e| HSMError::SessionCreationFailed(e.to_string()))?;
            
        // Login if required
        if !self.config.read_only {
            session.login(pkcs11::types::CKU_USER, Some(&self.config.pin))
                .map_err(|e| HSMError::LoginFailed(e.to_string()))?;
        }
        
        Ok(HSMSession {
            session,
            created_at: SystemTime::now(),
            last_used: SystemTime::now(),
            operation_count: 0,
            is_healthy: true,
        })
    }
    
    async fn is_session_healthy(&self, session: &HSMSession) -> Result<bool> {
        // Check session age
        let age = SystemTime::now().duration_since(session.created_at).unwrap_or_default();
        if age > Duration::from_hours(8) {
            return Ok(false);
        }
        
        // Check if session is still responsive
        match session.session.get_session_info() {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }
}
```

## Cloud HSM Integration

### AWS CloudHSM

```rust
use olocus_hsm::aws::*;
use rusoto_cloudhsmv2::{CloudHsmV2, CloudHsmV2Client};

pub struct AWSCloudHSM {
    client: CloudHsmV2Client,
    cluster_id: String,
    config: AWSCloudHSMConfig,
    connection_pool: ConnectionPool,
}

#[derive(Debug, Clone)]
pub struct AWSCloudHSMConfig {
    pub region: String,
    pub cluster_id: String,
    pub crypto_user: String,
    pub crypto_password: String,
    pub connection_timeout: Duration,
    pub max_connections: u32,
}

impl HSMBackend for AWSCloudHSM {
    async fn initialize(&mut self) -> Result<()> {
        // Verify cluster is active
        let cluster_info = self.client.describe_clusters(DescribeClustersRequest {
            filters: None,
            max_results: None,
            next_token: None,
        }).await.map_err(|e| HSMError::CloudHSMError(e.to_string()))?;
        
        let cluster = cluster_info.clusters
            .and_then(|clusters| clusters.into_iter()
                .find(|c| c.cluster_id.as_ref() == Some(&self.cluster_id)))
            .ok_or_else(|| HSMError::ClusterNotFound(self.cluster_id.clone()))?;
            
        if cluster.state != Some("ACTIVE".to_string()) {
            return Err(HSMError::ClusterNotActive {
                cluster_id: self.cluster_id.clone(),
                state: cluster.state.unwrap_or_else(|| "UNKNOWN".to_string()),
            });
        }
        
        // Initialize connection pool
        self.connection_pool = self.create_connection_pool().await?;
        
        Ok(())
    }
    
    async fn generate_key_pair(&self, key_spec: &KeySpec) -> Result<HSMKeyHandle> {
        let connection = self.connection_pool.acquire().await?;
        
        // Use CloudHSM's key generation commands
        let key_handle = match key_spec.algorithm {
            KeyAlgorithm::RSA(key_size) => {
                self.generate_rsa_key_aws(&connection, key_spec, key_size).await?
            },
            KeyAlgorithm::ECDSA(curve) => {
                self.generate_ec_key_aws(&connection, key_spec, curve).await?
            },
            _ => {
                return Err(HSMError::UnsupportedAlgorithm(key_spec.algorithm.clone()));
            }
        };
        
        self.connection_pool.release(connection).await;
        Ok(key_handle)
    }
    
    async fn sign(&self, key_handle: &HSMKeyHandle, data: &[u8]) -> Result<Vec<u8>> {
        let connection = self.connection_pool.acquire().await?;
        
        // Execute signing command on CloudHSM
        let sign_command = format!(
            "sign -m {} -k {}",
            hex::encode(data),
            key_handle.private_key_id
        );
        
        let result = connection.execute_command(&sign_command).await?;
        let signature = self.parse_signature_response(&result)?;
        
        self.connection_pool.release(connection).await;
        
        // Log operation
        self.log_cryptographic_operation(CryptoOperation {
            operation_type: OperationType::Sign,
            key_id: key_handle.key_id.clone(),
            algorithm: key_handle.algorithm.clone(),
            timestamp: SystemTime::now(),
            success: true,
        }).await?;
        
        Ok(signature)
    }
}
```

### Azure Key Vault

```rust
use olocus_hsm::azure::*;
use azure_security_keyvault::KeyvaultClient;

pub struct AzureKeyVault {
    client: KeyvaultClient,
    vault_url: String,
    config: AzureKeyVaultConfig,
}

#[derive(Debug, Clone)]
pub struct AzureKeyVaultConfig {
    pub vault_url: String,
    pub tenant_id: String,
    pub client_id: String,
    pub client_secret: String,
    pub hsm_enabled: bool,  // Use managed HSM or software keys
}

impl HSMBackend for AzureKeyVault {
    async fn initialize(&mut self) -> Result<()> {
        // Authenticate with Azure
        let credential = ClientSecretCredential::new(
            &self.config.tenant_id,
            &self.config.client_id,
            &self.config.client_secret,
            TokenCredentialOptions::default()
        );
        
        self.client = KeyvaultClient::new(&self.vault_url, Arc::new(credential))
            .map_err(|e| HSMError::AuthenticationFailed(e.to_string()))?;
            
        // Test connection
        let _ = self.client.get_keys().into_stream().next().await
            .ok_or(HSMError::ConnectionFailed("Unable to list keys".to_string()))??;
            
        Ok(())
    }
    
    async fn generate_key_pair(&self, key_spec: &KeySpec) -> Result<HSMKeyHandle> {
        let key_type = match key_spec.algorithm {
            KeyAlgorithm::RSA(size) => KeyType::Rsa { key_size: size as u32 },
            KeyAlgorithm::ECDSA(curve) => KeyType::Ec { curve: self.map_curve(curve)? },
            _ => return Err(HSMError::UnsupportedAlgorithm(key_spec.algorithm.clone())),
        };
        
        let key_name = format!("olocus-{}", key_spec.key_id);
        
        let create_request = CreateKeyOptions::new(key_name.clone(), key_type)
            .hsm(self.config.hsm_enabled)  // Use HSM if available
            .key_operations(vec![
                KeyOperation::Sign,
                KeyOperation::Verify,
            ])
            .attributes(
                KeyAttributes::new()
                    .enabled(true)
                    .expires_on(key_spec.expiry_date)
            );
            
        let created_key = self.client.create_key(&create_request).await
            .map_err(|e| HSMError::KeyGenerationFailed(e.to_string()))?;
            
        Ok(HSMKeyHandle {
            key_id: key_spec.key_id.clone(),
            algorithm: key_spec.algorithm.clone(),
            private_key_id: created_key.key().id().to_string(),
            public_key_id: created_key.key().id().to_string(), // Same in Azure KV
            created_at: SystemTime::now(),
            expires_at: key_spec.expiry_date,
            metadata: self.create_key_metadata(&created_key),
        })
    }
    
    async fn sign(&self, key_handle: &HSMKeyHandle, data: &[u8]) -> Result<Vec<u8>> {
        let algorithm = match key_handle.algorithm {
            KeyAlgorithm::RSA(_) => SignatureAlgorithm::RS256,
            KeyAlgorithm::ECDSA(ECCurve::P256) => SignatureAlgorithm::ES256,
            KeyAlgorithm::ECDSA(ECCurve::P384) => SignatureAlgorithm::ES384,
            _ => return Err(HSMError::UnsupportedAlgorithm(key_handle.algorithm.clone())),
        };
        
        // Hash the data (Azure KV expects pre-hashed data for some algorithms)
        let digest = match algorithm {
            SignatureAlgorithm::RS256 | SignatureAlgorithm::ES256 => {
                sha256::digest(data).as_bytes().to_vec()
            },
            SignatureAlgorithm::ES384 => {
                sha384::digest(data).as_bytes().to_vec()
            },
            _ => data.to_vec(),
        };
        
        let sign_request = SignRequest::new(algorithm, digest);
        
        let signature_result = self.client.sign(&key_handle.private_key_id, &sign_request).await
            .map_err(|e| HSMError::SigningFailed(e.to_string()))?;
            
        Ok(signature_result.signature().to_vec())
    }
}
```

## Key Management & Rotation

### Automated Key Rotation

```rust
use olocus_hsm::rotation::*;

pub struct KeyRotationManager {
    hsm: Arc<dyn HSMBackend>,
    rotation_config: KeyRotationConfig,
    key_registry: KeyRegistry,
    scheduler: TaskScheduler,
}

#[derive(Debug, Clone)]
pub struct KeyRotationConfig {
    pub enabled: bool,
    pub rotation_interval: Duration,
    pub retention_versions: u32,
    pub advance_warning: Duration,      // Notify before rotation
    pub overlap_period: Duration,       // Keep old key active during transition
    pub emergency_rotation: bool,       // Allow emergency rotation
}

impl KeyRotationManager {
    pub async fn schedule_rotation(&mut self, key_id: &str) -> Result<()> {
        let key_info = self.key_registry.get_key_info(key_id)
            .ok_or_else(|| HSMError::KeyNotFound(key_id.to_string()))?;
            
        let next_rotation = key_info.created_at + self.rotation_config.rotation_interval;
        
        // Schedule advance warning
        let warning_time = next_rotation - self.rotation_config.advance_warning;
        self.scheduler.schedule_task(warning_time, ScheduledTask::RotationWarning {
            key_id: key_id.to_string(),
            rotation_time: next_rotation,
        }).await?;
        
        // Schedule actual rotation
        self.scheduler.schedule_task(next_rotation, ScheduledTask::KeyRotation {
            key_id: key_id.to_string(),
        }).await?;
        
        Ok(())
    }
    
    pub async fn rotate_key(&mut self, key_id: &str) -> Result<KeyRotationResult> {
        let current_key = self.key_registry.get_key_info(key_id)
            .ok_or_else(|| HSMError::KeyNotFound(key_id.to_string()))?;
            
        // Generate new key with same algorithm
        let new_key_spec = KeySpec {
            key_id: format!("{}-v{}", key_id, current_key.version + 1),
            algorithm: current_key.algorithm.clone(),
            key_usage: current_key.key_usage.clone(),
            expiry_date: SystemTime::now() + self.rotation_config.rotation_interval,
        };
        
        let new_key_handle = self.hsm.generate_key_pair(&new_key_spec).await?;
        
        // Register new key
        self.key_registry.register_key(KeyInfo {
            key_id: new_key_spec.key_id.clone(),
            algorithm: new_key_spec.algorithm,
            key_handle: new_key_handle.clone(),
            version: current_key.version + 1,
            created_at: SystemTime::now(),
            status: KeyStatus::Active,
            predecessor: Some(key_id.to_string()),
        }).await?;
        
        // Mark old key as superseded but keep it active during overlap
        self.key_registry.update_key_status(key_id, KeyStatus::Superseded).await?;
        
        // Schedule old key deactivation after overlap period
        let deactivation_time = SystemTime::now() + self.rotation_config.overlap_period;
        self.scheduler.schedule_task(deactivation_time, ScheduledTask::DeactivateKey {
            key_id: key_id.to_string(),
        }).await?;
        
        // Schedule cleanup of old versions
        self.schedule_version_cleanup(&new_key_spec.key_id).await?;
        
        Ok(KeyRotationResult {
            old_key_id: key_id.to_string(),
            new_key_id: new_key_spec.key_id,
            new_key_handle,
            rotation_time: SystemTime::now(),
            overlap_until: deactivation_time,
        })
    }
    
    pub async fn emergency_rotate_key(&mut self, key_id: &str, reason: &str) -> Result<KeyRotationResult> {
        if !self.rotation_config.emergency_rotation {
            return Err(HSMError::EmergencyRotationDisabled);
        }
        
        // Log emergency rotation
        self.log_security_event(SecurityEvent {
            event_type: SecurityEventType::EmergencyKeyRotation,
            key_id: key_id.to_string(),
            reason: reason.to_string(),
            timestamp: SystemTime::now(),
            severity: SecuritySeverity::High,
        }).await?;
        
        // Perform immediate rotation with no overlap period
        let mut emergency_config = self.rotation_config.clone();
        emergency_config.overlap_period = Duration::ZERO;
        
        let result = self.rotate_key(key_id).await?;
        
        // Immediately revoke old key
        self.key_registry.update_key_status(key_id, KeyStatus::Revoked).await?;
        
        Ok(result)
    }
    
    async fn schedule_version_cleanup(&mut self, base_key_id: &str) -> Result<()> {
        // Find all versions of this key
        let all_versions = self.key_registry.get_key_versions(base_key_id).await?;
        
        if all_versions.len() > self.rotation_config.retention_versions as usize {
            // Sort by version number
            let mut sorted_versions = all_versions;
            sorted_versions.sort_by_key(|k| k.version);
            
            // Schedule cleanup of oldest versions beyond retention limit
            let to_cleanup = sorted_versions.len() - self.rotation_config.retention_versions as usize;
            for key_info in sorted_versions.into_iter().take(to_cleanup) {
                let cleanup_time = SystemTime::now() + Duration::from_hours(24); // Grace period
                
                self.scheduler.schedule_task(cleanup_time, ScheduledTask::CleanupKey {
                    key_id: key_info.key_id,
                }).await?;
            }
        }
        
        Ok(())
    }
}
```

### Key Versioning & History

```rust
pub struct KeyRegistry {
    storage: Arc<dyn KeyStorage>,
    version_cache: LruCache<String, Vec<KeyInfo>>,
}

#[derive(Debug, Clone)]
pub struct KeyInfo {
    pub key_id: String,
    pub algorithm: KeyAlgorithm,
    pub key_handle: HSMKeyHandle,
    pub version: u32,
    pub created_at: SystemTime,
    pub expires_at: SystemTime,
    pub status: KeyStatus,
    pub predecessor: Option<String>,      // Previous version
    pub successor: Option<String>,        // Next version
    pub usage_count: u64,
    pub last_used: Option<SystemTime>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum KeyStatus {
    Active,        // Currently in use
    Superseded,    // Replaced but still valid for verification
    Revoked,       // Compromised or invalid
    Archived,      // Old but kept for compliance
    Destroyed,     // Securely destroyed
}

impl KeyRegistry {
    pub async fn get_active_key(&self, base_key_id: &str) -> Option<KeyInfo> {
        let versions = self.get_key_versions(base_key_id).await.ok()?;
        
        versions.into_iter()
            .filter(|k| k.status == KeyStatus::Active)
            .max_by_key(|k| k.version)
    }
    
    pub async fn get_key_for_verification(&self, base_key_id: &str, signature_time: SystemTime) -> Option<KeyInfo> {
        let versions = self.get_key_versions(base_key_id).await.ok()?;
        
        // Find the key that was active at the time of signing
        versions.into_iter()
            .filter(|k| {
                k.created_at <= signature_time &&
                (k.status == KeyStatus::Active || k.status == KeyStatus::Superseded) &&
                signature_time < k.expires_at
            })
            .max_by_key(|k| k.version)
    }
    
    pub async fn record_key_usage(&mut self, key_id: &str) -> Result<()> {
        let mut key_info = self.storage.get_key_info(key_id).await?
            .ok_or_else(|| HSMError::KeyNotFound(key_id.to_string()))?;
            
        key_info.usage_count += 1;
        key_info.last_used = Some(SystemTime::now());
        
        self.storage.update_key_info(&key_info).await?;
        
        // Invalidate cache
        self.version_cache.remove(&self.extract_base_key_id(key_id));
        
        Ok(())
    }
}
```

## Health Monitoring & Compliance

### HSM Health Monitoring

```rust
use olocus_hsm::monitoring::*;

pub struct HSMHealthMonitor {
    hsm: Arc<dyn HSMBackend>,
    metrics: HSMMetrics,
    health_checks: Vec<HealthCheck>,
    alert_manager: AlertManager,
}

#[derive(Debug, Clone)]
pub struct HSMMetrics {
    pub operations_per_second: f64,
    pub average_latency: Duration,
    pub error_rate: f64,
    pub session_utilization: f64,
    pub key_generation_rate: f64,
    pub signing_operations: u64,
    pub verification_operations: u64,
    pub failed_operations: u64,
    pub uptime: Duration,
    pub last_health_check: SystemTime,
}

impl HSMHealthMonitor {
    pub async fn perform_health_check(&mut self) -> HealthCheckResult {
        let mut results = Vec::new();
        let start_time = SystemTime::now();
        
        // Basic connectivity check
        let connectivity = self.check_connectivity().await;
        results.push(connectivity);
        
        // Performance check
        let performance = self.check_performance().await;
        results.push(performance);
        
        // Capacity check
        let capacity = self.check_capacity().await;
        results.push(capacity);
        
        // Security check
        let security = self.check_security().await;
        results.push(security);
        
        // FIPS compliance check
        let compliance = self.check_fips_compliance().await;
        results.push(compliance);
        
        let overall_status = if results.iter().all(|r| r.status == CheckStatus::Healthy) {
            HealthStatus::Healthy
        } else if results.iter().any(|r| r.status == CheckStatus::Critical) {
            HealthStatus::Critical
        } else {
            HealthStatus::Degraded
        };
        
        let duration = SystemTime::now().duration_since(start_time).unwrap_or_default();
        
        HealthCheckResult {
            overall_status,
            individual_checks: results,
            check_duration: duration,
            timestamp: SystemTime::now(),
        }
    }
    
    async fn check_connectivity(&self) -> HealthCheckItem {
        match self.hsm.get_info().await {
            Ok(info) => HealthCheckItem {
                name: "connectivity".to_string(),
                status: CheckStatus::Healthy,
                message: format!("HSM {} is reachable", info.label),
                metric_value: Some(1.0),
            },
            Err(e) => HealthCheckItem {
                name: "connectivity".to_string(),
                status: CheckStatus::Critical,
                message: format!("HSM unreachable: {}", e),
                metric_value: Some(0.0),
            }
        }
    }
    
    async fn check_performance(&self) -> HealthCheckItem {
        // Perform a test signing operation to measure latency
        let test_key = self.get_test_key().await;
        let test_data = b"health check test data";
        
        let start = SystemTime::now();
        let result = self.hsm.sign(&test_key, test_data).await;
        let latency = SystemTime::now().duration_since(start).unwrap_or_default();
        
        let status = match result {
            Ok(_) => {
                if latency < Duration::from_millis(100) {
                    CheckStatus::Healthy
                } else if latency < Duration::from_millis(500) {
                    CheckStatus::Warning
                } else {
                    CheckStatus::Critical
                }
            },
            Err(_) => CheckStatus::Critical,
        };
        
        HealthCheckItem {
            name: "performance".to_string(),
            status,
            message: format!("Signing latency: {:?}", latency),
            metric_value: Some(latency.as_millis() as f64),
        }
    }
    
    async fn check_fips_compliance(&self) -> HealthCheckItem {
        // Check FIPS mode status
        match self.hsm.get_fips_status().await {
            Ok(fips_info) => {
                if fips_info.fips_mode_enabled {
                    HealthCheckItem {
                        name: "fips_compliance".to_string(),
                        status: CheckStatus::Healthy,
                        message: format!("FIPS {} mode active", fips_info.level),
                        metric_value: Some(1.0),
                    }
                } else {
                    HealthCheckItem {
                        name: "fips_compliance".to_string(),
                        status: CheckStatus::Warning,
                        message: "FIPS mode not enabled".to_string(),
                        metric_value: Some(0.0),
                    }
                }
            },
            Err(e) => HealthCheckItem {
                name: "fips_compliance".to_string(),
                status: CheckStatus::Critical,
                message: format!("Cannot determine FIPS status: {}", e),
                metric_value: Some(0.0),
            }
        }
    }
}
```

### Compliance Reporting

```rust
use olocus_hsm::compliance::*;

pub struct ComplianceManager {
    hsm: Arc<dyn HSMBackend>,
    audit_log: AuditLog,
    compliance_framework: ComplianceFramework,
}

#[derive(Debug, Clone)]
pub enum ComplianceFramework {
    FIPS140_2(FIPS140Level),
    CommonCriteria(CCLevel),
    PCI_DSS,
    SOC2,
    FISMA,
}

#[derive(Debug, Clone)]
pub enum FIPS140Level {
    Level1,  // Software cryptographic module
    Level2,  // Tamper-evident hardware
    Level3,  // Tamper-resistant hardware
    Level4,  // Complete protection envelope
}

impl ComplianceManager {
    pub async fn generate_compliance_report(&self) -> Result<ComplianceReport> {
        let report_period_start = SystemTime::now() - Duration::from_days(30);
        let report_period_end = SystemTime::now();
        
        // Collect audit events
        let audit_events = self.audit_log.get_events_in_range(
            report_period_start,
            report_period_end
        ).await?;
        
        // Analyze compliance metrics
        let compliance_metrics = self.analyze_compliance_metrics(&audit_events)?;
        
        // Check for violations
        let violations = self.detect_compliance_violations(&audit_events)?;
        
        // Generate recommendations
        let recommendations = self.generate_compliance_recommendations(&violations)?;
        
        Ok(ComplianceReport {
            framework: self.compliance_framework.clone(),
            report_period: (report_period_start, report_period_end),
            metrics: compliance_metrics,
            violations: violations,
            recommendations: recommendations,
            hsm_info: self.hsm.get_info().await?,
            generated_at: SystemTime::now(),
        })
    }
    
    fn analyze_compliance_metrics(&self, events: &[AuditEvent]) -> Result<ComplianceMetrics> {
        let mut metrics = ComplianceMetrics::default();
        
        // Count different types of operations
        for event in events {
            match &event.event_type {
                AuditEventType::KeyGeneration => metrics.key_generations += 1,
                AuditEventType::CryptographicOperation(op) => {
                    match op.operation_type {
                        OperationType::Sign => metrics.signing_operations += 1,
                        OperationType::Verify => metrics.verification_operations += 1,
                        OperationType::Encrypt => metrics.encryption_operations += 1,
                        OperationType::Decrypt => metrics.decryption_operations += 1,
                    }
                },
                AuditEventType::KeyAccess => metrics.key_access_events += 1,
                AuditEventType::SecurityViolation => metrics.security_violations += 1,
                _ => {}
            }
            
            // Track failed operations
            if !event.success {
                metrics.failed_operations += 1;
            }
        }
        
        // Calculate compliance scores
        metrics.availability_score = self.calculate_availability_score(events)?;
        metrics.integrity_score = self.calculate_integrity_score(events)?;
        metrics.confidentiality_score = self.calculate_confidentiality_score(events)?;
        
        Ok(metrics)
    }
    
    fn detect_compliance_violations(&self, events: &[AuditEvent]) -> Result<Vec<ComplianceViolation>> {
        let mut violations = Vec::new();
        
        match &self.compliance_framework {
            ComplianceFramework::FIPS140_2(level) => {
                violations.extend(self.check_fips_140_violations(events, level)?);
            },
            ComplianceFramework::CommonCriteria(level) => {
                violations.extend(self.check_cc_violations(events, level)?);
            },
            ComplianceFramework::PCI_DSS => {
                violations.extend(self.check_pci_violations(events)?);
            },
            _ => {}
        }
        
        Ok(violations)
    }
    
    fn check_fips_140_violations(&self, events: &[AuditEvent], level: &FIPS140Level) -> Result<Vec<ComplianceViolation>> {
        let mut violations = Vec::new();
        
        // Check for unapproved algorithms
        for event in events {
            if let AuditEventType::CryptographicOperation(op) = &event.event_type {
                if !self.is_fips_approved_algorithm(&op.algorithm) {
                    violations.push(ComplianceViolation {
                        violation_type: ViolationType::UnapprovedAlgorithm,
                        description: format!("Use of non-FIPS approved algorithm: {:?}", op.algorithm),
                        severity: ViolationSeverity::High,
                        timestamp: event.timestamp,
                        remediation: "Replace with FIPS-approved algorithm".to_string(),
                    });
                }
            }
        }
        
        // Check for tamper detection (Level 2+)
        if matches!(level, FIPS140Level::Level2 | FIPS140Level::Level3 | FIPS140Level::Level4) {
            let tamper_events: Vec<_> = events.iter()
                .filter(|e| matches!(e.event_type, AuditEventType::TamperDetection))
                .collect();
                
            if tamper_events.is_empty() {
                violations.push(ComplianceViolation {
                    violation_type: ViolationType::MissingTamperDetection,
                    description: "No tamper detection events logged".to_string(),
                    severity: ViolationSeverity::Medium,
                    timestamp: SystemTime::now(),
                    remediation: "Verify tamper detection is functioning".to_string(),
                });
            }
        }
        
        Ok(violations)
    }
}
```

## Integration Examples

### Enterprise Key Management

```rust
use olocus_hsm::enterprise::*;

pub struct EnterpriseKeyManager {
    hsm_pool: HSMPool,
    key_policies: PolicyManager,
    compliance_manager: ComplianceManager,
    backup_manager: BackupManager,
}

impl EnterpriseKeyManager {
    pub async fn generate_application_key(
        &mut self,
        app_id: &str,
        key_policy: &KeyPolicy
    ) -> Result<ApplicationKeyInfo> {
        
        // Validate policy compliance
        self.key_policies.validate_policy(key_policy)?;
        
        // Select appropriate HSM based on policy requirements
        let hsm = self.hsm_pool.select_hsm_for_policy(key_policy).await?;
        
        // Generate key according to policy
        let key_spec = KeySpec {
            key_id: format!("app-{}-{}", app_id, Uuid::new_v4()),
            algorithm: key_policy.required_algorithm.clone(),
            key_usage: key_policy.allowed_operations.clone(),
            expiry_date: SystemTime::now() + key_policy.rotation_interval,
        };
        
        let key_handle = hsm.generate_key_pair(&key_spec).await?;
        
        // Register key with enterprise registry
        let app_key = ApplicationKeyInfo {
            app_id: app_id.to_string(),
            key_info: KeyInfo {
                key_id: key_spec.key_id.clone(),
                algorithm: key_spec.algorithm,
                key_handle: key_handle.clone(),
                version: 1,
                created_at: SystemTime::now(),
                status: KeyStatus::Active,
                predecessor: None,
                successor: None,
                usage_count: 0,
                last_used: None,
                expires_at: key_spec.expiry_date,
            },
            policy: key_policy.clone(),
            compliance_tags: self.generate_compliance_tags(&key_policy),
        };
        
        self.register_application_key(&app_key).await?;
        
        // Schedule automatic rotation
        self.schedule_key_rotation(&app_key.key_info.key_id, key_policy.rotation_interval).await?;
        
        // Create backup if required by policy
        if key_policy.backup_required {
            self.backup_manager.create_key_backup(&key_handle).await?;
        }
        
        Ok(app_key)
    }
    
    pub async fn sign_with_policy_enforcement(
        &mut self,
        app_id: &str,
        data: &[u8],
        context: &OperationContext
    ) -> Result<SignatureResult> {
        
        // Get application key
        let app_key = self.get_active_application_key(app_id).await?
            .ok_or_else(|| HSMError::ApplicationKeyNotFound(app_id.to_string()))?;
            
        // Check policy compliance for this operation
        self.key_policies.check_operation_allowed(&app_key.policy, context)?;
        
        // Check compliance requirements
        self.compliance_manager.verify_operation_compliance(context).await?;
        
        // Perform the signing operation
        let hsm = self.hsm_pool.get_hsm_for_key(&app_key.key_info.key_handle).await?;
        let signature = hsm.sign(&app_key.key_info.key_handle, data).await?;
        
        // Record usage for compliance
        self.record_key_usage(&app_key.key_info.key_id, context).await?;
        
        // Update usage statistics
        self.update_key_usage_stats(&app_key.key_info.key_id).await?;
        
        Ok(SignatureResult {
            signature,
            key_id: app_key.key_info.key_id,
            algorithm: app_key.key_info.algorithm,
            timestamp: SystemTime::now(),
            compliance_metadata: self.create_compliance_metadata(context),
        })
    }
}
```

## Related Documentation

- [Trust Networks](./trust-networks.md) - HSM-backed trust relationships
- [Keystore](./keystore.md) - Mobile key management integration
- [Post-Quantum Cryptography](./post-quantum.md) - PQC algorithms in HSMs
- [Device Integrity](./device-integrity.md) - Device attestation with HSMs
- [Formal Verification](/architecture/formal-verification.md) - HSM protocol verification