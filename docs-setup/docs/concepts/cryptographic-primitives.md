---
id: cryptographic-primitives
title: Cryptographic Primitives
sidebar_position: 1
---

# Cryptographic Primitives

Olocus Protocol uses carefully selected cryptographic primitives that prioritize security, performance, and interoperability. The core protocol employs a minimal cryptographic suite called "Suite-2024-01" which provides strong security guarantees while maintaining simplicity.

## Current Cryptographic Suite (Suite-2024-01)

The default cryptographic suite includes:

- **Digital Signatures**: Ed25519 (using Curve25519)
- **Cryptographic Hashing**: SHA-256
- **Key Exchange**: X25519 (for future extensions)
- **Symmetric Encryption**: AES-256-GCM (for future extensions)

### Why These Choices?

1. **Ed25519 Signatures**
   - Fast verification and signing
   - Small signature size (64 bytes)
   - Resistant to side-channel attacks
   - No malleability issues
   - Deterministic signatures

2. **SHA-256 Hashing**
   - Well-studied and widely trusted
   - Good performance characteristics
   - 256-bit security level
   - No known practical attacks

3. **Future-Ready Design**
   - Post-quantum algorithms ready for integration
   - Extensible suite identifier system
   - Algorithm negotiation support

## CryptoSuite Implementation

The protocol uses an enum-based approach for algorithm selection:

```rust
pub enum CryptoSuite {
    /// Default suite: Ed25519 + SHA-256
    #[default]
    Default,
    // Future suites can be added here:
    // PostQuantum,
    // Legacy,
}
```

### Suite Identifier

Each cryptographic suite has a unique identifier:

- **Suite-2024-01**: Ed25519 signatures + SHA-256 hashing
- Future suites will have different identifiers (e.g., Suite-2025-01 for post-quantum)

## Key Generation

Keys are generated using cryptographically secure random number generation:

```rust
use rand::rngs::OsRng;
use rand::RngCore;

// Generate Ed25519 signing key
let mut csprng = OsRng;
let mut bytes = [0u8; 32];
csprng.fill_bytes(&mut bytes);
let signing_key = SigningKey::from_bytes(&bytes);
```

### Key Properties

- **Private Keys**: 32 bytes (Ed25519 seed)
- **Public Keys**: 32 bytes (compressed curve point)
- **Signatures**: 64 bytes (R || s format)

## Hash Operations

All hashing uses SHA-256 with consistent output format:

```rust
// Hash arbitrary data
let data = b"hello world";
let hash = crypto_suite.hash(data); // Returns Hash([u8; 32])
```

### Hash Properties

- **Output Size**: 256 bits (32 bytes)
- **Security Level**: ~128-bit security
- **Performance**: Optimized implementations available
- **Deterministic**: Same input always produces same output

## Signature Operations

Ed25519 provides deterministic signatures with strong security properties:

```rust
// Sign a message
let message = b"block header data";
let signature = crypto_suite.sign(&signing_key, message);

// Verify signature
let is_valid = crypto_suite.verify(&public_key, message, &signature);
```

### Signature Properties

- **Deterministic**: Same message + key = same signature
- **Non-malleable**: Cannot modify signatures
- **Fast Verification**: Batch verification possible
- **Small Size**: 64 bytes per signature

## Security Considerations

### Algorithm Agility

The protocol is designed to evolve its cryptographic algorithms:

1. **Suite Versioning**: Each suite has a unique identifier
2. **Backward Compatibility**: Older suites remain supported
3. **Migration Path**: Clear upgrade procedures
4. **Negotiation**: Peers can agree on common algorithms

### Post-Quantum Readiness

Future cryptographic suites will include post-quantum algorithms:

- **Dilithium**: Post-quantum signatures
- **ML-KEM/Kyber**: Post-quantum key exchange
- **Hybrid Mode**: Classical + post-quantum combinations

### Side-Channel Resistance

Ed25519 was specifically chosen for its resistance to timing and other side-channel attacks:

- **Constant-Time Operations**: No secret-dependent branches
- **Complete Formulas**: No exceptional cases
- **Safe-by-Design**: Difficult to implement incorrectly

## Implementation Notes

### Library Dependencies

- **ed25519-dalek**: Ed25519 signature implementation
- **sha2**: SHA-256 hashing implementation
- **rand**: Cryptographically secure random number generation

### Performance Characteristics

Typical performance on modern hardware:

- **Key Generation**: ~50,000 keys/second
- **Signing**: ~15,000 signatures/second
- **Verification**: ~5,000 verifications/second
- **Hashing**: ~100 MB/second (SHA-256)

### Memory Requirements

- **Key Storage**: 32 bytes per private key
- **Signature Storage**: 64 bytes per signature
- **Hash Storage**: 32 bytes per hash
- **Working Memory**: &lt;1KB for operations

## Validation and Testing

All cryptographic operations include comprehensive validation:

```rust
// Verify suite compatibility
assert!(crypto_suite.verify_suite("Suite-2024-01"));

// Test key generation
let key = crypto_suite.generate_key();
let pubkey = key.verifying_key();

// Test signing round-trip
let message = b"test message";
let signature = crypto_suite.sign(&key, message);
assert!(crypto_suite.verify(&pubkey, message, &signature).is_ok());
```

### Test Vectors

The implementation includes standard test vectors to ensure compatibility:

- Ed25519 RFC 8032 test vectors
- SHA-256 FIPS 180-4 test vectors
- Cross-platform deterministic output tests
