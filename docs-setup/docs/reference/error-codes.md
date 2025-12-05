---
id: error-codes
title: Error Codes
sidebar_position: 1
---

# Error Codes

This reference provides a complete list of error codes used throughout Olocus Protocol. Error codes are organized by module and range, making them easy to identify and handle in applications.

## Error Code Organization

Error codes are organized into ranges by module:

- **Core Protocol (0-99)**: Basic protocol operations
- **Extensions (1000-1999)**: Extension-specific errors  
- **Reserved (2000+)**: Future use

## Core Protocol Errors (0-99)

### Basic Protocol Errors (0-12)

| Code | Error | Description | Recovery |
|------|-------|-------------|----------|
| 0 | `Ok` | No error (success) | Continue |
| 1 | `VersionMismatch` | Protocol version incompatibility | Upgrade or downgrade |
| 2 | `BrokenChain` | Previous hash mismatch in chain | Rebuild from valid point |
| 3 | `InvalidIndex` | Non-sequential block index | Fix indexing |
| 4 | `TimestampRegression` | Block timestamp went backward | Correct system time |
| 5 | `PayloadMismatch` | Payload hash doesn't match content | Re-create block |
| 6 | `InvalidSignature` | Signature verification failed | Re-sign block |
| 7 | `MalformedBlock` | Block cannot be parsed | Fix encoding |
| 8 | `UnknownPayloadType` | Payload type not recognized | Register type or update |
| 9 | `PayloadTooLarge` | Payload exceeds size limit | Reduce payload size |
| 10 | `TimestampTooFuture` | Timestamp exceeds future drift | Correct system time |
| 11 | `TimestampTooOld` | Timestamp exceeds max age | Use recent timestamp |
| 12 | `ForkTooDeep` | Reorganization depth exceeded | Limit fork depth |

### Plugin System Errors (13-19)

| Code | Error | Description | Recovery |
|------|-------|-------------|----------|
| 13 | `PluginConflict` | Multiple plugins claim same feature | Remove conflicting plugins |
| 14 | `PayloadTypeConflict` | Payload type already registered | Use different type ID |
| 15 | `PluginNotFound` | Required plugin not available | Install missing plugin |
| 16 | `LockPoisoned` | Internal lock was poisoned | Restart application |

### Extension Negotiation Errors (20-29)

| Code | Error | Description | Recovery |
|------|-------|-------------|----------|
| 20 | `UnsupportedVersion` | Extension version not supported | Upgrade extension |
| 21 | `NegotiationIncomplete` | Extension negotiation not finished | Complete negotiation |
| 22 | `InvalidNegotiationState` | Negotiation in wrong state | Reset negotiation |
| 23 | `MandatoryExtensionMissing` | Required extension not available | Install extension |
| 24 | `InvalidVersion` | Version string format invalid | Fix version format |

### Algorithm Negotiation Errors (30-49)

| Code | Error | Description | Recovery |
|------|-------|-------------|----------|
| 30 | `PreferencesTooOld` | Algorithm preferences expired | Refresh preferences |
| 31 | `PreferencesFromFuture` | Preferences have future timestamp | Check system time |
| 32 | `NoCommonAlgorithm` | No mutually supported algorithms | Update algorithm list |
| 33 | `AlgorithmNotSupported` | Requested algorithm unavailable | Use supported algorithm |
| 34 | `PeerSecurityTooLow` | Peer security level insufficient | Upgrade peer |
| 35 | `RequiredAlgorithmMissing` | Mandatory algorithm not offered | Add required algorithm |
| 36 | `PostQuantumRequired` | Post-quantum algorithm mandated | Use PQ algorithms |
| 37 | `UnknownAlgorithm` | Algorithm ID not recognized | Update algorithm registry |
| 38 | `InsufficientSecurityLevel` | Security level below minimum | Use stronger algorithms |
| 39 | `SerializationError` | Cannot serialize preferences | Fix serialization |
| 40 | `DowngradeAttemptDetected` | Downgrade attack detected | Use security monitoring |
| 41 | `ProtocolVersionTooOld` | Protocol version below minimum | Upgrade protocol |
| 42 | `ProtocolVersionMismatch` | Protocol versions incompatible | Negotiate common version |

## Extension Error Codes (1000-1999)

### Location Extension (1000-1099)

