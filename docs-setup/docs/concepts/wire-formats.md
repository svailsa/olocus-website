---
id: wire-formats
title: Wire Formats
sidebar_position: 3
---

# Wire Formats

The Olocus Protocol wire format system provides flexible, efficient data encoding with multiple format options and compression methods. This enables applications to choose optimal representations for their specific requirements while maintaining interoperability.

## Overview

The wire format system supports **5 encoding formats** and **4 compression methods**, providing **20 possible combinations** for data serialization. This flexibility allows optimization for different scenarios: size, speed, debugging, or cross-platform compatibility.

### Design Goals

1. **Efficiency**: Minimal overhead for high-performance applications
2. **Flexibility**: Multiple encoding options for different use cases
3. **Interoperability**: Cross-platform deterministic serialization
4. **Extensibility**: Support for future encoding formats
5. **Debugging**: Human-readable formats for development

## Encoding Formats

### 1. Binary Format (Default)

The canonical binary format provides maximum efficiency and is the protocol's native representation:

#### Structure Layout

```
┌─────────────────┬─────────┬───────────┬─────────────┐
│ Header (86B)    │ Payload │ Signature │ Public Key  │
│                 │ (var)   │ (64B)     │ (32B)       │
└─────────────────┴─────────┴───────────┴─────────────┘
```

#### Header Layout (86 bytes)

```
Offset  Field          Size   Description
------  -----          ----   -----------
0-1     version        2B     Protocol version (little-endian)
2-9     index          8B     Block index (little-endian)
10-17   timestamp      8B     Unix timestamp (little-endian)
18-49   previous       32B    Previous block hash
50-81   payload_hash   32B    SHA-256 of payload
82-85   payload_type   4B     Payload type ID (little-endian)
```

#### Binary Encoding Implementation

```rust
impl WireFormat {
    pub fn encode_binary(&self, block: &Block<T>) -> Result<Vec<u8>> {
        let mut buffer = Vec::with_capacity(186 + block.payload.to_bytes().len());
        
        // Header (86 bytes)
        buffer.extend_from_slice(&block.header.version.to_le_bytes());
        buffer.extend_from_slice(&block.header.index.to_le_bytes());
        buffer.extend_from_slice(&block.header.timestamp.to_le_bytes());
        buffer.extend_from_slice(&block.header.previous);
        buffer.extend_from_slice(&block.header.payload_hash);
        buffer.extend_from_slice(&block.header.payload_type.to_le_bytes());
        
        // Payload
        let payload_bytes = block.payload.to_bytes();
        buffer.extend_from_slice(&payload_bytes);
        
        // Signature (64 bytes)
        buffer.extend_from_slice(&block.signature);
        
        // Public key (32 bytes)
        buffer.extend_from_slice(&block.public_key);
        
        Ok(buffer)
    }
}
```

### 2. JSON Format

JSON provides human-readable representation ideal for debugging, web APIs, and cross-language compatibility:

#### JSON Structure

```json
{
  "header": {
    "version": 1,
    "index": 42,
    "timestamp": 1640995200,
    "previous": "a1b2c3d4e5f6789a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4",
    "payload_hash": "e5f6789a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7",
    "payload_type": 1001
  },
  "payload": "SGVsbG8gV29ybGQ=",  // Base64-encoded payload
  "signature": "304502210098e67d...",  // Hex-encoded signature
  "public_key": "04ab5c8f9d2e..."      // Hex-encoded public key
}
```

#### JSON Encoding Features

- **Hex Encoding**: Binary fields (hashes, signatures, keys) as hexadecimal
- **Base64 Payload**: Arbitrary payload data as Base64
- **Schema Validation**: JSON Schema support for validation
- **Pretty Printing**: Optional formatting for readability

```rust
#[derive(Serialize, Deserialize)]
struct JsonBlock {
    header: JsonHeader,
    #[serde(with = "base64")]
    payload: Vec<u8>,
    #[serde(with = "hex")]
    signature: [u8; 64],
    #[serde(with = "hex")]
    public_key: [u8; 32],
}
```

