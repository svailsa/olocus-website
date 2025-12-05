---
id: wire-format-api
title: Wire Format API
sidebar_position: 3
---

# Wire Format API

The Wire Format API provides extensible encoding and compression for block serialization. It supports multiple formats and compression methods with automatic content-type negotiation.

## Overview

The wire format system supports:

- **5 Encoding Formats**: Binary (default), JSON, MessagePack, SSZ, Protobuf
- **4 Compression Methods**: None, Zstd, LZ4, Gzip
- **20 Total Combinations**: All encoding/compression pairs are supported
- **Content Negotiation**: HTTP-style content-type headers for format detection

## WireFormat Structure

```rust
use olocus_core::wire_format::{WireFormat, EncodingFormat, CompressionMethod};

// Basic wire format
let format = WireFormat::new(
    EncodingFormat::MessagePack,
    CompressionMethod::Zstd,
);

// Convenience constructors
let binary = WireFormat::binary();    // Default: Binary + None
let json = WireFormat::json();        // JSON + None  
let msgpack = WireFormat::msgpack();  // MessagePack + None
```

## Encoding Formats

### Binary Format (Default)

The canonical binary format optimized for performance and space efficiency:

```rust
let format = WireFormat::binary();
let encoded = format.encode(&block)?;

// Properties:
// - Fastest encoding/decoding
// - Smallest size (no overhead)
// - SSZ-compatible layout
// - Deterministic representation
```

### JSON Format

Human-readable JSON for debugging and interoperability:

```rust
let format = WireFormat::json();
let encoded = format.encode(&block)?;

// Verify it's valid JSON
let json_str = std::str::from_utf8(&encoded)?;
println!("Block as JSON: {}", json_str);

// Properties:
// - Human readable
// - Debuggable
// - Larger size
// - Hex-encoded binary fields
```

### MessagePack Format

Efficient binary JSON alternative:

```rust
let format = WireFormat::msgpack();
let encoded = format.encode(&block)?;

// Properties:
// - Faster than JSON
// - Smaller than JSON
// - Binary efficient
// - Schema-less
```

### SSZ Format

Simple Serialize format used in Ethereum 2.0:

```rust
let format = WireFormat::new(EncodingFormat::SSZ, CompressionMethod::None);
let encoded = format.encode(&block)?;

// Properties:
// - Ethereum ecosystem compatibility
// - Merkle tree friendly
// - Fixed-size fields
// - Zero-copy parsing potential
```

### Protobuf Format

Protocol Buffers compatible encoding:

```rust
let format = WireFormat::new(EncodingFormat::Protobuf, CompressionMethod::None);
let encoded = format.encode(&block)?;

// Properties:
// - Cross-language compatibility
// - Schema evolution support
// - Tag-length-value encoding
// - Backwards compatibility
```

## Compression Methods

### No Compression

Default mode with no processing overhead:

```rust
let format = WireFormat::new(EncodingFormat::Binary, CompressionMethod::None);

// Properties:
// - Zero overhead
// - Fastest processing
// - Largest size
// - Direct binary representation
```

### Zstd Compression

High-performance compression with excellent ratios:

```rust
let format = WireFormat::new(EncodingFormat::Binary, CompressionMethod::Zstd);

// Properties:
// - Best compression ratio
// - Fast decompression
// - Requires 'compression-zstd' feature
// - Falls back to LZ4 if unavailable
```

### LZ4 Compression

Fast compression with reasonable ratios:

```rust
let format = WireFormat::new(EncodingFormat::Binary, CompressionMethod::Lz4);

// Properties:
// - Fastest compression
// - Good decompression speed
// - Moderate compression ratio
// - Always available
```

### Gzip Compression

Standard compression for HTTP compatibility:

```rust
let format = WireFormat::new(EncodingFormat::Binary, CompressionMethod::Gzip);

// Properties:
// - HTTP standard
// - Wide compatibility
// - Slower than LZ4/Zstd
// - Good compression ratio
```

## Encoding and Decoding

### Basic Operations

