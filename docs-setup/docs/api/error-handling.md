---
id: error-handling
title: Error Handling
sidebar_position: 4
---

# Error Handling

The Olocus Protocol uses a comprehensive error handling system with standardized error codes, structured error types, and recovery patterns. This document covers all error types, handling strategies, and best practices.

## Error Architecture

The protocol uses a hierarchical error code system:

- **Core Protocol (0-49)**: Fundamental protocol errors
- **Measurement System (50-99)**: Universal Measurement Foundation errors  
- **Extensions (100+)**: Extension-specific error ranges
- **Reserved Ranges**: Standardized allocation for consistency

## Core Protocol Errors

### Basic Protocol Errors (0-12)

```rust
use olocus_core::{Error, Result};

// Core verification errors
match verify_block(&block, Some(&previous)) {
    Err(Error::BrokenChain) => {
        println!("Previous hash mismatch - chain integrity violated");
    }
    Err(Error::InvalidSignature) => {
        println!("Cryptographic signature verification failed");
    }
    Err(Error::PayloadMismatch) => {
        println!("Payload hash doesn't match computed hash");
    }
    Err(Error::InvalidIndex) => {
        println!("Block index is not sequential");
    }
    Err(Error::TimestampRegression) => {
        println!("Block timestamp is earlier than previous block");
    }
    Err(Error::MalformedBlock) => {
        println!("Block data is corrupted or unparseable");
    }
    Ok(()) => println!("Block verification successful"),
}
```

### Extended Core Errors (8-49)

```rust
// Payload validation errors
match Block::genesis(large_payload, &key, timestamp) {
    Err(Error::PayloadTooLarge) => {
        println!("Payload exceeds maximum size limit");
    }
    Err(Error::UnknownPayloadType(type_id)) => {
        println!("Payload type {} is not registered", type_id);
    }
    Ok(block) => println!("Block created successfully"),
}

// Timestamp validation errors
match validate_block_timestamp(timestamp) {
    Err(Error::TimestampTooFuture) => {
        println!("Block timestamp is too far in the future");
    }
    Err(Error::TimestampTooOld) => {
        println!("Block timestamp is too old to accept");
    }
    Ok(()) => println!("Timestamp valid"),
}
```

### Plugin System Errors

```rust
use olocus_core::plugin::PluginRegistry;

let mut registry = PluginRegistry::new();

match registry.register_payload_type(0x1001, "my-extension") {
    Err(Error::PayloadTypeConflict(type_id)) => {
        println!("Payload type {} already registered", type_id);
    }
    Err(Error::PluginConflict(name)) => {
        println!("Plugin '{}' is already registered", name);
    }
    Ok(()) => println!("Plugin registered successfully"),
}

// Plugin lookup errors
match registry.get_plugin("nonexistent") {
    Err(Error::PluginNotFound(name)) => {
        println!("Plugin '{}' not found", name);
    }
    Ok(plugin) => println!("Plugin found"),
}
```

## Algorithm Negotiation Errors

Security-focused errors for the algorithm negotiation system:

```rust
use olocus_core::algorithm_negotiation::*;

// Negotiation security errors
match negotiate_algorithms(&preferences, &peer_preferences) {
    Err(Error::DowngradeAttemptDetected) => {
        println!("SECURITY ALERT: Peer attempting downgrade attack");
        // Should disconnect and blacklist peer
    }
    Err(Error::NoCommonAlgorithm) => {
        println!("No mutually supported algorithms found");
    }
    Err(Error::PeerSecurityTooLow) => {
        println!("Peer security level below minimum requirements");
    }
    Err(Error::PostQuantumRequired) => {
        println!("Post-quantum algorithms required but not supported by peer");
    }
    Ok(negotiated) => {
        println!("Algorithm negotiation successful");
    }
}

// Preference validation errors
match validate_algorithm_preferences(&signed_prefs) {
    Err(Error::PreferencesTooOld(age)) => {
        println!("Algorithm preferences are {} seconds old", age);
    }
    Err(Error::PreferencesFromFuture) => {
        println!("Algorithm preferences have future timestamp");
    }
    Err(Error::InvalidSignature) => {
        println!("Preference signature verification failed");
    }
    Ok(()) => println!("Preferences valid"),
}
```