### 3. MessagePack Format

MessagePack provides efficient binary serialization while maintaining structure:

#### Advantages

- **Compact**: 20-50% smaller than JSON
- **Fast**: No text parsing overhead
- **Type Preservation**: Maintains integer vs string distinction
- **Schema Evolution**: Better support for optional fields

#### Performance Comparison

```rust
// Typical size comparison for 1KB payloads
let json_size = 1800;      // JSON with hex encoding
let msgpack_size = 1200;   // MessagePack binary
let binary_size = 1000;    // Native binary format

assert!(msgpack_size < json_size);
assert!(binary_size < msgpack_size);
```

#### MessagePack Structure

MessagePack uses a compact binary format with type tags:

```
Header object: {
    "version": 1 (positive fixint),
    "index": 42 (positive fixint),
    "timestamp": 1640995200 (uint32),
    "previous": [32 bytes] (bin32),
    "payload_hash": [32 bytes] (bin32),
    "payload_type": 1001 (uint16)
}
```

### 4. Protobuf Format

Simplified protobuf-style encoding using length-delimited fields:

#### Protobuf Wire Format

```
Field 1: Header
  tag: 1 (varint)
  length: header_len (varint)  
  data: header_bytes

Field 2: Payload
  tag: 2 (varint)
  length: payload_len (varint)
  data: payload_bytes

Field 3: Signature  
  tag: 3 (varint)
  length: 64 (varint)
  data: signature_bytes

Field 4: Public Key
  tag: 4 (varint)
  length: 32 (varint)
  data: pubkey_bytes
```

#### Cross-Language Compatibility

```proto
// Protocol buffer definition
message OlocusBlock {
  BlockHeader header = 1;
  bytes payload = 2;
  bytes signature = 3;  // 64 bytes
  bytes public_key = 4; // 32 bytes
}

message BlockHeader {
  uint32 version = 1;
  uint64 index = 2;
  int64 timestamp = 3;
  bytes previous = 4;      // 32 bytes
  bytes payload_hash = 5;  // 32 bytes
  uint32 payload_type = 6;
}
```

### 5. SSZ Format (Simple Serialize)

SSZ provides Ethereum ecosystem compatibility with deterministic serialization:

#### SSZ Characteristics

- **Fixed-length encoding**: Predictable size calculations
- **Merkle tree friendly**: Easy hash tree computation
- **Zero-copy deserialization**: Direct memory mapping possible
- **Canonical representation**: Same data always produces same bytes

#### SSZ Compatibility

The Olocus binary format is SSZ-compatible by design, allowing seamless integration with Ethereum tooling:

```rust
// SSZ serialization matches binary format
let ssz_bytes = ssz::encode(&block);
let binary_bytes = WireFormat::binary().encode(&block)?;
assert_eq!(ssz_bytes, binary_bytes);
```

## Compression Methods

### 1. No Compression (Default)

- **Use case**: Low latency applications, small payloads
- **Overhead**: Zero compression/decompression time
- **Size**: Full data transmission
- **CPU**: Minimal processing required

### 2. Zstd Compression

Facebook's Zstandard provides excellent compression ratios with good performance:

#### Zstd Characteristics

- **Compression**: 60-80% size reduction typically
- **Speed**: Faster than gzip, slower than LZ4
- **Levels**: Configurable compression levels 1-22
- **Memory**: Efficient memory usage
- **Streaming**: Supports streaming compression

```rust
// Zstd compression configuration
pub struct ZstdConfig {
    /// Compression level (1-22, default: 3)
    pub level: i32,
    
    /// Enable long-range matching
    pub long_range_matching: bool,
    
    /// Dictionary for repeated data patterns
    pub dictionary: Option<Vec<u8>>,
}

// Optional dependency handling
#[cfg(feature = "compression-zstd")]
fn compress_zstd(data: &[u8], level: i32) -> Result<Vec<u8>> {
    zstd::bulk::compress(data, level)
        .map_err(|e| Error::CompressionError(e.to_string()))
}

#[cfg(not(feature = "compression-zstd"))]
fn compress_zstd(_data: &[u8], _level: i32) -> Result<Vec<u8>> {
    Err(Error::UnsupportedCompression("zstd".to_string()))
}
```

