---
id: protocol-specification
title: Protocol Specification
sidebar_position: 1
---

# Olocus Protocol Specification

The Olocus Protocol provides a minimal, extensible foundation for cryptographically-secured, timestamped data chains with universal measurement support. This specification defines the core wire format, cryptographic requirements, and chain rules that all implementations must follow.

## Core Data Structures

### Block Structure

Every block consists of four components:

```
Block := {
    header:     BlockHeader
    payload:    PayloadBytes
    signature:  bytes[64]       // Ed25519 signature
    public_key: bytes[32]       // Ed25519 verifying key
}
```

### Block Header

The header contains fixed metadata for every block:

```
BlockHeader := {
    version:      uint16        // Protocol version (major.minor encoded)
    index:        uint64        // Block sequence number (0 for genesis)
    timestamp:    int64         // Unix timestamp in seconds
    previous:     bytes[32]     // SHA-256 hash of previous block
    payload_hash: bytes[32]     // SHA-256 hash of payload bytes
    payload_type: uint32        // Payload type identifier
}
```

**Field Requirements:**
- `version`: Must be >= 0x0105 (v1.5)
- `index`: Must be 0 for genesis block, sequential thereafter
- `timestamp`: Must be monotonically increasing
- `previous`: Must be all zeros for genesis block
- `payload_hash`: Must equal SHA-256(payload_bytes)

## Wire Format

### Binary Envelope

The canonical wire format uses a fixed-size envelope (186 bytes):

| Offset | Size | Field |
|--------|------|-------|
| 0 | 2 | version (big-endian) |
| 2 | 8 | index (big-endian) |
| 10 | 8 | timestamp (big-endian) |
| 18 | 32 | previous hash |
| 50 | 32 | payload_hash |
| 82 | 4 | payload_type (big-endian) |
| 86 | 4 | payload_size (big-endian) |
| 90 | 32 | public_key |
| 122 | 64 | signature |
| 186 | var | payload |

### Encoding Formats

| Format | Content-Type | Description |
|--------|--------------|-------------|
| Binary | `application/x-olocus-block` | Default, SSZ-compatible |
| JSON | `application/json` | Human-readable |
| MessagePack | `application/x-msgpack` | Compact binary |
| Protobuf | `application/x-protobuf` | Schema-based |

### Compression

Optional compression can be specified by appending to content-type:
- `+zstd` - Best compression ratio
- `+lz4` - Fastest compression  
- `+gzip` - Most compatible

Example: `application/x-msgpack+zstd`

## Cryptographic Operations

### Signature Algorithm

**Default**: Ed25519 as specified in RFC 8032

- Private key: 32 bytes
- Public key: 32 bytes  
- Signature: 64 bytes

### Hash Function

**Default**: SHA-256 as specified in FIPS 180-4

Output: 32 bytes (256 bits)

### Signature Computation

The signature covers the concatenation of:
1. Header bytes (86 bytes, wire format)
2. Payload size (4 bytes, big-endian) 
3. Payload bytes (variable)

```
message := header_bytes || payload_size_bytes || payload_bytes
signature := Ed25519_Sign(private_key, message)
```

### Block Hash

The block hash identifies blocks and links chains:

```
block_hash := SHA-256(wire_encoded_block)
```

## Chain Rules

### Genesis Block Requirements

A genesis block must satisfy:
1. `index = 0`
2. `previous = [0x00; 32]` (32 zero bytes)
3. Valid signature over header and payload
4. Valid payload hash

### Sequential Block Requirements

For block N (where N > 0):

1. `index = previous_block.index + 1`
2. `previous = Hash(previous_block)`  
3. `timestamp > previous_block.timestamp`
4. `timestamp <= current_time + MAX_FUTURE_DRIFT`
5. `timestamp >= current_time - MAX_BLOCK_AGE`
6. Valid signature
7. Valid payload hash
8. `payload_size <= MAX_PAYLOAD_SIZE`

### Validation Constants

| Constant | Value | Description |
|----------|-------|-------------|
| MAX_FUTURE_DRIFT | 300 seconds | Maximum timestamp ahead of current time |
| MAX_BLOCK_AGE | 86400 seconds | Maximum timestamp behind current time |
| MAX_PAYLOAD_SIZE | 16,777,216 bytes | Maximum payload size (16 MiB) |
| MAX_REORG_DEPTH | 100 blocks | Maximum fork reorganization depth |

## Universal Measurement Foundation

### Measurement Structure

The universal measurement structure provides consistent uncertainty and provenance tracking:

```
Measurement := {
    value:       Value           // The measured value
    uncertainty: Uncertainty     // Quantified uncertainty
    provenance:  Provenance      // Origin and transformation chain
    validity:    ValidityWindow  // Temporal validity
}
```

### Core Value Types

The `Value` enum provides structural types:

**Primitives**: None, Bool, Int, UInt, Float, Decimal, String, Bytes

**Temporal**: Timestamp, Duration, Date, Time, DateTime

**Spatial**: Point2D, Point3D, BoundingBox, LineString, Polygon

**Collections**: Array, Object, Set

**Advanced**: UUID, Range, Regex, Json

### Fixed-Point Coordinates