## Measurement System Errors (50-99)

Errors from the Universal Measurement Foundation:

```rust
use olocus_core::measure::{MeasurementError, Value, Coordinate, Uncertainty};

// Value validation errors
match Value::point2d(91.0, 181.0) { // Invalid coordinates
    Err(MeasurementError::ValueOutOfRange { min, max, actual }) => {
        println!("Coordinate {} out of range [{}, {}]", actual, min, max);
    }
    Ok(value) => println!("Valid coordinate"),
}

// Coordinate validation
match Coordinate::validate(1000000000, 0) { // > 90 degrees
    Err(MeasurementError::ValueOutOfRange { .. }) => {
        println!("Latitude exceeds valid range");
    }
    Ok(()) => println!("Coordinates valid"),
}

// Uncertainty validation
let invalid_confidence = 1.5; // > 1.0
match Uncertainty::confidence(invalid_confidence) {
    // This creates a valid Uncertainty but clips to 1.0
    uncertainty => {
        if uncertainty.to_confidence() != invalid_confidence {
            println!("Confidence value was clamped to valid range");
        }
    }
}

// Measurement expiry
match measurement.validity.is_valid_at(future_time) {
    false => {
        return Err(MeasurementError::Expired {
            valid_until: measurement.validity.valid_until.unwrap(),
            now: future_time,
        });
    }
    true => println!("Measurement still valid"),
}
```

### Provenance Errors

```rust
use olocus_core::measure::{Provenance, AttestationClaim};

// Circular provenance detection
match validate_provenance_chain(&measurement) {
    Err(MeasurementError::CircularProvenance) => {
        println!("Circular dependency in provenance chain detected");
    }
    Err(MeasurementError::InvalidTransformationChain) => {
        println!("Transformation chain is invalid or broken");
    }
    Ok(()) => println!("Provenance chain valid"),
}

// Attestation verification
match verify_attestation(&attestation, &measurement_hash) {
    Err(MeasurementError::AttestationVerificationFailed { attestor }) => {
        println!("Attestation from {:?} failed verification", attestor);
    }
    Ok(()) => println!("Attestation verified"),
}
```

## Extension Error Ranges

Extensions use standardized error code ranges:

### Location Extension (100-199)

```rust
// Example location errors (would be in olocus-location crate)
#[derive(Error, Debug)]
pub enum LocationError {
    #[error("GPS signal lost")]
    GpsSignalLost,
    
    #[error("Location spoofing detected")]
    SpoofingDetected,
    
    #[error("Insufficient satellites: {count} (need 4+)")]
    InsufficientSatellites { count: u8 },
    
    #[error("Clustering failed: {reason}")]
    ClusteringFailed { reason: String },
}
```

### Trust Extension (200-299)

```rust
// Example trust errors (would be in olocus-trust crate)
#[derive(Error, Debug)]
pub enum TrustError {
    #[error("Trust score too low: {score} < {threshold}")]
    TrustTooLow { score: f64, threshold: f64 },
    
    #[error("Reputation not found for peer: {peer_id:?}")]
    ReputationNotFound { peer_id: [u8; 32] },
    
    #[error("DID verification failed")]
    DidVerificationFailed,
}
```

### HSM Extension (1000-1099)

```rust
// Example HSM errors (would be in olocus-hsm crate)  
#[derive(Error, Debug)]
pub enum HsmError {
    #[error("HSM not available")]
    HsmNotAvailable,
    
    #[error("Key not found in HSM: {key_id}")]
    KeyNotFound { key_id: String },
    
    #[error("HSM session pool exhausted")]
    SessionPoolExhausted,
    
    #[error("PKCS#11 error: {code}")]
    Pkcs11Error { code: u32 },
}
```

## Error Handling Patterns

### Basic Error Handling

