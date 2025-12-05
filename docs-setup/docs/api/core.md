---
id: core
title: Core API Reference
sidebar_position: 1
---

# Core API Reference

Complete API reference for the `olocus_core` crate.

## Block Operations

### Creating Blocks

```rust
/// Generate a new Ed25519 key pair
pub fn generate_key() -> [u8; 32];

/// Create a genesis (first) block
pub fn Block::genesis<P: BlockPayload>(
    payload: P,
    key: &[u8; 32],
    timestamp: u64
) -> Block<P>;

/// Create the next block in a chain
pub fn Block::next<P: BlockPayload>(
    previous: &Block<impl BlockPayload>,
    payload: P,
    key: &[u8; 32],
    timestamp: u64
) -> Result<Block<P>, Error>;
```

### Verifying Blocks

```rust
/// Verify a single block
pub fn verify_block<P: BlockPayload>(
    block: &Block<P>,
    previous: Option<&Block<impl BlockPayload>>
) -> Result<(), Error>;

/// Verify an entire chain
pub fn verify_chain<P: BlockPayload>(
    chain: &[Block<P>]
) -> Result<(), Error>;
```

## Wire Format

### Encoding

```rust
/// Create a wire format with specific encoding and compression
let format = WireFormat::new(
    EncodingFormat::MessagePack,
    CompressionMethod::Zstd
);

/// Encode a block
let bytes = format.encode(&block)?;

/// Encode with default settings (JSON, no compression)
let bytes = WireFormat::json().encode(&block)?;
```

### Decoding

```rust
/// Decode a block
let block: Block<MyPayload> = format.decode(&bytes)?;

/// Auto-detect format from bytes
let block = WireFormat::decode_auto(&bytes)?;
```

### Available Formats

| Encoding | Compression | Content-Type |
|----------|-------------|--------------|
| Binary | None | `application/x-olocus` |
| Binary | Zstd | `application/x-olocus+zstd` |
| Binary | LZ4 | `application/x-olocus+lz4` |
| Binary | Gzip | `application/x-olocus+gzip` |
| JSON | None | `application/json` |
| JSON | Zstd | `application/json+zstd` |
| MessagePack | None | `application/msgpack` |
| Protobuf | None | `application/x-protobuf` |
| SSZ | None | `application/ssz` |

## Cryptographic Operations

### Signing

```rust
/// Sign a message with Ed25519
pub fn sign(
    message: &[u8],
    secret_key: &[u8; 32]
) -> [u8; 64];

/// Verify a signature
pub fn verify_signature(
    message: &[u8],
    signature: &[u8; 64],
    public_key: &[u8; 32]
) -> bool;
```

### Hashing

```rust
/// Compute SHA-256 hash
pub fn hash(data: &[u8]) -> [u8; 32];

/// Compute block hash
pub fn Block::hash(&self) -> [u8; 32];
```

### Encryption

```rust
/// Generate X25519 key pair
pub fn generate_x25519_keypair() -> ([u8; 32], [u8; 32]);

/// Perform X25519 key agreement
pub fn x25519_agreement(
    secret: &[u8; 32],
    peer_public: &[u8; 32]
) -> [u8; 32];

/// Encrypt with AES-256-GCM
pub fn encrypt_aes256gcm(
    plaintext: &[u8],
    key: &[u8; 32],
    nonce: &[u8; 12]
) -> Vec<u8>;

/// Decrypt with AES-256-GCM
pub fn decrypt_aes256gcm(
    ciphertext: &[u8],
    key: &[u8; 32],
    nonce: &[u8; 12]
) -> Result<Vec<u8>, Error>;
```

## Measurement API

### Creating Measurements

```rust
use olocus_core::{Measurement, Value, Uncertainty, Provenance};

let measurement = Measurement {
    value: Value::Float(23.5),
    uncertainty: Uncertainty::Gaussian { std_dev: 0.1 },
    provenance: Provenance::default(),
    validity: ValidityWindow::perpetual(),
};
```