### 3. LZ4 Compression

LZ4 prioritizes speed over compression ratio:

#### LZ4 Characteristics

- **Speed**: Fastest compression option
- **Compression**: 40-60% size reduction
- **Latency**: Minimal compression delay
- **Memory**: Low memory requirements
- **Always Available**: No optional dependencies

```rust
fn compress_lz4(data: &[u8]) -> Result<Vec<u8>> {
    lz4_flex::compress_prepend_size(data)
        .map_err(|e| Error::CompressionError(e.to_string()))
}

fn decompress_lz4(compressed: &[u8]) -> Result<Vec<u8>> {
    lz4_flex::decompress_size_prepended(compressed)
        .map_err(|e| Error::DecompressionError(e.to_string()))
}
```

### 4. Gzip Compression

Standard gzip compression provides wide compatibility:

#### Gzip Characteristics

- **Compatibility**: Universally supported
- **Compression**: Similar to zstd level 3
- **HTTP Compatible**: Standard Content-Encoding
- **Performance**: More CPU intensive than LZ4/zstd

```rust
use flate2::{write::GzEncoder, read::GzDecoder, Compression};

fn compress_gzip(data: &[u8], level: u32) -> Result<Vec<u8>> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::new(level));
    encoder.write_all(data)?;
    encoder.finish().map_err(|e| Error::CompressionError(e.to_string()))
}
```

## WireFormat API

### Core Structure

```rust
#[derive(Debug, Clone, PartialEq)]
pub struct WireFormat {
    pub encoding: EncodingFormat,
    pub compression: CompressionMethod,
}

#[derive(Debug, Clone, PartialEq)]
pub enum EncodingFormat {
    Binary,
    Json,
    MessagePack,
    Protobuf,
    SSZ,
}

#[derive(Debug, Clone, PartialEq)]  
pub enum CompressionMethod {
    None,
    Zstd { level: i32 },
    LZ4,
    Gzip { level: u32 },
}
```

### Common Presets

```rust
impl WireFormat {
    /// Binary format with no compression (default)
    pub fn binary() -> Self {
        Self::new(EncodingFormat::Binary, CompressionMethod::None)
    }
    
    /// JSON format for debugging
    pub fn json() -> Self {
        Self::new(EncodingFormat::Json, CompressionMethod::None)
    }
    
    /// MessagePack for efficient structured data
    pub fn msgpack() -> Self {
        Self::new(EncodingFormat::MessagePack, CompressionMethod::None)
    }
    
    /// Compressed binary for storage optimization
    pub fn compressed_binary() -> Self {
        Self::new(EncodingFormat::Binary, CompressionMethod::Zstd { level: 3 })
    }
    
    /// Compressed JSON for web APIs
    pub fn compressed_json() -> Self {
        Self::new(EncodingFormat::Json, CompressionMethod::Gzip { level: 6 })
    }
}
```

### Encoding/Decoding Operations