```rust
use olocus_core::{Error, Result};

fn process_block<P: BlockPayload>(block: &Block<P>) -> Result<()> {
    // Validate block
    verify_block(block, None)?;
    
    // Process payload
    match block.payload.payload_type() {
        0x0100 => process_location_payload(&block.payload)?,
        0x0200 => process_sensor_payload(&block.payload)?,
        unknown => return Err(Error::UnknownPayloadType(unknown)),
    }
    
    Ok(())
}
```

### Error Recovery

```rust
fn robust_block_verification<P: BlockPayload>(
    block: &Block<P>,
    previous: Option<&Block<P>>
) -> Result<()> {
    match verify_block(block, previous) {
        // Recoverable errors - could retry or use fallback
        Err(Error::TimestampTooFuture) => {
            println!("Block from future - queuing for later processing");
            queue_for_later_processing(block.clone());
            Ok(())
        }
        
        // Security errors - reject immediately
        Err(Error::InvalidSignature) => {
            println!("Invalid signature - rejecting block permanently");
            Err(Error::InvalidSignature)
        }
        
        Err(Error::BrokenChain) => {
            println!("Chain broken - may need chain reorganization");
            attempt_chain_reorg(block)
        }
        
        // Success
        Ok(()) => Ok(()),
        
        // Other errors - propagate
        Err(e) => Err(e),
    }
}
```

### Error Context and Logging

```rust
use log::{error, warn, info, debug};

fn detailed_error_handling<P: BlockPayload>(result: Result<Block<P>>) {
    match result {
        Ok(block) => {
            info!("Block {} processed successfully", block.header.index);
        }
        Err(Error::InvalidSignature) => {
            error!("SECURITY: Invalid signature detected - possible attack");
            // Could trigger security alerts
        }
        Err(Error::BrokenChain) => {
            warn!("Chain integrity issue - investigating");
            // Could trigger chain analysis
        }
        Err(Error::TimestampTooOld) => {
            debug!("Block too old - likely stale data");
            // Could update sync status
        }
        Err(e) => {
            error!("Unexpected error processing block: {}", e);
            // Could trigger system health check
        }
    }
}
```

### Error Aggregation

```rust
use std::collections::HashMap;

#[derive(Debug)]
pub struct ErrorSummary {
    pub total_errors: usize,
    pub error_counts: HashMap<String, usize>,
    pub last_error: Option<Error>,
}

impl ErrorSummary {
    pub fn new() -> Self {
        Self {
            total_errors: 0,
            error_counts: HashMap::new(),
            last_error: None,
        }
    }
    
    pub fn record_error(&mut self, error: Error) {
        let error_type = format!("{:?}", error);
        *self.error_counts.entry(error_type).or_insert(0) += 1;
        self.total_errors += 1;
        self.last_error = Some(error);
    }
    
    pub fn most_common_error(&self) -> Option<&String> {
        self.error_counts
            .iter()
            .max_by_key(|(_, count)| *count)
            .map(|(error_type, _)| error_type)
    }
}

// Usage
fn process_blocks<P: BlockPayload>(blocks: &[Block<P>]) -> ErrorSummary {
    let mut errors = ErrorSummary::new();
    
    for block in blocks {
        if let Err(e) = verify_block(block, None) {
            errors.record_error(e);
        }
    }
    
    errors
}
```

## Error Conversion and Interop

### Converting Between Error Types

```rust
use thiserror::Error;

// Custom error type that can contain protocol errors
#[derive(Error, Debug)]
pub enum AppError {
    #[error("Protocol error: {0}")]
    Protocol(#[from] Error),
    
    #[error("Measurement error: {0}")]
    Measurement(#[from] MeasurementError),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Database error: {message}")]
    Database { message: String },
}

// Conversion functions
impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Protocol(Error::MalformedBlock)
    }
}
```

### Error Serialization