### Coordinate Conversions

```rust
/// Convert degrees to fixed-point
pub fn Coordinate::latitude_to_fixed(degrees: f64) -> i64;
pub fn Coordinate::longitude_to_fixed(degrees: f64) -> i64;

/// Convert fixed-point to degrees
pub fn Coordinate::fixed_to_latitude(fixed: i64) -> f64;
pub fn Coordinate::fixed_to_longitude(fixed: i64) -> f64;

/// Calculate distance in meters
pub fn Coordinate::haversine_distance(
    lat1: i64, lon1: i64,
    lat2: i64, lon2: i64
) -> f64;

/// Calculate bearing in degrees
pub fn Coordinate::bearing(
    lat1: i64, lon1: i64,
    lat2: i64, lon2: i64
) -> f64;
```

## BlockPayload Trait

Implement this trait to create custom payload types:

```rust
pub trait BlockPayload: Send + Sync {
    /// Serialize payload to bytes
    fn to_bytes(&self) -> Vec<u8>;
    
    /// Deserialize payload from bytes
    fn from_bytes(bytes: &[u8]) -> Result<Self, Error>
    where
        Self: Sized;
    
    /// Unique payload type identifier (0x0000-0xFFFF)
    fn payload_type() -> u32;
}
```

### Example Implementation

```rust
#[derive(Serialize, Deserialize)]
pub struct MyData {
    pub id: String,
    pub value: i64,
}

impl BlockPayload for MyData {
    fn to_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(self).unwrap()
    }
    
    fn from_bytes(bytes: &[u8]) -> Result<Self, Error> {
        serde_json::from_slice(bytes)
            .map_err(|e| Error::Deserialization(e.to_string()))
    }
    
    fn payload_type() -> u32 {
        0x1234  // Your unique type ID
    }
}
```

## Error Types

```rust
pub enum Error {
    // Cryptographic errors
    InvalidSignature,
    InvalidPublicKey,
    InvalidSecretKey,
    
    // Chain errors
    BrokenChain,
    InvalidIndex,
    InvalidPreviousHash,
    
    // Timestamp errors
    TimestampTooOld,
    TimestampTooFarInFuture,
    TimestampNotMonotonic,
    
    // Serialization errors
    Serialization(String),
    Deserialization(String),
    
    // Compression errors
    CompressionFailed(String),
    DecompressionFailed(String),
    
    // General errors
    InvalidPayloadType,
    PayloadTooLarge,
    UnsupportedVersion,
}
```

## Constants

```rust
/// Protocol version
pub const VERSION: u16 = 0x0105;

/// Maximum payload size (16 MiB)
pub const MAX_PAYLOAD_SIZE: usize = 16_777_216;

/// Maximum future timestamp drift (5 minutes)
pub const MAX_FUTURE_DRIFT: i64 = 300;

/// Maximum block age (24 hours)
pub const MAX_BLOCK_AGE: i64 = 86_400;

/// Coordinate precision (degrees × 10^7)
pub const COORDINATE_SCALE: i64 = 10_000_000;
```

## Performance Targets

| Operation | Target Time |
|-----------|------------|
| Block creation | < 1ms |
| Block verification | < 1ms |
| SHA-256 hash | < 100μs |
| Ed25519 sign | < 500μs |
| Ed25519 verify | < 1ms |
| Wire encoding | < 2ms |
| Wire decoding | < 2ms |

## Thread Safety

All core types implement `Send + Sync` and are safe to use across threads:

```rust
// Safe to share across threads
let block: Arc<Block<MyPayload>> = Arc::new(block);
let handle = thread::spawn(move || {
    verify_block(&block, None)
});
```

## Next Steps

- [Explore Extensions API](../extensions/overview) - Extension-specific APIs
- [Explore Extensions API](../extensions/overview) - Extension-specific APIs
- [Creating Custom Extensions](../extensions/creating-extensions) - Build your own extensions