Spatial values use fixed-point representation for determinism:
- Latitude/Longitude: `int64` (degrees × 10^7, ~1cm precision)
- Altitude: `int32` (millimeters)
- Distance: Haversine formula for geographic calculations

### Uncertainty Types

- **Gaussian**: Normal distribution (mean, std_dev)
- **Interval**: Range of possible values
- **Circular**: Angular uncertainty
- **Categorical**: Discrete possibilities with probabilities
- **Confidence**: Simple confidence level (0.0 to 1.0)
- **Exact**: No uncertainty
- **Unknown**: Uncertainty not quantified

## Error Codes

### Core Error Codes (0-63)

| Code | Name | Description |
|------|------|-------------|
| 0 | Ok | Success |
| 1 | VersionMismatch | Incompatible protocol version |
| 2 | BrokenChain | Previous hash mismatch |
| 3 | InvalidIndex | Non-sequential block index |
| 4 | TimestampRegression | Timestamp before previous block |
| 5 | PayloadMismatch | Payload hash incorrect |
| 6 | InvalidSignature | Signature verification failed |
| 7 | MalformedBlock | Cannot parse block |

### Error Code Allocation

| Range | Purpose |
|-------|---------|
| 0-63 | Core protocol errors |
| 64-127 | Reserved for future core |
| 128-255 | Standard extension errors |
| 256+ | Extension-specific errors |

## Version Negotiation

### Version Format

Protocol version encoded as 16-bit integer:
- High byte: Major version
- Low byte: Minor version

Example: `0x0107` = version 1.7

### Negotiation Rules

1. Peers must offer their highest supported version
2. Connection uses highest mutually supported version
3. If no common version exists, connection fails
4. Implementations must not accept versions below minimum
5. Version offers must be cryptographically signed

## Extension Framework

### Payload Type Allocation

| Range | Purpose | Registration |
|-------|---------|--------------|
| 0x0000-0x00FF | Core protocol | Reserved |
| 0x0100-0x7FFF | Standard extensions | Maintainer-allocated |
| 0x8000-0xFFFF | User-defined | No registration required |

### Standard Extension Allocations

- **0x0100**: olocus-location (GPS tracking, visit detection)
- **0x0200-0x02FF**: olocus-trust (Trust, peer connections, reputation)
- **0x0300-0x03FF**: olocus-tsa (RFC 3161 timestamps, anchoring)
- **0x0400-0x04FF**: olocus-http (HTTP/REST transport)

## Algorithm Negotiation

### Crypto Suite Support

| Suite ID | Signature | Hash | Status |
|----------|-----------|------|--------|
| 0x00 | Ed25519 | SHA-256 | Required |
| 0x01 | Dilithium3 | SHA3-256 | Optional (Post-quantum) |
| 0x02 | Hybrid | SHA-256 | Optional (Migration) |

### Signed Preferences

All algorithm preferences must be cryptographically signed:

```
SignedAlgorithmPreferences := {
    preferences:  AlgorithmPreferences
    signature:    bytes[64]       // Ed25519 signature
    signer_key:   bytes[32]       // Public key
    timestamp:    int64           // Freshness check
    nonce:        bytes[32]       // Replay prevention
}
```

This ensures:
- **Authentication**: Preferences signed by peer's key
- **Integrity**: Modification invalidates signature
- **Freshness**: Timestamp prevents old preferences
- **Non-replay**: Nonce prevents replay attacks

## Security Model

### Threat Model Assumptions

- Adversary controls network communication
- Adversary may participate in protocol
- Private keys remain secure (HSM recommended)
- Approximate time synchronization (±5 minutes)

### Protected Against

| Threat | Protection |
|--------|-----------|
| Block forgery | Ed25519 signatures |
| Chain tampering | Hash linking |
| Replay attacks | Index + timestamp + nonce |
| Algorithm downgrade | Multi-layer protection |
| Man-in-the-middle | Signed preferences |

### Security Properties

The protocol guarantees:
1. **Chain Integrity**: Hash continuity prevents tampering
2. **Signature Validity**: All blocks cryptographically verified
3. **Temporal Ordering**: Monotonic timestamps
4. **Payload Integrity**: Hash verification
5. **Non-repudiation**: Signature binding to public key

## Implementation Requirements

### Mandatory Features

All conforming implementations must support:
- Ed25519 signatures
- SHA-256 hashing
- Binary wire format
- Genesis block creation
- Sequential block validation
- Basic error handling

### Optional Features

Implementations may optionally support:
- Alternative encoding formats
- Compression methods
- Post-quantum cryptography
- Extension-specific payloads
- Network protocols

### Test Vectors

Implementations should validate against provided test vectors to ensure compatibility and correctness. See the reference implementation for canonical test cases.

## Formal Verification

### Verification Levels

| Level | Scope | Method |
|-------|-------|--------|
| FV-L1 | Protocol Logic | Symbolic Model (Tamarin) |
| FV-L2 | Core Implementation | Type Verification (F*/hax) |
| FV-L3 | Full Implementation | Computational Model |

### Verified Properties

- Chain integrity and hash continuity
- Signature validity and binding
- Index monotonicity
- Timestamp ordering
- Downgrade resistance
- Preference authenticity

High-security deployments should achieve FV-L2 verification for mission-critical applications.