```rust
impl WireFormat {
    /// Encode a block using this wire format
    pub fn encode<T: BlockPayload>(&self, block: &Block<T>) -> Result<Vec<u8>> {
        // 1. Serialize using encoding format
        let serialized = match self.encoding {
            EncodingFormat::Binary => self.encode_binary(block)?,
            EncodingFormat::Json => self.encode_json(block)?,
            EncodingFormat::MessagePack => self.encode_msgpack(block)?,
            EncodingFormat::Protobuf => self.encode_protobuf(block)?,
            EncodingFormat::SSZ => self.encode_ssz(block)?,
        };
        
        // 2. Apply compression
        let compressed = match self.compression {
            CompressionMethod::None => serialized,
            CompressionMethod::Zstd { level } => compress_zstd(&serialized, level)?,
            CompressionMethod::LZ4 => compress_lz4(&serialized)?,
            CompressionMethod::Gzip { level } => compress_gzip(&serialized, level)?,
        };
        
        Ok(compressed)
    }
    
    /// Decode a block from wire format
    pub fn decode<T: BlockPayload>(&self, data: &[u8]) -> Result<Block<T>> {
        // 1. Decompress if needed
        let decompressed = match self.compression {
            CompressionMethod::None => data.to_vec(),
            CompressionMethod::Zstd { .. } => decompress_zstd(data)?,
            CompressionMethod::LZ4 => decompress_lz4(data)?,
            CompressionMethod::Gzip { .. } => decompress_gzip(data)?,
        };
        
        // 2. Deserialize using encoding format
        match self.encoding {
            EncodingFormat::Binary => self.decode_binary(&decompressed),
            EncodingFormat::Json => self.decode_json(&decompressed),
            EncodingFormat::MessagePack => self.decode_msgpack(&decompressed),
            EncodingFormat::Protobuf => self.decode_protobuf(&decompressed),
            EncodingFormat::SSZ => self.decode_ssz(&decompressed),
        }
    }
}
```

## Content Type Negotiation

### Content-Type Headers

Each wire format has an associated MIME type for HTTP-style negotiation:

| Format | Base Content Type |
|--------|------------------|
| Binary | `application/x-olocus-block` |
| JSON | `application/json` |
| MessagePack | `application/x-msgpack` |
| Protobuf | `application/x-protobuf` |
| SSZ | `application/x-ssz` |

### Compression Suffixes

Compression is indicated by appending a suffix:

- **Zstd**: `+zstd` (e.g., `application/x-olocus-block+zstd`)
- **LZ4**: `+lz4` (e.g., `application/json+lz4`)
- **Gzip**: `+gzip` (e.g., `application/x-msgpack+gzip`)

### Content-Type Parsing

```rust
impl WireFormat {
    /// Parse content type string to wire format
    pub fn from_content_type(content_type: &str) -> Result<Self> {
        let (mime_type, compression) = if let Some(pos) = content_type.find('+') {
            let (mime, comp) = content_type.split_at(pos);
            (mime, &comp[1..]) // Skip the '+'
        } else {
            (content_type, "")
        };
        
        let encoding = match mime_type {
            "application/x-olocus-block" => EncodingFormat::Binary,
            "application/json" => EncodingFormat::Json,
            "application/x-msgpack" => EncodingFormat::MessagePack,
            "application/x-protobuf" => EncodingFormat::Protobuf,
            "application/x-ssz" => EncodingFormat::SSZ,
            _ => return Err(Error::UnsupportedContentType(mime_type.to_string())),
        };
        
        let compression_method = match compression {
            "" => CompressionMethod::None,
            "zstd" => CompressionMethod::Zstd { level: 3 },
            "lz4" => CompressionMethod::LZ4,
            "gzip" => CompressionMethod::Gzip { level: 6 },
            _ => return Err(Error::UnsupportedCompression(compression.to_string())),
        };
        
        Ok(WireFormat::new(encoding, compression_method))
    }
    
    /// Generate content type string
    pub fn content_type(&self) -> String {
        let mime_type = match self.encoding {
            EncodingFormat::Binary => "application/x-olocus-block",
            EncodingFormat::Json => "application/json",
            EncodingFormat::MessagePack => "application/x-msgpack",
            EncodingFormat::Protobuf => "application/x-protobuf",
            EncodingFormat::SSZ => "application/x-ssz",
        };
        
        match self.compression {
            CompressionMethod::None => mime_type.to_string(),
            CompressionMethod::Zstd { .. } => format!("{}+zstd", mime_type),
            CompressionMethod::LZ4 => format!("{}+lz4", mime_type),
            CompressionMethod::Gzip { .. } => format!("{}+gzip", mime_type),
        }
    }
}
```