```rust
use olocus_core::{Block, EmptyPayload, wire_format::WireFormat};

// Create a block
let block = Block::genesis(EmptyPayload, &key, timestamp);

// Encode with different formats
let binary_data = WireFormat::binary().encode(&block)?;
let json_data = WireFormat::json().encode(&block)?;
let msgpack_data = WireFormat::msgpack().encode(&block)?;

// Decode back to blocks
let decoded_binary: Block<EmptyPayload> = WireFormat::binary().decode(&binary_data)?;
let decoded_json: Block<EmptyPayload> = WireFormat::json().decode(&json_data)?;
let decoded_msgpack: Block<EmptyPayload> = WireFormat::msgpack().decode(&msgpack_data)?;

// All should be equivalent
assert_eq!(decoded_binary.header.index, block.header.index);
assert_eq!(decoded_json.signature, block.signature);
assert_eq!(decoded_msgpack.public_key, block.public_key);
```

### Error Handling

```rust
use olocus_core::Error;

match format.decode::<MyPayload>(&data) {
    Ok(block) => {
        println!("Successfully decoded block {}", block.header.index);
    }
    Err(Error::MalformedBlock) => {
        eprintln!("Invalid block data - corrupted or wrong format");
    }
    Err(e) => {
        eprintln!("Decode error: {}", e);
    }
}
```

## Content-Type Negotiation

### Generate Content-Type Headers

```rust
// Get content type for HTTP headers
let content_type = format.content_type();

match format.encoding {
    EncodingFormat::Binary => {
        assert_eq!(content_type, "application/x-olocus-block");
    }
    EncodingFormat::Json => {
        assert_eq!(content_type, "application/json");
    }
    // ... etc
}

// With compression
let compressed_format = WireFormat::new(
    EncodingFormat::Json,
    CompressionMethod::Gzip,
);
assert_eq!(compressed_format.content_type(), "application/json+gzip");
```

### Parse Content-Type Headers

```rust
// Parse incoming content type
if let Some(format) = WireFormat::from_content_type("application/x-msgpack+zstd") {
    let block = format.decode::<MyPayload>(&data)?;
    println!("Decoded MessagePack+Zstd block");
} else {
    eprintln!("Unsupported content type");
}

// Common content types
let formats = [
    ("application/x-olocus-block", WireFormat::binary()),
    ("application/json", WireFormat::json()),
    ("application/x-msgpack", WireFormat::msgpack()),
    ("application/json+gzip", WireFormat::new(EncodingFormat::Json, CompressionMethod::Gzip)),
];
```

## Performance Comparison

### Size Comparison

For typical blocks, expect these relative sizes:

```rust
// Example sizes for a standard block (approximate)
// Binary:     450 bytes  (baseline)
// SSZ:        450 bytes  (same as binary)
// MessagePack: 380 bytes  (-15% vs binary)
// Protobuf:   490 bytes  (+9% vs binary)
// JSON:       680 bytes  (+51% vs binary)

fn compare_sizes<P: BlockPayload>(block: &Block<P>) {
    let binary_size = WireFormat::binary().encode(block).unwrap().len();
    let json_size = WireFormat::json().encode(block).unwrap().len();
    let msgpack_size = WireFormat::msgpack().encode(block).unwrap().len();
    
    println!("Binary: {} bytes", binary_size);
    println!("JSON: {} bytes (+{:.1}%)", json_size, 
             (json_size as f64 / binary_size as f64 - 1.0) * 100.0);
    println!("MessagePack: {} bytes ({:.1}%)", msgpack_size,
             (msgpack_size as f64 / binary_size as f64 - 1.0) * 100.0);
}
```

### Compression Efficiency

```rust
// Test compression on a larger block
let large_block = create_block_with_large_payload(); // 10KB payload

let uncompressed = WireFormat::binary().encode(&large_block).unwrap();
let zstd = WireFormat::new(EncodingFormat::Binary, CompressionMethod::Zstd)
    .encode(&large_block).unwrap();
let lz4 = WireFormat::new(EncodingFormat::Binary, CompressionMethod::Lz4)
    .encode(&large_block).unwrap();
let gzip = WireFormat::new(EncodingFormat::Binary, CompressionMethod::Gzip)
    .encode(&large_block).unwrap();

// Typical compression ratios (depends on payload):
// Zstd:  ~60-70% compression
// Gzip:  ~55-65% compression  
// LZ4:   ~40-50% compression
```

### Performance Benchmarks

Target performance for block operations:

| Operation | Time | Notes |
|-----------|------|-------|
| Binary encode | < 100μs | Fastest |
| Binary decode | < 100μs | Fastest |
| MessagePack encode | < 200μs | Good balance |
| MessagePack decode | < 200μs | Good balance |
| JSON encode | < 500μs | Human readable |
| JSON decode | < 300μs | Parsing overhead |
| Zstd compress | < 1ms | Best ratio |
| LZ4 compress | < 200μs | Fastest compression |
| Gzip compress | < 800μs | Standard |

