---
id: algorithm-negotiation
title: Algorithm Negotiation
sidebar_position: 1
---

# Algorithm Negotiation

Algorithm negotiation in Olocus Protocol allows peers to establish secure communication channels while preventing downgrade attacks and ensuring mutual algorithm support. The system combines cryptographic preferences with security policies to select the best available algorithms for each connection.

## Core Concepts

### Algorithm Categories

The protocol supports negotiation for four algorithm categories:

1. **Signature Algorithms** - Digital signature schemes
2. **Hash Algorithms** - Cryptographic hash functions
3. **Key Exchange** - Key agreement protocols
4. **Encryption** - Symmetric encryption ciphers

### Security Levels

All algorithms are classified by NIST-equivalent security levels:

- **Level128**: 128-bit security (minimum acceptable)
- **Level192**: 192-bit security 
- **Level256**: 256-bit security (recommended)
- **PQLevel3**: Post-quantum Level 3 (AES-192 equivalent)
- **PQLevel5**: Post-quantum Level 5 (AES-256 equivalent)

### Algorithm Status

Algorithms have a lifecycle status indicating their suitability:

- **Recommended**: Preferred for new deployments
- **Acceptable**: Usable but not preferred
- **Deprecating**: Being phased out (with sunset date)
- **Deprecated**: Should not be used
- **Broken**: MUST NOT be used

## Supported Algorithms

### Signature Algorithms

| Algorithm | Security Level | Quantum Resistant | Status |
|-----------|----------------|-------------------|--------|
| Ed25519 | Level128 | No | Recommended |
| Ed448 | Level256 | No | Acceptable |
| Dilithium3 | PQLevel3 | Yes | Recommended |
| Dilithium5 | PQLevel5 | Yes | Acceptable |
| Falcon-512 | PQLevel3 | Yes | Acceptable |

### Hash Algorithms

| Algorithm | Security Level | Quantum Resistant | Status |
|-----------|----------------|-------------------|--------|
| SHA-256 | Level128 | Yes | Recommended |
| SHA-384 | Level192 | Yes | Acceptable |
| SHA-512 | Level256 | Yes | Acceptable |
| SHA3-256 | Level128 | Yes | Acceptable |
| BLAKE3 | Level128 | Yes | Acceptable |

### Key Exchange Algorithms

| Algorithm | Security Level | Quantum Resistant | Status |
|-----------|----------------|-------------------|--------|
| X25519 | Level128 | No | Recommended |
| X448 | Level256 | No | Acceptable |
| Kyber768 | PQLevel3 | Yes | Recommended |
| Kyber1024 | PQLevel5 | Yes | Acceptable |

### Encryption Algorithms

| Algorithm | Security Level | Quantum Resistant | Status |
|-----------|----------------|-------------------|--------|
| AES-256-GCM | Level128 | Yes | Recommended |
| AES-128-GCM | Level128 | Yes | Acceptable |
| ChaCha20-Poly1305 | Level128 | Yes | Recommended |
| XChaCha20-Poly1305 | Level128 | Yes | Acceptable |

## Negotiation Process

### 1. Preference Declaration

Each peer creates signed algorithm preferences:

```rust
pub struct AlgorithmPreferences {
    /// Ordered preference list (best first)
    pub signature_algorithms: Vec<AlgorithmId>,
    pub hash_algorithms: Vec<AlgorithmId>,
    pub key_exchange_algorithms: Vec<AlgorithmId>,
    pub encryption_algorithms: Vec<AlgorithmId>,
    
    /// Security constraints
    pub min_security_level: SecurityLevel,
    pub allow_deprecated: bool,
    
    /// Protocol version bounds
    pub protocol_version: u16,
    pub min_protocol_version: u16,
    pub max_protocol_version: u16,
}
```

### 2. Preference Signing

Preferences are cryptographically signed to prevent tampering:

```rust
pub struct SignedAlgorithmPreferences {
    pub preferences: AlgorithmPreferences,
    pub signature: Vec<u8>,      // 64 bytes
    pub signer_key: Vec<u8>,     // 32 bytes  
    pub timestamp: i64,          // Unix timestamp
    pub nonce: Vec<u8>,          // Replay protection
}
```

### 3. Algorithm Selection

The negotiation algorithm follows these steps:

1. **Validate preferences**: Verify signatures and timestamps
2. **Check protocol versions**: Ensure compatibility
3. **Apply security minimums**: Filter by security level
4. **Select common algorithms**: Choose from intersection
5. **Rank by preferences**: Use initiator's preference order
6. **Generate transcript**: Create negotiation record

```rust
// Example negotiation
let result = negotiate_algorithms(
    &initiator_preferences,
    &responder_preferences,
    &security_requirements
)?;

// Result contains selected algorithms
let selected = NegotiationResult {
    signature_algorithm: AlgorithmId::Ed25519,
    hash_algorithm: AlgorithmId::Sha256,
    key_exchange_algorithm: AlgorithmId::X25519,
    encryption_algorithm: AlgorithmId::Aes256Gcm,
    security_level: SecurityLevel::Level128,
    protocol_version: 1,
    negotiation_transcript: vec![...], // For handshake binding
};
```

## Security Requirements

### Minimum Security Policies

Organizations can enforce minimum security requirements:

```rust
pub struct SecurityRequirements {
    /// Minimum acceptable security level
    pub min_security_level: SecurityLevel,
    
    /// Require post-quantum algorithms
    pub require_post_quantum: bool,
    
    /// Algorithms that MUST NOT be used
    pub forbidden_algorithms: HashSet<AlgorithmId>,
    
    /// Required algorithms (at least one must be supported)
    pub required_algorithms: Vec<AlgorithmId>,
    
    /// Minimum protocol version
    pub min_protocol_version: u16,
}
```

### Algorithm Deprecation

The protocol tracks algorithm lifecycle and deprecation:

```rust
pub struct AlgorithmMetadata {
    pub id: AlgorithmId,
    pub security_level: SecurityLevel,
    pub status: AlgorithmStatus,
    pub quantum_resistant: bool,
    pub performance_rating: u8,    // 1-10 scale
    pub introduced_version: String,
    pub deprecated_version: Option<String>,
    pub references: Vec<String>,   // RFCs, papers, etc.
}
```

## Downgrade Protection

The negotiation includes multiple layers of downgrade protection:

### 1. Protocol Version Checking

```rust
if peer_version < min_protocol_version {
    return Err(Error::ProtocolVersionTooOld);
}
```

### 2. Signed Preferences

Algorithm preferences are signed to prevent tampering during transit.

### 3. Strict Ordering

The initiator's preference order is authoritative to prevent preference manipulation.

### 4. Negotiation Commitment

All offered algorithms are cryptographically committed in the negotiation transcript.

### 5. Minimum Security Requirements

Security policies enforce baseline algorithm strength requirements.

### 6. Forbidden Algorithm Lists

Explicitly blocked algorithms cannot be negotiated.

### 7. Handshake Transcript Binding

The negotiation transcript MUST be included in subsequent handshake messages.

## Post-Quantum Transition

The protocol supports gradual migration to post-quantum cryptography:

### Hybrid Mode

Combine classical and post-quantum algorithms:

```rust
// Example hybrid preferences
let hybrid_prefs = AlgorithmPreferences {
    signature_algorithms: vec![
        AlgorithmId::Dilithium3,     // PQ first choice
        AlgorithmId::Ed25519,        // Classical fallback
    ],
    key_exchange_algorithms: vec![
        AlgorithmId::Kyber768,       // PQ first choice
        AlgorithmId::X25519,         // Classical fallback
    ],
    min_security_level: SecurityLevel::PQLevel3,
    // ...
};
```