### HTTP Integration Example

```rust
// HTTP client usage
let format = WireFormat::from_content_type("application/json+gzip")?;
let encoded_block = format.encode(&block)?;

let response = client
    .post("/api/blocks")
    .header("Content-Type", format.content_type())
    .body(encoded_block)
    .send()?;

// HTTP server usage  
let content_type = request.headers()
    .get("content-type")
    .and_then(|h| h.to_str().ok())
    .unwrap_or("application/x-olocus-block");
    
let format = WireFormat::from_content_type(content_type)?;
let block: Block<MyPayload> = format.decode(request.body())?;
```

## Performance Characteristics

### Benchmark Results

Typical performance on modern hardware with 1KB payloads:

| Format + Compression | Encode (ops/sec) | Decode (ops/sec) | Size (bytes) | Use Case |
|---------------------|------------------|------------------|--------------|----------|
| Binary + None       | 50,000           | 60,000           | 1,200        | High-performance |
| Binary + LZ4        | 45,000           | 55,000           | 800          | Balanced |
| Binary + Zstd       | 35,000           | 40,000           | 600          | Storage |
| JSON + None         | 15,000           | 12,000           | 1,800        | Debugging |
| JSON + Gzip         | 12,000           | 10,000           | 900          | Web APIs |
| MessagePack + LZ4   | 25,000           | 30,000           | 700          | Structured data |
| Protobuf + None     | 20,000           | 25,000           | 1,100        | Cross-platform |
| SSZ + None          | 48,000           | 58,000           | 1,200        | Ethereum ecosystem |

### Performance Factors

#### Encoding Performance

- **Binary/SSZ**: Direct memory serialization (fastest)
- **MessagePack**: Efficient binary format
- **Protobuf**: Length-delimited with varint overhead
- **JSON**: Text parsing overhead (slowest)

#### Compression Performance

- **LZ4**: Fastest compression/decompression
- **Zstd**: Best compression ratio with good speed
- **Gzip**: Balanced but CPU-intensive
- **None**: Zero overhead

#### Memory Usage

```rust
// Memory-efficient streaming for large payloads
pub struct StreamingEncoder {
    format: WireFormat,
    buffer_size: usize,
}

impl StreamingEncoder {
    pub fn encode_stream<T: BlockPayload>(
        &self, 
        block: &Block<T>, 
        writer: impl Write
    ) -> Result<()> {
        // Stream encoding to avoid loading entire payload in memory
        match self.format.compression {
            CompressionMethod::None => self.encode_direct(block, writer),
            CompressionMethod::LZ4 => self.encode_lz4_stream(block, writer),
            CompressionMethod::Zstd { level } => self.encode_zstd_stream(block, writer, level),
            CompressionMethod::Gzip { level } => self.encode_gzip_stream(block, writer, level),
        }
    }
}
```

## Format Selection Guidelines

### Decision Matrix

Choose the optimal format based on your requirements:

| Priority | Recommended Format | Rationale |
|----------|-------------------|-----------|
| **Speed** | Binary + None | Zero serialization overhead |
| **Size** | Binary + Zstd | Maximum compression efficiency |
| **Debug** | JSON + None | Human-readable format |
| **Web** | JSON + Gzip | HTTP-compatible compression |
| **Cross-platform** | MessagePack + LZ4 | Efficient structured data |
| **Ethereum** | SSZ + None | Ecosystem compatibility |
| **Mobile** | Binary + LZ4 | Fast with reasonable compression |
| **IoT** | Binary + None | Minimal processing overhead |

### Use Case Examples

#### High-Frequency Trading

```rust
// Prioritize speed over size
let format = WireFormat::binary(); // No compression overhead
let encoded = format.encode(&trade_block)?;
```

#### Archival Storage

