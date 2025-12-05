---
id: cryptographic-operations
title: Cryptographic Operations
sidebar_position: 1
---

# Cryptographic Operations

This API reference covers all cryptographic operations available in Olocus Protocol, including key generation, signing, verification, hashing, and encryption. All operations use the CryptoSuite abstraction for algorithm agility.

## Core Types

### CryptoSuite

The main entry point for all cryptographic operations:

```rust
pub enum CryptoSuite {
    #[default]
    Default,  // Ed25519 + SHA-256
    // Future: PostQuantum, Legacy, etc.
}

impl CryptoSuite {
    pub fn identifier(&self) -> &'static str;
    pub fn from_identifier(id: &str) -> Option<Self>;
    pub fn hash_algorithm(&self) -> &'static str;
    pub fn signature_algorithm(&self) -> &'static str;
}
```

### Hash Type

Type-safe wrapper for hash outputs:

```rust
pub struct Hash(pub [u8; 32]);

impl Hash {
    pub fn as_bytes(&self) -> &[u8; 32];
    pub fn from_bytes(bytes: [u8; 32]) -> Self;
}
```

## Key Operations

### Key Generation

Generate cryptographically secure Ed25519 keys:

```rust
// Using CryptoSuite (recommended)
let suite = CryptoSuite::default();
let signing_key = suite.generate_key();

// Using convenience function
let signing_key = olocus_core::crypto::generate_key();
```

**Returns:**
- `SigningKey`: 32-byte Ed25519 private key

**Security Notes:**
- Uses OS random number generator (`OsRng`)
- Suitable for production use
- Keys are generated fresh each time

### Public Key Derivation

Derive public key from private key:

```rust
let signing_key = suite.generate_key();
let verifying_key = signing_key.verifying_key();

// Public key bytes
let pubkey_bytes: [u8; 32] = *verifying_key.as_bytes();
```

**Returns:**
- `VerifyingKey`: Ed25519 public key
- Key bytes are 32 bytes (compressed curve point)

## Hash Operations

### Basic Hashing

Compute SHA-256 hash of arbitrary data:

```rust
// Using CryptoSuite
let suite = CryptoSuite::default();
let data = b"hello world";
let hash = suite.hash(data);  // Returns Hash([u8; 32])

// Using convenience function
let hash_bytes = olocus_core::crypto::hash(data);  // Returns [u8; 32]
```

**Parameters:**
- `data: &[u8]` - Arbitrary input data

**Returns:**
- `Hash` - Type-safe 32-byte SHA-256 output

### Hash Properties

```rust
let hash = suite.hash(b"test data");

// Convert to different formats
let bytes: [u8; 32] = hash.into();
let slice: &[u8] = hash.as_ref();
let hash_copy = Hash::from(bytes);

// Hashing is deterministic
assert_eq!(suite.hash(b"test"), suite.hash(b"test"));
```

## Signature Operations

### Signing Messages

Create Ed25519 signatures:

```rust
let suite = CryptoSuite::default();
let signing_key = suite.generate_key();
let message = b"block header data";

let signature = suite.sign(&signing_key, message);
```

**Parameters:**
- `signing_key: &SigningKey` - Private key for signing
- `message: &[u8]` - Data to sign

**Returns:**
- `Signature` - 64-byte Ed25519 signature

**Properties:**
- Deterministic: same key + message = same signature
- Non-malleable: signatures cannot be modified
- Fast signing: ~15,000 operations/second

### Signature Verification

Verify Ed25519 signatures:

```rust
let verifying_key = signing_key.verifying_key();
let is_valid = suite.verify(&verifying_key, message, &signature);

match is_valid {
    Ok(()) => println!("Signature valid"),
    Err(Error::InvalidSignature) => println!("Signature invalid"),
    Err(e) => println!("Other error: {}", e),
}
```

**Parameters:**
- `verifying_key: &VerifyingKey` - Public key for verification
- `message: &[u8]` - Original signed data
- `signature: &Signature` - Signature to verify

**Returns:**
- `Result<()>` - Ok if valid, Error::InvalidSignature if invalid

**Performance:**
- Fast verification: ~5,000 operations/second
- Constant-time operation (timing attack resistant)

## Complete Example

### Basic Cryptographic Workflow

```rust
use olocus_core::crypto::{CryptoSuite, generate_key, hash};

fn example_workflow() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize crypto suite
    let suite = CryptoSuite::default();
    println!("Using suite: {}", suite.identifier());
    
    // Generate keys
    let signing_key = suite.generate_key();
    let verifying_key = signing_key.verifying_key();
    
    // Create some data to sign
    let data = b"Hello, Olocus Protocol!";
    
    // Hash the data
    let data_hash = suite.hash(data);
    println!("Data hash: {:02x?}", data_hash.as_bytes());
    
    // Sign the hash
    let signature = suite.sign(&signing_key, data);
    println!("Signature: {} bytes", signature.to_bytes().len());
    
    // Verify the signature
    suite.verify(&verifying_key, data, &signature)?;
    println!("Signature verified successfully!");
    
    // Test that modified data fails verification
    let modified_data = b"Hello, Modified Data!";
    let verify_result = suite.verify(&verifying_key, modified_data, &signature);
    assert!(verify_result.is_err());
    println!("Modified data correctly failed verification");
    
    Ok(())
}
```

### Block Signing Example

