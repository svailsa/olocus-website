---
id: quickstart
title: Quick Start
sidebar_position: 1
---

# Quick Start

Get up and running with the Olocus Protocol in 5 minutes.

## Prerequisites

- **Rust 1.75+** - [Install Rust](https://rustup.rs/)
- **Git** - For cloning the repository

That's it! No C dependencies, no complex setup.

## Installation

```bash
# Clone the repository
git clone https://codeberg.org/olocus/protocol.git
cd protocol

# Build everything (pure Rust!)
cargo build --release

# Run tests to verify installation
cargo test

# Try the demo
cargo run --example protocol_demo
```

## Your First Block

Create a simple Rust project:

```bash
cargo new my-olocus-app
cd my-olocus-app
```

Add Olocus to your `Cargo.toml`:

```toml
[dependencies]
olocus-core = { git = "https://codeberg.org/olocus/protocol.git" }
```

Write your first program:

```rust
use olocus_core::*;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Generate a key pair
    let key = generate_key();
    
    // Create a genesis block
    let genesis = Block::genesis(
        EmptyPayload,
        &key,
        current_timestamp()
    );
    
    println!("Created genesis block:");
    println!("  Index: {}", genesis.header.index);
    println!("  Hash: {:?}", genesis.hash());
    
    // Chain another block
    let block2 = Block::next(
        &genesis,
        EmptyPayload,
        &key,
        current_timestamp()
    )?;
    
    // Verify the chain
    verify_block(&genesis, None)?;
    verify_block(&block2, Some(&genesis))?;
    
    println!("✅ Chain verified successfully!");
    
    Ok(())
}
```

Run it:

```bash
cargo run
```

## Using Extensions

Let's use the Location extension to track GPS coordinates:

```rust
use olocus_core::*;
use olocus_location::{LocationPayload, Coordinate};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let key = generate_key();
    
    // Create a location measurement
    let location = Measurement {
        value: Value::Point2D {
            lat: Coordinate::latitude_to_fixed(37.7749),  // San Francisco
            lon: Coordinate::longitude_to_fixed(-122.4194),
        },
        uncertainty: Uncertainty::Circular {
            angle: 0.0,
            radius: 10.0,  // 10 meter accuracy
        },
        provenance: Provenance::default(),
        validity: ValidityWindow::new(
            current_timestamp() as i64,
            Some(current_timestamp() as i64 + 3600)  // Valid for 1 hour
        ),
    };
    
    // Create a block with location data
    let payload = LocationPayload::new(location);
    let block = Block::genesis(payload, &key, current_timestamp());
    
    println!("📍 Location block created at coordinates:");
    println!("  Lat: 37.7749°");
    println!("  Lon: -122.4194°");
    println!("  Accuracy: ±10m");
    
    Ok(())
}
```

## What's Next?

Now that you have the basics working:

- [Build your first chain](./first-chain) - Learn about hash chains
- [Explore extensions](../extensions/overview) - Add features to your application
- [Understand measurements](../concepts/measurements) - Work with uncertain data
- [Review the API](../api/core) - Complete API reference

## Getting Help

- **Documentation**: You're here! 📚
- **Source Code**: [Codeberg Repository](https://codeberg.org/olocus/protocol)
- **Issues**: [Report bugs or request features](https://codeberg.org/olocus/protocol/issues)
- **Discussions**: [GitHub Discussions](https://github.com/svailsa/olocus-website/discussions)

## Pro Tips

:::tip Performance
Use `cargo build --release` for production builds - they're 10-100x faster than debug builds.
:::

:::tip Pure Rust
The default build has zero C dependencies. You can build and run on any platform that supports Rust.
:::

:::tip Extensions
Start with just the core, then add extensions as needed. Each extension is independently versioned.
:::