| Range | Component | Description |
|-------|-----------|-------------|
| 1000-1009 | Coordinate operations | Geographic calculations |
| 1010-1019 | Clustering algorithms | DBSCAN, KMeans, etc. |
| 1020-1029 | Visit detection | Location visit analysis |
| 1030-1039 | Spoofing detection | Location fraud detection |
| 1040-1049 | Obfuscation | Privacy protection |

### Trust Extension (1100-1199)

| Range | Component | Description |
|-------|-----------|-------------|
| 1100-1109 | Identity management | DID operations |
| 1110-1119 | Trust establishment | Trust protocol errors |
| 1120-1129 | Reputation scoring | Reputation algorithm errors |
| 1130-1139 | Attestations | Attestation protocol errors |
| 1140-1149 | Peer connections | Connection management |

### TSA Extension (1200-1299)

| Range | Component | Description |
|-------|-----------|-------------|
| 1200-1209 | RFC 3161 timestamps | Standard timestamping |
| 1210-1219 | Blockchain anchoring | Blockchain operations |
| 1220-1229 | Merkle trees | Tree construction/verification |
| 1230-1239 | Provider management | TSA provider errors |
| 1240-1249 | Aggregation | Timestamp aggregation |

### Integrity Extension (1300-1369)

| Range | Component | Description |
|-------|-----------|-------------|
| 1300-1309 | iOS App Attest | Apple platform integrity |
| 1310-1319 | Android Play Integrity | Google platform integrity |
| 1320-1329 | Device verification | Device integrity checks |
| 1330-1339 | Fraud detection | Fraud prevention |
| 1340-1349 | Jailbreak detection | Root/jailbreak detection |

### Privacy Extension (1400-1459)

| Range | Component | Description |
|-------|-----------|-------------|
| 1400-1409 | K-anonymity | Anonymization techniques |
| 1410-1419 | Differential privacy | Privacy algorithms |
| 1420-1429 | Data minimization | Data reduction |
| 1430-1439 | Consent management | GDPR/CCPA compliance |
| 1440-1449 | Zero-knowledge proofs | ZKP operations |

### Keystore Extension (1500-1549)

| Range | Component | Description |
|-------|-----------|-------------|
| 1500-1509 | Key derivation | BIP-32/44 operations |
| 1510-1519 | Storage backends | iOS/Android keystore |
| 1520-1529 | Key rotation | Rotation policies |
| 1530-1539 | HSM integration | Hardware security modules |
| 1540-1549 | Access control | Key access policies |

### HSM Extension (1550-1599)

| Range | Component | Description |
|-------|-----------|-------------|
| 1550-1559 | PKCS#11 operations | Hardware token operations |
| 1560-1569 | Cloud HSM | AWS/Azure/GCP HSM |
| 1570-1579 | Session management | HSM session handling |
| 1580-1589 | Key management | HSM key operations |
| 1590-1599 | Health monitoring | HSM status checking |

## Common Error Patterns

### Transient Errors

These errors may resolve automatically with retry:

```rust
match result {
    Err(Error::TimestampTooFuture) => {
        // Wait and retry
        sleep(Duration::from_secs(1));
        retry_operation()?;
    },
    Err(Error::LockPoisoned) => {
        // Reset and retry
        reset_locks();
        retry_operation()?;
    },
    other => other?,
}
```

### Configuration Errors

These errors indicate configuration problems:

```rust
match result {
    Err(Error::UnsupportedVersion(v)) => {
        error!("Upgrade required: version {} not supported", v);
        // Update configuration
    },
    Err(Error::MandatoryExtensionMissing(ext)) => {
        error!("Install required extension: {}", ext);
        // Install missing extension
    },
    other => other?,
}
```

### Security Errors

These errors indicate potential attacks:

```rust
match result {
    Err(Error::DowngradeAttemptDetected) => {
        warn!("Potential downgrade attack detected");
        // Log security event
        security_log.record_attack_attempt();
        return Err(error);
    },
    Err(Error::InvalidSignature) => {
        warn!("Invalid signature - possible tampering");
        // Reject and log
        return Err(error);
    },
    other => other?,
}
```

## Error Handling Best Practices

### 1. Specific Error Handling

Handle specific errors appropriately:

```rust
use olocus_core::Error;

match operation() {
    Ok(result) => handle_success(result),
    Err(Error::InvalidSignature) => handle_invalid_signature(),
    Err(Error::TimestampRegression) => handle_time_issue(),
    Err(Error::PluginNotFound(plugin)) => install_plugin(plugin),
    Err(other) => handle_generic_error(other),
}
```

### 2. Graceful Degradation

Implement fallbacks where possible:

```rust
fn get_timestamp() -> Result<i64> {
    match tsa_provider.get_timestamp() {
        Ok(ts) => Ok(ts),
        Err(Error::NetworkTimeout) => {
            warn!("TSA timeout, using local time");
            Ok(SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs() as i64)
        },
        Err(e) => Err(e),
    }
}
```

### 3. Logging and Monitoring

Log errors with appropriate levels:

```rust
use log::{error, warn, info, debug};

match result {
    Err(Error::InvalidSignature) => {
        error!("Security: Invalid signature detected from peer {}", peer_id);
        security_metrics.invalid_signatures.increment();
    },
    Err(Error::PluginNotFound(plugin)) => {
        warn!("Plugin {} not found, feature disabled", plugin);
    },
    Err(Error::TimestampRegression) => {
        info!("Timestamp regression, adjusting clock");
    },
    Ok(_) => debug!("Operation completed successfully"),
}
```

### 4. Error Recovery

Implement automatic recovery where safe:

```rust
struct RetryConfig {
    max_attempts: u32,
    base_delay: Duration,
    max_delay: Duration,
}

fn retry_with_backoff<F, T, E>(mut operation: F, config: RetryConfig) -> Result<T, E>
where
    F: FnMut() -> Result<T, E>,
    E: std::fmt::Debug,
{
    let mut attempts = 0;
    let mut delay = config.base_delay;
    
    loop {
        match operation() {
            Ok(result) => return Ok(result),
            Err(e) if attempts >= config.max_attempts => return Err(e),
            Err(e) => {
                debug!("Operation failed (attempt {}): {:?}", attempts + 1, e);
                sleep(delay);
                delay = (delay * 2).min(config.max_delay);
                attempts += 1;
            }
        }
    }
}
```

## Testing Error Conditions

### Unit Tests

Test error conditions explicitly:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_invalid_signature_error() {
        let suite = CryptoSuite::default();
        let key1 = suite.generate_key();
        let key2 = suite.generate_key();
        
        let message = b"test message";
        let signature = suite.sign(&key1, message);
        
        // Different key should fail verification
        let result = suite.verify(&key2.verifying_key(), message, &signature);
        assert_eq!(result.unwrap_err(), Error::InvalidSignature);
    }

    #[test]
    fn test_timestamp_regression() {
        let mut chain = Chain::new();
        let key = generate_key();
        
        // Add first block
        let block1 = Block::genesis(EmptyPayload, &key, 1000);
        chain.add_block(block1)?;
        
        // Try to add block with earlier timestamp
        let block2 = Block::new(EmptyPayload, &key, &chain.tip(), 999);
        let result = chain.add_block(block2);
        assert_eq!(result.unwrap_err(), Error::TimestampRegression);
    }
}
```

### Integration Tests

Test error propagation across modules:

```rust
#[test]
fn test_extension_negotiation_failure() {
    let client = TestClient::new();
    let server = TestServer::with_extensions(&["trust", "location"]);
    
    // Client requires extension not available on server
    client.require_extension("nonexistent");
    
    let result = client.connect_to(&server);
    assert_eq!(result.unwrap_err(), Error::MandatoryExtensionMissing("nonexistent".to_string()));
}
```

## Error Documentation Template

When adding new errors, use this template:

```rust
/// Error code XXX: Brief description
/// 
/// ## Cause
/// What causes this error to occur
/// 
/// ## Recovery
/// How to handle/recover from this error
/// 
/// ## Example
/// ```rust
/// match operation() {
///     Err(Error::YourError) => {
///         // Recovery code
///     },
///     other => other?,
/// }
/// ```
#[error("Human-readable error message")]
YourError,
```

## Error Code Allocation

### Requesting New Error Codes

1. **Identify the range** for your module (see ranges above)
2. **Check for conflicts** with existing codes
3. **Follow naming conventions** (descriptive but concise)
4. **Document thoroughly** with cause and recovery
5. **Add tests** for the error condition

### Reserved Ranges

- **3000-3999**: Future core protocol extensions
- **4000-4999**: Third-party extensions
- **5000+**: Application-specific errors