```rust
// Prioritize size over speed
let format = WireFormat::new(
    EncodingFormat::Binary, 
    CompressionMethod::Zstd { level: 19 }
);
let compressed = format.encode(&historical_block)?;
```

#### Web API

```rust
// Balance readability and efficiency
let format = WireFormat::new(
    EncodingFormat::Json,
    CompressionMethod::Gzip { level: 6 }
);
let response_body = format.encode(&block)?;
```

#### IoT Sensor Network

```rust
// Minimize CPU and battery usage
let format = WireFormat::binary(); // No compression processing
let sensor_data = format.encode(&sensor_block)?;
```

## Version Compatibility

### Format Evolution

Wire formats maintain backward compatibility through versioning:

```rust
pub struct FormatVersion {
    /// Format version identifier
    pub version: u16,
    
    /// Supported encoding formats
    pub encodings: Vec<EncodingFormat>,
    
    /// Supported compression methods  
    pub compressions: Vec<CompressionMethod>,
    
    /// Compatibility rules
    pub compatibility: CompatibilityRules,
}

/// Version 1.0 format support
pub const FORMAT_V1: FormatVersion = FormatVersion {
    version: 1,
    encodings: vec![
        EncodingFormat::Binary,
        EncodingFormat::Json,
        EncodingFormat::MessagePack,
    ],
    compressions: vec![
        CompressionMethod::None,
        CompressionMethod::LZ4,
        CompressionMethod::Gzip { level: 6 },
    ],
    compatibility: CompatibilityRules::default(),
};
```

### Migration Support

```rust
pub struct FormatMigration {
    /// Convert from old format to new format
    pub fn migrate(
        &self,
        data: &[u8],
        from_format: WireFormat,
        to_format: WireFormat,
    ) -> Result<Vec<u8>> {
        // 1. Decode using old format
        let block: Block<GenericPayload> = from_format.decode(data)?;
        
        // 2. Apply any necessary transformations
        let migrated_block = self.transform_block(block)?;
        
        // 3. Encode using new format
        to_format.encode(&migrated_block)
    }
}
```

### Feature Detection

```rust
/// Detect supported formats from peer
pub fn negotiate_format(
    our_formats: &[WireFormat],
    peer_formats: &[WireFormat],
) -> Option<WireFormat> {
    // Find common formats, prioritize by efficiency
    for our_format in our_formats {
        if peer_formats.contains(our_format) {
            return Some(our_format.clone());
        }
    }
    None
}
```

## Error Handling

### Wire Format Errors

```rust
#[derive(Debug, thiserror::Error)]
pub enum WireFormatError {
    #[error("Unsupported encoding format: {0}")]
    UnsupportedEncoding(String),
    
    #[error("Unsupported compression method: {0}")]
    UnsupportedCompression(String),
    
    #[error("Invalid content type: {0}")]
    InvalidContentType(String),
    
    #[error("Serialization error: {0}")]
    SerializationError(String),
    
    #[error("Compression error: {0}")]
    CompressionError(String),
    
    #[error("Malformed data: {0}")]
    MalformedData(String),
    
    #[error("Version incompatibility: expected {expected}, got {actual}")]
    VersionMismatch { expected: u16, actual: u16 },
}
```

### Graceful Degradation

```rust
pub struct FormatFallback {
    /// Preferred formats in order of preference
    pub preferences: Vec<WireFormat>,
    
    /// Minimum acceptable format
    pub minimum: WireFormat,
}

impl FormatFallback {
    pub fn try_encode<T: BlockPayload>(&self, block: &Block<T>) -> Result<Vec<u8>> {
        for format in &self.preferences {
            match format.encode(block) {
                Ok(encoded) => return Ok(encoded),
                Err(e) => {
                    log::warn!("Format {:?} failed: {}", format, e);
                    continue;
                }
            }
        }
        
        // Fall back to minimum format
        self.minimum.encode(block)
    }
}
```

The wire format system provides a robust foundation for data serialization in the Olocus Protocol, balancing efficiency, flexibility, and compatibility across diverse application requirements.