## Advanced Usage

### Custom Payload Types

```rust
use serde::{Serialize, Deserialize};
use olocus_core::BlockPayload;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CustomPayload {
    pub data: String,
    pub metrics: Vec<f64>,
    pub metadata: std::collections::HashMap<String, String>,
}

impl BlockPayload for CustomPayload {
    fn to_bytes(&self) -> Vec<u8> {
        // Use deterministic serialization
        rmp_serde::to_vec(self).unwrap()
    }
    
    fn from_bytes(bytes: &[u8]) -> Result<Self, olocus_core::Error> {
        rmp_serde::from_slice(bytes)
            .map_err(|_| olocus_core::Error::MalformedBlock)
    }
    
    fn payload_type() -> u32 {
        0x8001 // Custom type ID
    }
}

// Works with all wire formats
let block = Block::genesis(custom_payload, &key, timestamp);
let formats = [
    WireFormat::binary(),
    WireFormat::json(),
    WireFormat::msgpack(),
];

for format in &formats {
    let encoded = format.encode(&block)?;
    let decoded: Block<CustomPayload> = format.decode(&encoded)?;
    assert_eq!(decoded.payload.data, block.payload.data);
}
```

### Streaming Large Blocks

For very large blocks, consider streaming approaches:

```rust
use std::io::{Write, Read};

fn stream_encode<P: BlockPayload, W: Write>(
    block: &Block<P>, 
    format: WireFormat,
    mut writer: W
) -> Result<(), Box<dyn std::error::Error>> {
    let encoded = format.encode(block)?;
    writer.write_all(&encoded)?;
    Ok(())
}

fn stream_decode<P: BlockPayload + From<Vec<u8>>, R: Read>(
    format: WireFormat,
    mut reader: R
) -> Result<Block<P>, Box<dyn std::error::Error>> {
    let mut buffer = Vec::new();
    reader.read_to_end(&mut buffer)?;
    let block = format.decode(&buffer)?;
    Ok(block)
}
```

### Format Migration

```rust
// Convert between formats without re-signing
fn convert_format<P: BlockPayload + From<Vec<u8>>>(
    data: &[u8],
    from: WireFormat,
    to: WireFormat,
) -> Result<Vec<u8>, olocus_core::Error> {
    let block: Block<P> = from.decode(data)?;
    to.encode(&block)
}

// Example: JSON to MessagePack
let json_data = get_json_block_data();
let msgpack_data = convert_format::<EmptyPayload>(
    &json_data,
    WireFormat::json(),
    WireFormat::msgpack(),
)?;
```

## HTTP Integration

### Server Implementation

```rust
use axum::{body::Bytes, extract::Query, http::HeaderMap, response::Response};
use std::collections::HashMap;

async fn submit_block(
    headers: HeaderMap,
    body: Bytes,
) -> Result<Response, StatusCode> {
    // Parse content type
    let content_type = headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/x-olocus-block");
    
    let format = WireFormat::from_content_type(content_type)
        .ok_or(StatusCode::UNSUPPORTED_MEDIA_TYPE)?;
    
    // Decode block
    let block: Block<MyPayload> = format
        .decode(&body)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    
    // Process block...
    process_block(block).await?;
    
    Ok(Response::new("Block accepted".into()))
}

async fn get_block(
    Query(params): Query<HashMap<String, String>>,
) -> Result<Response, StatusCode> {
    let hash = params.get("hash")
        .ok_or(StatusCode::BAD_REQUEST)?;
    
    let block = lookup_block(hash)
        .ok_or(StatusCode::NOT_FOUND)?;
    
    // Default to binary, but could negotiate
    let format = WireFormat::binary();
    let encoded = format.encode(&block)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Response::builder()
        .header("content-type", format.content_type())
        .body(encoded.into())
        .unwrap()
}
```

### Client Implementation

