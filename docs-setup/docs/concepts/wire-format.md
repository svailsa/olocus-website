---
id: wire-format
title: Wire Format
sidebar_position: 1
---

# Wire Format

The Olocus Protocol wire format is designed for flexibility, efficiency, and extensibility. It supports multiple encoding formats and compression methods, allowing applications to choose the optimal representation for their specific needs.

## Supported Formats

The protocol supports 5 encoding formats and 4 compression methods, providing 20 possible combinations:

### Encoding Formats

1. **Binary** (default) - Compact binary representation
2. **JSON** - Human-readable for debugging and web APIs
3. **MessagePack** - Efficient binary serialization
4. **Protobuf** - Language-neutral structured data
5. **SSZ** - Simple Serialize (Ethereum-compatible)

### Compression Methods

1. **None** (default) - No compression
2. **Zstd** - Best compression ratio, good speed
3. **LZ4** - Fastest compression, good ratio
4. **Gzip** - Widely supported, moderate compression

## WireFormat Structure

The `WireFormat` type combines encoding and compression:

```rust
pub struct WireFormat {
    pub encoding: EncodingFormat,
    pub compression: CompressionMethod,
}
```

### Creating Wire Formats

```rust
// Common presets
let binary = WireFormat::binary();        // Binary + None
let json = WireFormat::json();            // JSON + None
let msgpack = WireFormat::msgpack();      // MessagePack + None

// Custom combinations
let compressed_binary = WireFormat::new(
    EncodingFormat::Binary, 
    CompressionMethod::Zstd
);
let compressed_json = WireFormat::new(
    EncodingFormat::Json, 
    CompressionMethod::Gzip
);
```

## Content Type Negotiation

Each wire format has an associated content type for HTTP-style negotiation:

| Format | Content Type |
|--------|-------------|
| Binary | `application/x-olocus-block` |
| JSON | `application/json` |
| MessagePack | `application/x-msgpack` |
| Protobuf | `application/x-protobuf` |
| SSZ | `application/x-ssz` |

### Compression Suffixes

Compression is indicated by adding a suffix:

- **Zstd**: `application/x-olocus-block+zstd`
- **LZ4**: `application/json+lz4`
- **Gzip**: `application/x-msgpack+gzip`

### Content Type Parsing

```rust
// Parse content type to wire format
let format = WireFormat::from_content_type("application/json+gzip")?;
assert_eq!(format.encoding, EncodingFormat::Json);
assert_eq!(format.compression, CompressionMethod::Gzip);

// Generate content type from format
let content_type = format.content_type(); // "application/json+gzip"
```

## Encoding Process

The wire format encoding follows a two-stage process:

1. **Serialize** the block using the specified encoding format
2. **Compress** the serialized data using the specified compression method

```rust
// Encode a block
let block = /* your block */;
let format = WireFormat::new(EncodingFormat::Json, CompressionMethod::Zstd);
let encoded = format.encode(&block)?;

// Decode back to block
let decoded: Block<MyPayload> = format.decode(&encoded)?;
```

## Binary Format (Default)

The binary format is the most compact and efficient:

### Block Structure

```
┌─────────────────┬─────────┬───────────┬─────────────┐
│ Header (86B)    │ Payload │ Signature │ Public Key  │
│                 │ (var)   │ (64B)     │ (32B)       │
└─────────────────┴─────────┴───────────┴─────────────┘
```

### Header Layout (86 bytes)

```
Offset  Field          Size   Description
0-1     version        2B     Protocol version (little-endian)
2-9     index          8B     Block index (little-endian)
10-17   timestamp      8B     Unix timestamp (little-endian)
18-49   previous       32B    Previous block hash
50-81   payload_hash   32B    SHA-256 of payload
82-85   payload_type   4B     Payload type ID (little-endian)
```

## JSON Format

JSON format provides human-readable representation for debugging and web APIs:

```json
{
  "header": {
    "version": 1,
    "index": 42,
    "timestamp": 1640995200,
    "previous": "a1b2c3d4...",
    "payload_hash": "e5f6789a...",
    "payload_type": 1001
  },
  "payload": "SGVsbG8gV29ybGQ=",
  "signature": "3045022100...",
  "public_key": "04ab5c8f..."
}
```

### Hex Encoding

Binary fields (hashes, signatures, keys) are hex-encoded for readability:

```rust
#[serde(with = "hex")]
signature: [u8; 64],
```

## MessagePack Format

MessagePack provides efficient binary serialization while maintaining structure:

- **Smaller than JSON**: Typically 20-50% size reduction
- **Faster parsing**: No text parsing overhead
- **Schema evolution**: Better support for optional fields
- **Type preservation**: Maintains integer vs string distinction

