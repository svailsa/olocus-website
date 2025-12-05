---
id: first-chain
title: Building Your First Chain
sidebar_position: 2
---

# Building Your First Chain

Learn how to create and verify a chain of blocks using the Olocus Protocol.

## What is a Chain?

A chain is a sequence of cryptographically linked blocks. Each block contains:
- A reference to the previous block (hash)
- A timestamp
- A payload (your data)
- A digital signature

## Creating a Chain

```rust
use olocus_core::*;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Generate a key pair for signing
    let key = generate_key();
    
    // Create the genesis (first) block
    let mut chain = vec![];
    let genesis = Block::genesis(
        EmptyPayload,
        &key,
        current_timestamp()
    );
    chain.push(genesis.clone());
    
    // Add more blocks to the chain
    for i in 1..5 {
        let data = format!("Block {}", i);
        let payload = StringPayload(data);
        
        let new_block = Block::next(
            &chain.last().unwrap(),
            payload,
            &key,
            current_timestamp()
        )?;
        
        chain.push(new_block);
    }
    
    println!("Created chain with {} blocks", chain.len());
    Ok(())
}
```

## Verifying a Chain

Always verify the integrity of a chain before trusting its contents:

```rust
fn verify_chain(chain: &[Block<impl BlockPayload>]) -> Result<(), Error> {
    // Verify genesis block
    verify_block(&chain[0], None)?;
    
    // Verify each subsequent block
    for i in 1..chain.len() {
        verify_block(&chain[i], Some(&chain[i-1]))?;
    }
    
    println!("✅ Chain verified successfully!");
    Ok(())
}
```

## Chain Properties

### Immutability
Once a block is added to the chain, it cannot be modified without breaking the cryptographic links.

### Ordering
Blocks are strictly ordered by their index and linked by hash references.

### Non-repudiation
Each block is signed by its creator, providing proof of authorship.

## Advanced Chain Operations

### Finding a Block

```rust
fn find_block_by_index(chain: &[Block<impl BlockPayload>], index: u64) 
    -> Option<&Block<impl BlockPayload>> 
{
    chain.iter().find(|block| block.header.index == index)
}
```

### Chain Metrics

```rust
fn analyze_chain(chain: &[Block<impl BlockPayload>]) {
    let total_blocks = chain.len();
    let first_timestamp = chain.first().unwrap().header.timestamp;
    let last_timestamp = chain.last().unwrap().header.timestamp;
    let duration = last_timestamp - first_timestamp;
    
    println!("Chain Analysis:");
    println!("  Total blocks: {}", total_blocks);
    println!("  Duration: {} seconds", duration);
    println!("  Average block time: {:.2} seconds", 
             duration as f64 / total_blocks as f64);
}
```

## Persistence

Save and load chains from disk:

```rust
use std::fs;

fn save_chain(chain: &[Block<impl BlockPayload>], path: &str) 
    -> Result<(), Box<dyn std::error::Error>> 
{
    let wire_format = WireFormat::json();
    let encoded = wire_format.encode_chain(chain)?;
    fs::write(path, encoded)?;
    Ok(())
}

fn load_chain<P: BlockPayload>(path: &str) 
    -> Result<Vec<Block<P>>, Box<dyn std::error::Error>> 
{
    let data = fs::read(path)?;
    let wire_format = WireFormat::json();
    let chain = wire_format.decode_chain(&data)?;
    Ok(chain)
}
```

## Best Practices

1. **Always verify** chains received from external sources
2. **Use timestamps** appropriately - they should be monotonically increasing
3. **Handle errors** gracefully when blocks fail verification
4. **Store chains** persistently for audit trails
5. **Implement pruning** for long-running chains to manage storage

## Common Issues

### Timestamp Drift
```rust
// Blocks can't be too far in the future
if block.header.timestamp > current_timestamp() + MAX_FUTURE_DRIFT {
    return Err(Error::TimestampTooFarInFuture);
}
```

### Broken Chain
```rust
// Each block must reference the previous block's hash
if block.header.previous != previous_block.hash() {
    return Err(Error::BrokenChain);
}
```

## Next Steps

Now that you understand chains:
- [Learn about Measurements](../concepts/measurements) - Universal data representation
- [Explore Extensions](../extensions/overview) - Add functionality to your chains
- [Implement a Custom Payload](../extensions/creating-extensions) - Store your own data types