```rust
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct SerializableError {
    pub error_type: String,
    pub message: String,
    pub code: Option<u32>,
    pub context: Option<String>,
}

impl From<Error> for SerializableError {
    fn from(error: Error) -> Self {
        let (error_type, code) = match &error {
            Error::InvalidSignature => ("InvalidSignature", Some(6)),
            Error::BrokenChain => ("BrokenChain", Some(2)),
            Error::MalformedBlock => ("MalformedBlock", Some(7)),
            Error::UnknownPayloadType(t) => ("UnknownPayloadType", Some(*t)),
            _ => ("Other", None),
        };
        
        Self {
            error_type: error_type.to_string(),
            message: error.to_string(),
            code,
            context: None,
        }
    }
}

// For HTTP APIs
fn error_to_http_status(error: &Error) -> (u16, SerializableError) {
    let serializable = error.clone().into();
    
    let status_code = match error {
        Error::InvalidSignature => 400, // Bad Request
        Error::BrokenChain => 409,      // Conflict
        Error::MalformedBlock => 400,   // Bad Request
        Error::PayloadTooLarge => 413,  // Payload Too Large
        Error::UnknownPayloadType(_) => 422, // Unprocessable Entity
        _ => 500, // Internal Server Error
    };
    
    (status_code, serializable)
}
```

## Testing Error Conditions

### Unit Tests for Error Handling

```rust
#[cfg(test)]
mod error_tests {
    use super::*;
    
    #[test]
    fn test_invalid_signature_error() {
        let (key1, _) = generate_key();
        let (key2, _) = generate_key(); 
        
        // Create block with key1, try to verify with key2
        let block = Block::genesis(EmptyPayload, &key1, current_timestamp());
        
        // This should fail with InvalidSignature
        match verify_block(&block, None) {
            Err(Error::InvalidSignature) => {
                // Expected
            }
            other => panic!("Expected InvalidSignature, got {:?}", other),
        }
    }
    
    #[test]
    fn test_broken_chain_error() {
        let key = generate_key();
        let block1 = Block::genesis(EmptyPayload, &key, current_timestamp());
        let mut block2 = Block::next(&block1, EmptyPayload, &key, current_timestamp()).unwrap();
        
        // Corrupt the previous hash
        block2.header.previous = [0u8; 32];
        
        match verify_block(&block2, Some(&block1)) {
            Err(Error::BrokenChain) => {
                // Expected
            }
            other => panic!("Expected BrokenChain, got {:?}", other),
        }
    }
    
    #[test]
    fn test_error_serialization() {
        let error = Error::UnknownPayloadType(0x1234);
        let serializable: SerializableError = error.into();
        
        assert_eq!(serializable.error_type, "UnknownPayloadType");
        assert_eq!(serializable.code, Some(0x1234));
        
        let json = serde_json::to_string(&serializable).unwrap();
        let deserialized: SerializableError = serde_json::from_str(&json).unwrap();
        assert_eq!(serializable.error_type, deserialized.error_type);
    }
}
```

### Integration Tests

```rust
#[tokio::test]
async fn test_error_recovery_in_chain_processing() {
    let blocks = create_test_chain_with_errors(); // Some valid, some invalid
    let mut processed = 0;
    let mut errors = ErrorSummary::new();
    
    for block in blocks {
        match process_block(&block).await {
            Ok(()) => processed += 1,
            Err(e) => errors.record_error(e),
        }
    }
    
    // Should have processed some blocks despite errors
    assert!(processed > 0);
    assert!(errors.total_errors > 0);
    
    // Most common error should be predictable
    if let Some(common_error) = errors.most_common_error() {
        println!("Most common error: {}", common_error);
    }
}
```

## Error Monitoring and Metrics

### Error Rate Monitoring