```rust
use reqwest::Client;

struct BlockClient {
    client: Client,
    base_url: String,
    preferred_format: WireFormat,
}

impl BlockClient {
    pub fn new(base_url: String) -> Self {
        Self {
            client: Client::new(),
            base_url,
            preferred_format: WireFormat::msgpack(), // Efficient default
        }
    }
    
    pub async fn submit_block<P: BlockPayload>(
        &self,
        block: &Block<P>
    ) -> Result<(), Box<dyn std::error::Error>> {
        let encoded = self.preferred_format.encode(block)?;
        
        let response = self.client
            .post(&format!("{}/blocks", self.base_url))
            .header("content-type", self.preferred_format.content_type())
            .body(encoded)
            .send()
            .await?;
        
        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!("Server error: {}", response.status()).into())
        }
    }
    
    pub async fn get_block<P: BlockPayload + From<Vec<u8>>>(
        &self,
        hash: &[u8; 32]
    ) -> Result<Block<P>, Box<dyn std::error::Error>> {
        let hash_hex = hex::encode(hash);
        let url = format!("{}/blocks?hash={}", self.base_url, hash_hex);
        
        let response = self.client.get(&url).send().await?;
        let data = response.bytes().await?;
        
        // Try to detect format from content-type
        let content_type = response.headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("application/x-olocus-block");
        
        let format = WireFormat::from_content_type(content_type)
            .unwrap_or(WireFormat::binary());
        
        Ok(format.decode(&data)?)
    }
}
```

## Configuration and Feature Flags

### Cargo Features

```toml
# In Cargo.toml
[dependencies]
olocus-core = { version = "1.16.1", features = ["compression-zstd"] }

# Available features:
# - compression-zstd: Enable Zstd compression (requires libclang)
# - default: Core functionality only
```

### Runtime Feature Detection

```rust
// Check if Zstd is available
let format = WireFormat::new(EncodingFormat::Binary, CompressionMethod::Zstd);

#[cfg(feature = "compression-zstd")]
{
    // Zstd is available
    let compressed = format.encode(&block)?;
}

#[cfg(not(feature = "compression-zstd"))]
{
    // Will automatically fall back to LZ4
    let compressed = format.encode(&block)?;
}
```

## Error Conditions

Common error scenarios and handling:

```rust
use olocus_core::Error;

// Malformed data
match format.decode::<MyPayload>(&corrupted_data) {
    Err(Error::MalformedBlock) => {
        // Data is corrupted, wrong format, or incomplete
        eprintln!("Block data is malformed");
    }
    _ => {}
}

// Unsupported content type
if let Some(format) = WireFormat::from_content_type("text/plain") {
    // This will be None - content type not supported
} else {
    eprintln!("Content type 'text/plain' is not supported");
}

// Compression errors (rare - usually indicate system issues)
match format.encode(&block) {
    Err(Error::MalformedBlock) => {
        // Could indicate compression failure
        eprintln!("Failed to compress block data");
    }
    _ => {}
}
```

## Best Practices

### Format Selection Guidelines

1. **Binary**: Default choice for production systems
   - Fastest and most compact
   - Use for block storage and high-performance networks

2. **MessagePack**: Good balance of efficiency and flexibility
   - Use for APIs where some human readability is helpful
   - Better than JSON for network protocols

3. **JSON**: Use only for debugging and development
   - Human readable but larger and slower
   - Good for testing and diagnostics

4. **SSZ**: Use for Ethereum ecosystem integration
   - Required for some blockchain interoperability
   - Merkle-tree friendly

5. **Protobuf**: Use for cross-language systems
   - When working with non-Rust systems
   - Schema evolution requirements

### Compression Guidelines

1. **None**: Use for small blocks or when CPU is constrained
2. **LZ4**: Good default for real-time systems
3. **Zstd**: Best for storage or when compression ratio matters
4. **Gzip**: Use only for HTTP compatibility requirements

### Implementation Tips

```rust
// Cache format instances
struct FormatCache {
    binary: WireFormat,
    json: WireFormat,
    msgpack_compressed: WireFormat,
}

impl Default for FormatCache {
    fn default() -> Self {
        Self {
            binary: WireFormat::binary(),
            json: WireFormat::json(),
            msgpack_compressed: WireFormat::new(
                EncodingFormat::MessagePack,
                CompressionMethod::Zstd,
            ),
        }
    }
}

// Validate round-trip for custom payloads
fn test_format_roundtrip<P: BlockPayload + From<Vec<u8>> + PartialEq>(
    block: &Block<P>,
    format: WireFormat
) -> bool {
    if let Ok(encoded) = format.encode(block) {
        if let Ok(decoded) = format.decode::<P>(&encoded) {
            return *block == decoded;
        }
    }
    false
}
```

## See Also

- [Block Operations API](./block-operations) - Working with blocks
- [Core API Overview](./core) - Protocol fundamentals
- [Error Handling](./error-handling) - Error codes and handling
- [HTTP Extension](../extensions/http) - HTTP server implementation
