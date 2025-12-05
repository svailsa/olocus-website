---
id: block-operations
title: Block Operations API
sidebar_position: 2
---

# Block Operations API

Core APIs for creating, verifying, and managing blocks in the Olocus Protocol.

## Block Structure

```rust
pub struct Block<P: BlockPayload> {
    pub header: BlockHeader,
    pub payload: P,
    pub signature: Signature,
    pub public_key: VerifyingKey,
}

pub struct BlockHeader {
    pub version: u16,        // Protocol version (0x0105)
    pub index: u64,          // Block index in chain
    pub timestamp: i64,      // Unix timestamp
    pub previous: [u8; 32],  // Previous block hash
    pub payload_hash: [u8; 32], // SHA-256 of payload
    pub payload_type: u32,   // Payload type identifier
}
```

## Creating Blocks

### Genesis Block

Create the first block in a chain:

```rust
use olocus_core::{Block, generate_key, current_timestamp};

// Generate keypair
let (signing_key, verifying_key) = generate_key();

// Create genesis block
let genesis = Block::genesis(
    payload,           // Your payload implementing BlockPayload
    &signing_key,      // Ed25519 signing key
    current_timestamp() // Current Unix timestamp
);

// Genesis block has:
// - index: 0
// - previous: [0; 32] (all zeros)
```

### Subsequent Blocks

Create blocks that follow a genesis or previous block:

```rust
// Create next block
let block2 = Block::next(
    &genesis,          // Previous block reference
    new_payload,       // New payload
    &signing_key,      // Same or different key
    current_timestamp()
)?;

// Automatically sets:
// - index: previous.index + 1
// - previous: hash of previous block
// - proper chain linking
```

## Block Verification

### Single Block Verification

```rust
use olocus_core::verify_block;

// Verify standalone block (e.g., genesis)
verify_block(&genesis, None)?;

// Verify block in chain
verify_block(&block2, Some(&genesis))?;

// Verification checks:
// ✓ Valid Ed25519 signature
// ✓ Correct payload hash
// ✓ Valid timestamp (not too old/future)
// ✓ Proper chain linking (if previous provided)
// ✓ Monotonic index increment
```

### Chain Verification

```rust
use olocus_core::verify_chain;

let chain = vec![genesis, block2, block3];

// Verify entire chain
verify_chain(&chain)?;

// Checks all blocks plus:
// ✓ Continuous hash chain
// ✓ Monotonic timestamps
// ✓ No gaps in indices
```

## BlockPayload Trait

Implement this trait for custom payload types:

```rust
use olocus_core::{BlockPayload, Error};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MyPayload {
    pub data: String,
    pub value: u64,
}

impl BlockPayload for MyPayload {
    fn to_bytes(&self) -> Vec<u8> {
        // Must be deterministic!
        serde_json::to_vec(self).unwrap()
    }
    
    fn from_bytes(bytes: &[u8]) -> Result<Self, Error> {
        serde_json::from_slice(bytes)
            .map_err(|e| Error::Deserialization(e.to_string()))
    }
    
    fn payload_type() -> u32 {
        0x8000  // Your unique type (0x8000-0xFFFF for custom)
    }
}
```

## Hash Operations

### Block Hashing

```rust
// Get block hash (SHA-256)
let hash: [u8; 32] = block.hash();

// Hash includes:
// - All header fields
// - Payload hash
// - Public key
// - Signature

// Used for:
// - Chain linking (previous field)
// - Content addressing
// - Deduplication
```

### Payload Hashing

```rust
// Payload is hashed separately
let payload_bytes = payload.to_bytes();
let payload_hash = olocus_core::hash(&payload_bytes);

// Enables:
// - Payload verification without full block
// - Efficient payload comparison
// - Merkle tree construction
```

## Timestamp Handling

### Current Timestamp

```rust
use olocus_core::current_timestamp;

// Get current Unix timestamp
let now: u64 = current_timestamp();

// Used for block creation
let block = Block::genesis(payload, &key, now);
```

### Timestamp Validation

```rust
// Constants for validation
pub const MAX_FUTURE_DRIFT: i64 = 300;  // 5 minutes
pub const MAX_BLOCK_AGE: i64 = 86400;   // 24 hours

// Validation rules:
// - Not more than 5 minutes in future
// - Not more than 24 hours old
// - Must be >= previous block timestamp
```