```rust
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct ErrorMetrics {
    total_operations: Arc<AtomicU64>,
    total_errors: Arc<AtomicU64>,
    signature_errors: Arc<AtomicU64>,
    chain_errors: Arc<AtomicU64>,
    malformed_errors: Arc<AtomicU64>,
}

impl ErrorMetrics {
    pub fn new() -> Self {
        Self {
            total_operations: Arc::new(AtomicU64::new(0)),
            total_errors: Arc::new(AtomicU64::new(0)),
            signature_errors: Arc::new(AtomicU64::new(0)),
            chain_errors: Arc::new(AtomicU64::new(0)),
            malformed_errors: Arc::new(AtomicU64::new(0)),
        }
    }
    
    pub fn record_operation(&self, result: &Result<()>) {
        self.total_operations.fetch_add(1, Ordering::Relaxed);
        
        if let Err(error) = result {
            self.total_errors.fetch_add(1, Ordering::Relaxed);
            
            match error {
                Error::InvalidSignature => {
                    self.signature_errors.fetch_add(1, Ordering::Relaxed);
                }
                Error::BrokenChain => {
                    self.chain_errors.fetch_add(1, Ordering::Relaxed);
                }
                Error::MalformedBlock => {
                    self.malformed_errors.fetch_add(1, Ordering::Relaxed);
                }
                _ => {}
            }
        }
    }
    
    pub fn error_rate(&self) -> f64 {
        let total = self.total_operations.load(Ordering::Relaxed) as f64;
        let errors = self.total_errors.load(Ordering::Relaxed) as f64;
        
        if total == 0.0 { 0.0 } else { errors / total }
    }
}
```

### Health Checks

```rust
#[derive(Debug)]
pub struct SystemHealth {
    pub error_rate: f64,
    pub recent_errors: Vec<Error>,
    pub status: HealthStatus,
}

#[derive(Debug, PartialEq)]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
}

impl SystemHealth {
    pub fn assess(metrics: &ErrorMetrics) -> Self {
        let error_rate = metrics.error_rate();
        
        let status = if error_rate < 0.01 {
            HealthStatus::Healthy
        } else if error_rate < 0.05 {
            HealthStatus::Degraded
        } else {
            HealthStatus::Unhealthy
        };
        
        Self {
            error_rate,
            recent_errors: vec![], // Would be populated with recent errors
            status,
        }
    }
}
```

## Best Practices

### Error Handling Guidelines

1. **Always Handle Errors**: Never ignore `Result` types
2. **Fail Fast**: Detect and report errors early
3. **Provide Context**: Include relevant information in error messages
4. **Log Appropriately**: Use appropriate log levels for different error types
5. **Monitor Metrics**: Track error rates and patterns
6. **Test Error Paths**: Ensure error handling code is tested

### Security Considerations

```rust
// DON'T: Log sensitive information
fn bad_error_handling(key: &[u8; 32], error: Error) {
    log::error!("Failed to sign with key {:?}: {}", key, error);
}

// DO: Log safely without exposing secrets
fn good_error_handling(error: Error) {
    log::error!("Signing operation failed: {}", error);
}

// DON'T: Expose internal details in public errors
fn bad_public_error() -> Result<(), String> {
    Err("Database connection failed: postgresql://user:pass@internal-db:5432/prod".to_string())
}

// DO: Provide safe error information
fn good_public_error() -> Result<(), Error> {
    Err(Error::MalformedBlock)
}
```

### Error Recovery Strategies

```rust
use std::time::Duration;
use tokio::time::{sleep, timeout};

async fn retry_with_backoff<T, F, Fut>(
    mut operation: F,
    max_retries: usize,
    base_delay: Duration,
) -> Result<T>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T>>,
{
    let mut delay = base_delay;
    
    for attempt in 0..max_retries {
        match timeout(Duration::from_secs(30), operation()).await {
            Ok(Ok(result)) => return Ok(result),
            Ok(Err(Error::InvalidSignature)) => {
                // Security error - don't retry
                return Err(Error::InvalidSignature);
            }
            Ok(Err(Error::PayloadTooLarge)) => {
                // Permanent error - don't retry
                return Err(Error::PayloadTooLarge);
            }
            Ok(Err(_)) | Err(_) => {
                // Potentially transient error - retry with backoff
                if attempt < max_retries - 1 {
                    log::warn!("Operation failed, retrying in {:?} (attempt {})", delay, attempt + 1);
                    sleep(delay).await;
                    delay *= 2; // Exponential backoff
                }
            }
        }
    }
    
    Err(Error::MalformedBlock) // Generic failure after retries
}
```

## See Also

- [Core API Overview](./core) - Protocol fundamentals
- [Block Operations API](./block-operations) - Block handling
- [Measurement API](./measurement-api) - Measurement system errors  
- [Wire Format API](./wire-format-api) - Encoding/decoding errors
