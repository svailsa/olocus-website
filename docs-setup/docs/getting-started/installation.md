---
id: installation
title: Installation Guide
sidebar_position: 2
---

# Installation Guide

Get Olocus Protocol up and running on your system in minutes.

## System Requirements

### Minimum Requirements
- **Rust**: 1.75 or higher
- **RAM**: 512 MB
- **Disk**: 100 MB

### That's It! 🎉
No C compilers, no system libraries, no complex dependencies. Pure Rust, zero external C dependencies.

## Installation Methods

### From Source (Recommended)

```bash
# Clone from Codeberg (primary)
git clone https://codeberg.org/olocus/protocol.git
cd protocol

# Or from GitHub mirror (deprecated)
git clone https://github.com/olocus/protocol.git
cd protocol

# Build everything (pure Rust!)
cargo build --release

# Run tests (1,400+ passing!)
cargo test

# Try the demo
cargo run --example protocol_demo
```

### Using Cargo

```bash
# Install core library
cargo add olocus-core

# Add extensions as needed
cargo add olocus-location
cargo add olocus-trust
cargo add olocus-privacy
```

### Platform-Specific Instructions

#### macOS
```bash
# Install Rust if needed
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Clone and build
git clone https://codeberg.org/olocus/protocol.git
cd protocol
cargo build --release
```

#### Linux
```bash
# Install Rust if needed
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Clone and build
git clone https://codeberg.org/olocus/protocol.git
cd protocol
cargo build --release
```

#### Windows
```powershell
# Install Rust from https://rustup.rs
# Then in PowerShell:
git clone https://codeberg.org/olocus/protocol.git
cd protocol
cargo build --release
```

## Verify Installation

Run the basic verification:

```bash
# Check version
cargo run --example get_version

# Output should be:
# Olocus Protocol v1.19.0
# Wire Version: 0x0105
```

## Build Options

### Minimal Build (Core Only)
```bash
# Just the core (500 lines!)
cargo build -p olocus-core --release
```

### Standard Build (Core + Common Extensions)
```bash
# Core + Location + Trust + Privacy
cargo build --release -p olocus-core \
  -p olocus-location \
  -p olocus-trust \
  -p olocus-privacy
```

### Full Build (Everything)
```bash
# All 23 extensions
cargo build --all --release
```

### Development Build
```bash
# Debug mode with symbols
cargo build

# With verbose output
cargo build -vv

# Run specific tests
cargo test -p olocus-core
```

## Optional Features

Some extensions have optional features:

```toml
[dependencies]
olocus-core = "0.1"
olocus-storage = { version = "0.1", features = ["rocksdb"] }
olocus-metrics = { version = "0.1", features = ["prometheus"] }
```

## Docker Installation

```dockerfile
FROM rust:1.75-slim
WORKDIR /app
COPY . .
RUN cargo build --release
CMD ["./target/release/olocus-demo"]
```

Build and run:
```bash
docker build -t olocus .
docker run -it olocus
```

## Mobile Development

### iOS
See [iOS Integration Guide](../integration/ios)

### Android
See [Android Integration Guide](../integration/android)

## WebAssembly

```bash
# Install wasm-pack
cargo install wasm-pack

# Build for web
wasm-pack build --target web

# Build for Node.js
wasm-pack build --target nodejs
```

## Troubleshooting

### Common Issues

**Issue**: `cargo: command not found`
**Solution**: Install Rust from https://rustup.rs

**Issue**: Build fails with "cannot find -lssl"
**Solution**: You don't need OpenSSL! Make sure you're building from the official repo.

**Issue**: Out of memory during build
**Solution**: Use `cargo build -j 1` to limit parallel jobs

## Next Steps

✅ Installation complete! Now you're ready to:

- [Create your first block chain](./first-chain)
- [Understand measurements](./understanding-measurements)
- [Choose extensions](./choosing-extensions)
- [Browse the API](../api/core)

## Getting Help

- 📖 [Documentation](https://olocus.com/docs)
- 💬 [Discussions](https://codeberg.org/olocus/forum/issues)
- 🐛 [Issues](https://codeberg.org/olocus/protocol/issues)
- 📧 [Email](mailto:support@olocus.com)