```rust
use olocus_core::{Block, EmptyPayload, CryptoSuite};

fn sign_block_example() -> Result<(), Box<dyn std::error::Error>> {
    let suite = CryptoSuite::default();
    let signing_key = suite.generate_key();
    
    // Create a genesis block
    let payload = EmptyPayload;
    let timestamp = 1640995200; // Example timestamp
    let block = Block::genesis(payload, &signing_key, timestamp);
    
    // Verify the block was signed correctly
    block.verify()?;
    println!("Block signature verified!");
    
    // Access block components
    println!("Block index: {}", block.header.index);
    println!("Block timestamp: {}", block.header.timestamp);
    println!("Payload type: {}", block.header.payload_type);
    println!("Public key: {:02x?}", block.public_key.as_bytes());
    
    Ok(())
}
```

## Algorithm Compatibility

### Suite Information

```rust
let suite = CryptoSuite::default();

// Get algorithm names
println!("Hash algorithm: {}", suite.hash_algorithm());      // "SHA-256"
println!("Signature algorithm: {}", suite.signature_algorithm()); // "Ed25519"

// Check suite compatibility
assert!(olocus_core::crypto::verify_suite("Suite-2024-01"));
assert!(!olocus_core::crypto::verify_suite("Unknown-Suite"));

// Suite constants
assert_eq!(suite.identifier(), olocus_core::crypto::SUITE_2024_01);
```

### Cross-Platform Compatibility

All cryptographic operations produce identical results across platforms:

```rust
// These will be identical on all platforms
let key = suite.generate_key();
let hash1 = suite.hash(b"test data");
let hash2 = suite.hash(b"test data");
assert_eq!(hash1, hash2);

// Deterministic signatures
let sig1 = suite.sign(&key, b"message");
let sig2 = suite.sign(&key, b"message");
assert_eq!(sig1, sig2);
```

## Error Handling

### Common Errors

```rust
use olocus_core::Error;

// Signature verification errors
match suite.verify(&public_key, message, &signature) {
    Ok(()) => println!("Valid signature"),
    Err(Error::InvalidSignature) => println!("Signature verification failed"),
    Err(e) => println!("Unexpected error: {}", e),
}

// Suite compatibility errors
match CryptoSuite::from_identifier("Unknown-Suite-2025") {
    Some(suite) => println!("Suite supported"),
    None => println!("Suite not supported"),
}
```

### Best Practices

1. **Always verify signatures** before trusting signed data
2. **Handle errors gracefully** - invalid signatures are expected in adversarial environments
3. **Use appropriate random sources** - CryptoSuite uses OS randomness automatically
4. **Store keys securely** - private keys should never be logged or transmitted
5. **Validate inputs** - check key and signature lengths before processing

## Performance Characteristics

### Typical Performance (Modern Hardware)

| Operation | Speed | Notes |
|-----------|-------|-------|
| Key Generation | 50,000/sec | Uses OS random source |
| SHA-256 Hash | 100 MB/sec | Optimized implementations |
| Ed25519 Sign | 15,000/sec | Deterministic signatures |
| Ed25519 Verify | 5,000/sec | Constant-time verification |
| Hash Creation | &lt;1μs | Type conversion overhead |

### Memory Usage

| Component | Size | Notes |
|-----------|------|-------|
| Private Key | 32 bytes | Ed25519 seed |
| Public Key | 32 bytes | Compressed curve point |
| Signature | 64 bytes | R + s components |
| Hash | 32 bytes | SHA-256 output |
| Working Memory | &lt;1KB | Temporary calculations |

## Thread Safety

All cryptographic operations are thread-safe:

```rust
use std::sync::Arc;
use std::thread;

let suite = Arc::new(CryptoSuite::default());
let handles: Vec<_> = (0..4).map(|i| {
    let suite = Arc::clone(&suite);
    thread::spawn(move || {
        let data = format!("thread {}", i);
        let hash = suite.hash(data.as_bytes());
        println!("Thread {} hash: {:02x?}", i, hash.as_bytes());
    })
}).collect();

for handle in handles {
    handle.join().unwrap();
}
```

## Testing Utilities

### Test Vectors

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_known_vectors() {
        let suite = CryptoSuite::default();
        
        // Known hash test vector
        let input = b"abc";
        let expected = hex::decode("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")?;
        let actual = suite.hash(input);
        assert_eq!(actual.as_bytes(), &expected[..]);
    }
    
    #[test]
    fn test_sign_verify_roundtrip() {
        let suite = CryptoSuite::default();
        let key = suite.generate_key();
        let pubkey = key.verifying_key();
        
        let message = b"test message";
        let signature = suite.sign(&key, message);
        
        assert!(suite.verify(&pubkey, message, &signature).is_ok());
        
        // Wrong message should fail
        let wrong_message = b"wrong message";
        assert!(suite.verify(&pubkey, wrong_message, &signature).is_err());
    }
}
```

## Migration and Upgrades

### Future Cryptographic Suites

When new suites are added, the API remains backward compatible:

```rust
// Future example - not yet implemented
let quantum_suite = CryptoSuite::PostQuantum;  // Dilithium + BLAKE3
let hybrid_suite = CryptoSuite::Hybrid;        // Classical + PQ

// API remains the same
let key = quantum_suite.generate_key();
let hash = quantum_suite.hash(data);
let signature = quantum_suite.sign(&key, data);
```

### Upgrade Strategy

1. **Add new suite variants** to the enum
2. **Implement trait methods** for new algorithms  
3. **Update metadata** with algorithm information
4. **Maintain backward compatibility** for existing suites
5. **Provide migration tools** for key/signature format changes
