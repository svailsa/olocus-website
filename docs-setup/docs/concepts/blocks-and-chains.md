---
id: blocks-and-chains
title: Blocks and Chains
sidebar_position: 1
---

# Blocks and Chains

The fundamental data structures of the Olocus Protocol.

## What is a Block?

A block is a cryptographically signed container for data with these properties:
- **Immutable**: Once created, cannot be modified
- **Verifiable**: Signature proves authenticity
- **Timestamped**: Records when it was created
- **Linked**: References previous blocks to form chains

## Block Structure

```rust
pub struct Block<P: BlockPayload> {
    pub header: BlockHeader,
    pub payload: P,
    pub signature: Signature,
    pub public_key: VerifyingKey,
}

pub struct BlockHeader {
    pub version: u16,         // Protocol version (0x0105)
    pub index: u64,           // Position in chain
    pub timestamp: i64,       // Unix timestamp
    pub previous: [u8; 32],   // Hash of previous block
    pub payload_hash: [u8; 32], // SHA-256 of payload
    pub payload_type: u32,    // Type identifier
}
```

## Key Components

### 1. Header
Contains metadata about the block:
- **Version**: Protocol version for compatibility
- **Index**: Sequential position in the chain (0, 1, 2...)
- **Timestamp**: When the block was created
- **Previous**: Links to the previous block's hash
- **Payload Hash**: Integrity check for the payload
- **Payload Type**: Identifies the type of data

### 2. Payload
The actual data being stored. Can be any type that implements `BlockPayload`:
```rust
pub trait BlockPayload {
    fn to_bytes(&self) -> Vec<u8>;
    fn from_bytes(bytes: &[u8]) -> Result<Self>;
    fn payload_type() -> u32;
}
```

### 3. Signature
Ed25519 signature proving:
- The block was created by the holder of the private key
- The block hasn't been tampered with
- Non-repudiation: creator cannot deny creating it

### 4. Public Key
The Ed25519 public key used to verify the signature.

## What is a Chain?

A chain is a sequence of blocks where each block references the previous one:

```
[Genesis] <- [Block 1] <- [Block 2] <- [Block 3] <- ...
```

### Chain Properties

1. **Genesis Block**: First block with index 0 and no previous hash
2. **Sequential Indices**: Each block's index is previous + 1
3. **Hash Linking**: Each block contains hash of previous
4. **Chronological**: Timestamps must be monotonically increasing
5. **Verifiable**: Can verify entire chain from genesis to tip

## Creating Blocks

### Genesis Block
The first block in any chain:

```rust
use olocus_core::{Block, generate_key, current_timestamp};

let (signing_key, _) = generate_key();
let genesis = Block::genesis(
    my_payload,
    &signing_key,
    current_timestamp()
);

// Genesis block has:
// - index: 0
// - previous: [0; 32] (all zeros)
```

### Subsequent Blocks
Adding to an existing chain:

```rust
let block2 = Block::next(
    &genesis,           // Previous block
    new_payload,        // New data
    &signing_key,       // Can be same or different key
    current_timestamp()
)?;

// Automatically sets:
// - index: 1 (genesis.index + 1)
// - previous: hash of genesis block
```

## Chain Verification

### Single Block
Verify a block's signature and structure:

```rust
use olocus_core::verify_block;

// Verify genesis (no previous)
verify_block(&genesis, None)?;

// Verify chain block (with previous)
verify_block(&block2, Some(&genesis))?;
```

### Entire Chain
Verify all blocks and their connections:

```rust
use olocus_core::verify_chain;

let chain = vec![genesis, block2, block3];
verify_chain(&chain)?;

// Verifies:
// ✓ All signatures valid
// ✓ Indices increment properly
// ✓ Previous hashes match
// ✓ Timestamps increase
// ✓ No gaps or forks
```

## Hash Calculation

Blocks are identified by their SHA-256 hash:

```rust
let hash = block.hash();  // [u8; 32]

// Hash includes:
// - All header fields
// - Payload hash
// - Public key
// - Signature
```

## Use Cases

### 1. Audit Trail
Immutable record of events:
```rust
struct AuditEntry {
    action: String,
    user: String,
    timestamp: u64,
}
```

### 2. Sensor Data
Timestamped measurements:
```rust
struct SensorReading {
    temperature: f32,
    humidity: f32,
    location: (f64, f64),
}
```

### 3. Trust Attestations
Cryptographic proofs:
```rust
struct Attestation {
    claim: String,
    witness: PublicKey,
    evidence: Vec<u8>,
}
```

## Security Properties

### Tamper Evidence
Any modification breaks the chain:
- Changing payload invalidates payload hash
- Changing header invalidates signature
- Changing any block breaks all subsequent links

### Non-Repudiation
Signatures prove who created each block:
- Cannot deny creating a signed block
- Cannot forge someone else's signature
- Public key identifies the creator

### Temporal Ordering
Timestamps and indices ensure order:
- Cannot insert blocks in the past
- Cannot reorder blocks
- Maintains chronological sequence

## Performance

| Operation | Time |
|-----------|------|
| Create block | &lt;1ms |
| Verify block | &lt;1ms |
| Calculate hash | &lt;100μs |
| Verify chain (1000 blocks) | &lt;1s |

## Best Practices

### 1. Key Management
- Keep signing keys secure
- Consider key rotation
- Different keys for different trust domains

### 2. Timestamp Accuracy
- Use reliable time sources
- Consider NTP synchronization
- Account for clock drift

### 3. Payload Size
- Keep payloads reasonable (&lt;16MB)
- Consider off-chain storage for large data
- Use hashes for external references

### 4. Chain Length
- Consider periodic snapshots
- Implement pruning strategies
- Use merkle trees for aggregation

## Example: Simple Event Chain

```rust
use olocus_core::*;
use serde::{Serialize, Deserialize};

#[derive(Clone, Serialize, Deserialize)]
struct Event {
    id: String,
    action: String,
    metadata: HashMap<String, String>,
}

impl BlockPayload for Event {
    fn to_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(self).unwrap()
    }
    
    fn from_bytes(bytes: &[u8]) -> Result<Self> {
        Ok(serde_json::from_slice(bytes)?)
    }
    
    fn payload_type() -> u32 {
        0x0001  // Event type
    }
}

fn main() -> Result<()> {
    let (key, _) = generate_key();
    let mut chain = Vec::new();
    
    // Create genesis with first event
    let event1 = Event {
        id: "evt_001".into(),
        action: "system_start".into(),
        metadata: HashMap::new(),
    };
    
    let genesis = Block::genesis(event1, &key, current_timestamp());
    chain.push(genesis.clone());
    
    // Add more events
    for i in 2..=10 {
        let event = Event {
            id: format!("evt_{:03}", i),
            action: format!("action_{}", i),
            metadata: HashMap::new(),
        };
        
        let block = Block::next(
            chain.last().unwrap(),
            event,
            &key,
            current_timestamp()
        )?;
        
        chain.push(block);
    }
    
    // Verify entire chain
    verify_chain(&chain)?;
    println!("Chain valid! {} blocks", chain.len());
    
    Ok(())
}
```

## Next Steps

- [Understanding Measurements](./measurements) - Data with uncertainty
- [Cryptographic Primitives](./cryptographic-primitives) - Security foundations
- [Wire Format](./wire-format) - Serialization and transport
- [Block Operations API](../api/block-operations) - Detailed API reference