```rust
// MessagePack is more compact than JSON
let json_size = json_format.encode(&block)?.len();
let msgpack_size = msgpack_format.encode(&block)?.len();
assert!(msgpack_size < json_size);
```

## Protobuf Format

Simplified protobuf-style encoding using length-delimited fields:

```
Field 1: Header
  tag: 1 (1 byte)
  length: header_len (4 bytes LE)
  data: header_bytes

Field 2: Payload
  tag: 2 (1 byte)
  length: payload_len (4 bytes LE)
  data: payload_bytes

Field 3: Signature
  tag: 3 (1 byte)
  length: 64 (4 bytes LE)
  data: signature_bytes

Field 4: Public Key
  tag: 4 (1 byte)  
  length: 32 (4 bytes LE)
  data: pubkey_bytes
```

## SSZ Format

SSZ (Simple Serialize) is compatible with Ethereum ecosystem:

- **Fixed-length encoding**: Predictable size calculations
- **Merkle tree friendly**: Easy to compute hash trees
- **Zero-copy deserialization**: Direct memory mapping possible
- **Canonical representation**: Same data always produces same bytes

The Olocus binary format is SSZ-compatible by design.

## Compression Methods

### Zstd Compression

- **Best overall compression**: Typically 60-80% size reduction
- **Good speed**: Faster than gzip, slower than LZ4
- **Tunable**: Compression levels 1-22
- **Optional dependency**: Falls back to LZ4 if unavailable

```rust
// Enable zstd feature in Cargo.toml
[features]
compression-zstd = ["zstd"]
```

### LZ4 Compression

- **Fastest compression**: Minimal CPU overhead
- **Good compression**: 40-60% size reduction
- **Always available**: No optional dependencies
- **Streaming friendly**: Low memory usage

### Gzip Compression

- **Widely supported**: Available everywhere
- **Moderate compression**: Similar to zstd level 3
- **Slower**: More CPU intensive than zstd/LZ4
- **HTTP compatible**: Standard Content-Encoding

### No Compression

- **Fastest processing**: Zero compression overhead
- **Largest size**: Full data transmission
- **Low latency**: No compression/decompression delay
- **Simple debugging**: Raw data inspection

## Performance Characteristics

Typical performance on modern hardware with 1KB payloads:

| Format + Compression | Encode (ops/sec) | Decode (ops/sec) | Size (bytes) |
|---------------------|------------------|------------------|--------------|
| Binary + None       | 50,000           | 60,000           | 1,200        |
| Binary + LZ4        | 45,000           | 55,000           | 800          |
| Binary + Zstd       | 35,000           | 40,000           | 600          |
| JSON + None         | 15,000           | 12,000           | 1,800        |
| JSON + Gzip         | 12,000           | 10,000           | 900          |
| MessagePack + LZ4   | 25,000           | 30,000           | 700          |

## Format Selection Guidelines

### When to Use Each Format

1. **Binary + None**: Default choice for minimal overhead
2. **Binary + LZ4**: High-throughput applications needing compression
3. **Binary + Zstd**: Storage optimization with acceptable CPU cost
4. **JSON + None**: Debugging, web APIs, human inspection
5. **JSON + Gzip**: Web applications needing compression
6. **MessagePack + LZ4**: Efficient structured data with compression
7. **Protobuf + None**: Cross-language compatibility
8. **SSZ + None**: Ethereum ecosystem integration

### Decision Matrix

| Priority | Recommended Format |
|----------|-------------------|
| Speed | Binary + None |
| Size | Binary + Zstd |
| Debug | JSON + None |
| Web | JSON + Gzip |
| Cross-platform | MessagePack + LZ4 |
| Ethereum | SSZ + None |

## Implementation Details

### Error Handling

Wire format operations can fail in several ways:

```rust
pub enum Error {
    MalformedBlock,      // Invalid structure
    SerializationError,  // Encoding failure
    // ... other errors
}
```

### Memory Management

- **Zero-copy where possible**: Binary format allows direct access
- **Streaming compression**: Large payloads don't require full buffering
- **Bounded allocations**: Maximum sizes prevent DoS attacks

### Thread Safety

All wire format operations are thread-safe:

- **Immutable data**: No shared mutable state
- **Pure functions**: Encoding/decoding has no side effects
- **Concurrent access**: Multiple threads can encode/decode simultaneously

## Version Compatibility

Wire formats maintain backward compatibility:

1. **Format versioning**: Each encoding method has version identifier
2. **Graceful degradation**: Newer features ignored by older parsers
3. **Migration support**: Tools to convert between formats
4. **Feature detection**: Clients can negotiate supported formats