## Key Management

### Key Generation

```rust
use olocus_core::generate_key;

// Generate Ed25519 keypair
let (signing_key, verifying_key) = generate_key();

// signing_key: [u8; 32] - Keep secret!
// verifying_key: [u8; 32] - Public, share freely
```

### Key Rotation

```rust
// Blocks can use different keys
let block1 = Block::genesis(payload1, &key1, timestamp);
let block2 = Block::next(&block1, payload2, &key2, timestamp)?;

// Each block is independently signed
// Enables key rotation without breaking chain
```

## Error Handling

```rust
use olocus_core::Error;

match verify_block(&block, Some(&previous)) {
    Ok(()) => println!("Block valid!"),
    Err(Error::InvalidSignature) => {
        println!("Signature verification failed");
    }
    Err(Error::InvalidPayloadHash) => {
        println!("Payload hash mismatch");
    }
    Err(Error::BrokenChain) => {
        println!("Chain continuity broken");
    }
    Err(Error::InvalidTimestamp { expected, actual }) => {
        println!("Timestamp issue: expected {}, got {}", expected, actual);
    }
    Err(e) => println!("Other error: {}", e),
}
```

## Advanced Operations

### Batch Operations

```rust
// Create multiple blocks efficiently
let mut blocks = Vec::new();
let mut previous = genesis;

for payload in payloads {
    let block = Block::next(&previous, payload, &key, current_timestamp())?;
    blocks.push(block.clone());
    previous = block;
}

// Verify batch
verify_chain(&blocks)?;
```

### Parallel Verification

```rust
use rayon::prelude::*;

// Verify signatures in parallel
let results: Vec<_> = blocks
    .par_iter()
    .map(|block| block.verify_signature())
    .collect();

// Check results
for result in results {
    result?;
}
```

### Block Filtering

```rust
// Find blocks by payload type
let location_blocks: Vec<_> = chain
    .iter()
    .filter(|block| block.header.payload_type == 0x0100)
    .collect();

// Find blocks by time range
let recent: Vec<_> = chain
    .iter()
    .filter(|block| {
        block.header.timestamp > (current_timestamp() - 3600) as i64
    })
    .collect();
```

## Performance Tips

### Optimization Strategies

1. **Batch Operations**
   ```rust
   // Good: Batch verify
   verify_chain(&blocks)?;
   
   // Avoid: Individual verification in loop
   for block in blocks {
       verify_block(&block, prev)?;
   }
   ```

2. **Lazy Verification**
   ```rust
   // Verify only when needed
   if untrusted_source {
       verify_block(&block, None)?;
   }
   ```

3. **Caching Hashes**
   ```rust
   // Cache computed hashes
   let hash = block.hash();
   hash_cache.insert(block.header.index, hash);
   ```

### Benchmarks

| Operation | Time | Throughput |
|-----------|------|------------|
| Block creation | < 1ms | > 1000/sec |
| Signature verification | < 1ms | > 1000/sec |
| SHA-256 hash | < 100μs | > 10000/sec |
| Chain verify (1000 blocks) | < 1s | > 1000/sec |

## Code Examples

### Complete Example

```rust
use olocus_core::*;

fn main() -> Result<(), Error> {
    // 1. Generate keys
    let (signing_key, verifying_key) = generate_key();
    
    // 2. Create payload
    let payload = MyPayload {
        data: "Hello Olocus".to_string(),
        value: 42,
    };
    
    // 3. Create genesis block
    let genesis = Block::genesis(
        payload.clone(),
        &signing_key,
        current_timestamp()
    );
    
    // 4. Verify genesis
    verify_block(&genesis, None)?;
    println!("Genesis hash: {:?}", genesis.hash());
    
    // 5. Create next block
    let payload2 = MyPayload {
        data: "Second block".to_string(),
        value: 100,
    };
    
    let block2 = Block::next(
        &genesis,
        payload2,
        &signing_key,
        current_timestamp()
    )?;
    
    // 6. Verify chain
    let chain = vec![genesis, block2];
    verify_chain(&chain)?;
    
    println!("Chain verified! Length: {}", chain.len());
    
    Ok(())
}
```

## See Also

- [Core API Overview](./core)
- [Cryptographic Operations](./cryptographic-operations)
- [Wire Format](./wire-format-api)
- [Error Handling](./error-handling)