### Migration Strategies

1. **Additive**: Add PQ algorithms alongside classical
2. **Hybrid**: Combine classical + PQ in single operation
3. **Full PQ**: Require only post-quantum algorithms
4. **Classical Only**: Legacy mode for older systems

## Implementation Example

### Basic Negotiation

```rust
use olocus_core::algorithm_negotiation::*;

// Create preferences
let initiator_prefs = AlgorithmPreferences {
    signature_algorithms: vec![AlgorithmId::Ed25519],
    hash_algorithms: vec![AlgorithmId::Sha256],
    key_exchange_algorithms: vec![AlgorithmId::X25519],
    encryption_algorithms: vec![AlgorithmId::Aes256Gcm],
    min_security_level: SecurityLevel::Level128,
    allow_deprecated: false,
    protocol_version: 1,
    min_protocol_version: 1,
    max_protocol_version: 1,
};

// Sign preferences
let signed_prefs = sign_algorithm_preferences(
    &initiator_prefs,
    &signing_key,
    &nonce
)?;

// Perform negotiation
let result = negotiate_algorithms(
    &signed_prefs,
    &responder_signed_prefs,
    &security_requirements
)?;
```

### Enterprise Security Policy

```rust
// Define organizational security requirements
let enterprise_policy = SecurityRequirements {
    min_security_level: SecurityLevel::Level192,
    require_post_quantum: true,
    forbidden_algorithms: [
        AlgorithmId::Md5,        // Broken
        AlgorithmId::Sha1,       // Deprecated
    ].into(),
    required_algorithms: vec![
        AlgorithmId::Dilithium3,  // Must support PQ
    ],
    min_protocol_version: 2,      // Require v2+
};

// This will reject connections that don't meet policy
let result = negotiate_with_policy(
    &initiator_prefs,
    &responder_prefs, 
    &enterprise_policy
)?;
```

## Error Handling

Negotiation can fail for various security reasons:

```rust
pub enum NegotiationError {
    NoCommonAlgorithm,           // No mutual support
    PeerSecurityTooLow,          // Below minimum level
    ProtocolVersionMismatch,     // Version incompatibility
    RequiredAlgorithmMissing,    // Policy violation
    PostQuantumRequired,         // PQ mandate not met
    DowngradeAttemptDetected,    // Security attack
    PreferencesTooOld,           // Timestamp validation
    InvalidSignature,            // Tampered preferences
}
```

## Performance Considerations

### Algorithm Performance Ratings

Each algorithm includes a performance rating (1-10 scale) to guide selection when multiple options meet security requirements:

- **Ed25519**: 9/10 (very fast)
- **Dilithium3**: 6/10 (moderate)
- **SHA-256**: 8/10 (fast)
- **BLAKE3**: 10/10 (fastest)
- **AES-256-GCM**: 9/10 (hardware accelerated)
- **ChaCha20-Poly1305**: 7/10 (software optimized)

### Negotiation Caching

Successful negotiations can be cached to avoid repeated cryptographic operations:

```rust
// Cache negotiation result for this peer combination
let cache_key = (initiator_key, responder_key, preferences_hash);
negotiation_cache.insert(cache_key, result.clone());
```

## Testing and Validation

### Negotiation Test Vectors

The protocol includes comprehensive test vectors covering:

- Successful negotiations
- Security policy enforcement  
- Downgrade attack prevention
- Post-quantum transitions
- Error conditions

### Interoperability Testing

Cross-implementation testing ensures consistent negotiation behavior across different Olocus Protocol implementations.

## Future Extensions

The negotiation framework is designed for extensibility:

- **New algorithm categories** (e.g., zero-knowledge proofs)
- **Enhanced security levels** (e.g., quantum security levels)
- **Dynamic algorithm updates** (e.g., emergency deprecation)
- **Performance-based selection** (e.g., bandwidth-constrained environments)
