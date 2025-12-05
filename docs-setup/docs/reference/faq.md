---
id: faq
title: FAQ
sidebar_position: 1
---

# Frequently Asked Questions

## General Questions

### What is Olocus Protocol?

Olocus Protocol is a minimal, extensible cryptographic protocol for timestamped data chains. It provides a foundation for building secure, verifiable data systems with a focus on extensibility and future-proofing.

**Key Features:**
- Minimal core (~500 lines of code)
- Extensible architecture with 22 optional extensions  
- Type-agnostic payload system
- Strong cryptographic foundations (Ed25519 + SHA-256)
- Universal measurement foundation for any data type

### How does Olocus differ from blockchain?

While both create chains of cryptographically linked blocks, Olocus Protocol is designed for different use cases:

**Olocus Protocol:**
- Individual data chains (not distributed consensus)
- Minimal core with extensions
- Application-agnostic measurement foundation
- Focus on provenance and integrity
- Suitable for IoT, personal data, enterprise audit logs

**Traditional Blockchain:**
- Distributed consensus across multiple parties
- Heavyweight virtual machine execution
- Cryptocurrency-focused
- High energy consumption
- Designed for decentralized finance and smart contracts

### Is Olocus Protocol quantum-resistant?

The current cryptographic suite (Ed25519 + SHA-256) is not quantum-resistant, but the protocol is designed for quantum readiness:

- **Algorithm negotiation** supports post-quantum algorithms
- **Dilithium and ML-KEM** are ready for integration
- **Hybrid mode** combines classical and post-quantum crypto
- **Graceful migration path** to quantum-safe algorithms

## Technical Questions

### How do I choose the right wire format?

The wire format depends on your use case:

| Use Case | Recommended Format | Reason |
|----------|-------------------|---------|
| High performance | Binary + LZ4 | Fastest encode/decode |
| Storage optimization | Binary + Zstd | Best compression ratio |
| Web APIs | JSON + Gzip | HTTP compatibility |
| Cross-language | MessagePack + LZ4 | Efficient structured data |
| Debugging | JSON + None | Human readable |
| Ethereum integration | SSZ + None | Ecosystem compatibility |

### What's the maximum payload size?

There's no hard limit in the core protocol, but practical considerations apply:

- **Default recommendation**: &lt;1MB per block
- **Network constraints**: Large payloads may timeout
- **Memory usage**: Large blocks increase RAM requirements
- **Extension limits**: Some extensions may impose specific limits

Use compression for large payloads, or consider storing large data externally with hash references.

### How do I implement custom payload types?

Implement the `BlockPayload` trait for your data type:

```rust
use olocus_core::BlockPayload;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct MyPayload {
    pub data: String,
    pub metadata: Vec<u8>,
}

impl BlockPayload for MyPayload {
    fn payload_type() -> u32 {
        0x8001  // Custom type ID (0x8000+ range)
    }
    
    fn to_bytes(&self) -> Vec<u8> {
        bincode::serialize(self).unwrap()
    }
}

impl From<Vec<u8>> for MyPayload {
    fn from(bytes: Vec<u8>) -> Self {
        bincode::deserialize(&bytes).unwrap()
    }
}
```

### How do extensions work?

Extensions are optional modules that add functionality to the core protocol:

1. **Modular design**: Each extension is independent
2. **Runtime registration**: Extensions register with the plugin system
3. **Capability negotiation**: Peers negotiate which extensions to use
4. **Enum/trait pattern**: Built-in implementations + custom trait support

```rust
// Register extension
let mut registry = ExtensionRegistry::new();
registry.register("location", LocationExtension::new())?;

// Use extension
let location_data = LocationPayload::new(lat, lon);
let block = Block::new(location_data, &key, &previous_block, timestamp);
```

### What's the Universal Measurement Foundation?

The Universal Measurement Foundation provides a unified way to represent any measured data:

**Core Components:**
- **Value**: Structural types (Int, Float, Point2D, Timestamp, etc.)
- **Uncertainty**: Gaussian, Interval, Circular, Confidence, etc.
- **Provenance**: Source tracking and transformation history
- **Validity**: Temporal validity windows

**Example:**
```rust
let heart_rate = Measurement {
    value: Value::Int(72),
    uncertainty: Uncertainty::Gaussian { std_dev: 2.0 },
    provenance: Provenance {
        source: Source::Sensor { device_id: [0u8; 32], sensor_type: 0x0001, calibration_id: None },
        transformations: vec![],
        attestations: vec![],
    },
    validity: ValidityWindow::new(0, Some(60)),
};
```

## Security Questions

### How secure is the default cryptographic suite?

The default "Suite-2024-01" uses well-established algorithms:

- **Ed25519**: 128-bit security level, resistant to side-channel attacks
- **SHA-256**: No known practical attacks, 256-bit output
- **Deterministic signatures**: Prevents certain classes of attacks
- **No malleability**: Signatures cannot be modified

These provide strong security for current threats but are not quantum-resistant.

### What happens if a vulnerability is found in an algorithm?

The protocol includes several mechanisms for handling vulnerabilities:

1. **Algorithm deprecation**: Mark algorithms as deprecated with sunset dates
2. **Forbidden lists**: Block use of broken algorithms
3. **Emergency updates**: Push critical security updates
4. **Downgrade protection**: Prevent attacks that force weak algorithms
5. **Migration tools**: Help transition to new algorithms

### How does downgrade protection work?

Olocus Protocol implements seven layers of downgrade protection:

1. **Protocol version checking**: Enforce minimum versions
2. **Signed preferences**: Prevent tampering with algorithm lists  
3. **Strict ordering**: Initiator's preference order is authoritative
4. **Negotiation commitment**: Cryptographically commit to all offered algorithms
5. **Minimum requirements**: Enforce baseline security levels
6. **Forbidden lists**: Block known-weak algorithms
7. **Handshake binding**: Include negotiation transcript in handshake

### Are there audit logs for security events?

Yes, if you use the audit extension (`olocus-audit`):

- **Immutable logging**: All security events are recorded
- **Compliance frameworks**: GDPR, HIPAA, SOC2, PCI-DSS support
- **Privacy controls**: Configurable field masking and redaction
- **Export formats**: CSV, JSON, Parquet, Syslog
- **Tamper detection**: Cryptographic integrity protection

## Performance Questions

### What's the expected performance?

Typical performance on modern hardware:

| Operation | Speed | Notes |
|-----------|-------|-------|
| Block creation | &lt;1ms | Including signing |
| Block verification | &lt;1ms | Including signature check |
| SHA-256 hashing | 100 MB/sec | Hardware optimized |
| Ed25519 signing | 15,000/sec | Deterministic |
| Ed25519 verification | 5,000/sec | Constant time |
| Wire format encoding | 50,000 blocks/sec | Binary format |

Performance varies with payload size and selected algorithms.

### How can I optimize performance?

Several optimization strategies are available:

1. **Wire format selection**:
   - Use Binary format for speed
   - Use compression for large payloads
   - Avoid JSON in production

2. **Batch operations**:
   - Verify multiple signatures together
   - Compress multiple blocks
   - Use connection pooling

3. **Caching**:
   - Cache negotiation results
   - Pre-compute hash trees
   - Pool cryptographic contexts

4. **Hardware acceleration**:
   - Use AES-NI for encryption
   - Leverage crypto coprocessors
   - Consider HSM for high-volume signing

### Does the protocol support streaming?

Yes, several extensions support streaming:

- **Wire format**: Streaming compression (LZ4, Zstd)
- **Network extension**: Streaming transport protocols
- **Storage extension**: Write-ahead logging (WAL)
- **Query extension**: Streaming query results

## Integration Questions

### How do I integrate with existing systems?

Olocus Protocol provides several integration paths:

1. **HTTP API**: RESTful interface via `olocus-http`
2. **Language SDKs**: Python, Go, TypeScript bindings
3. **FFI interface**: C-compatible API for any language
4. **WebAssembly**: Browser and edge deployment
5. **Platform-specific**: iOS and Android native libraries

### Can I use Olocus with my existing database?

Yes, through the storage extension:

- **SQLite**: Embedded database support
- **RocksDB**: High-performance key-value store
- **Custom backends**: Implement `StorageBackend` trait
- **Hybrid approach**: Store blocks in database, large payloads externally

### How do I deploy to production?

Production deployment considerations:

1. **Configuration**:
   - Set appropriate security policies
   - Configure algorithm preferences
   - Enable relevant extensions

2. **Monitoring**:
   - Use metrics extension for observability
   - Set up health checks
   - Monitor negotiation patterns

3. **Security**:
   - Regular algorithm updates
   - Audit logging enabled
   - Key rotation policies

4. **Performance**:
   - Optimize wire formats
   - Configure compression
   - Use appropriate storage backend

### Is there enterprise support?

Enterprise features are available through several extensions:

- **Policy enforcement**: Organizational security policies
- **Audit logging**: Compliance and regulatory requirements
- **HSM integration**: Hardware security modules
- **Schema registry**: Centralized schema management
- **Orchestration**: Multi-extension coordination
- **Formal verification**: Mathematical security proofs

## Troubleshooting

### Common error messages and solutions

**"Invalid signature"**
- Check that signing and verification keys match
- Verify message data hasn't been modified
- Ensure clock synchronization between systems

**"No common algorithm"**  
- Update algorithm preferences on both sides
- Check for deprecated algorithms
- Verify extension compatibility

**"Protocol version too old"**
- Upgrade client or server to supported version
- Check minimum version requirements
- Consider compatibility mode

**"Plugin not found"**
- Install required extensions
- Check plugin registration
- Verify dependencies

### How do I debug wire format issues?

1. **Use JSON format** for human-readable debugging
2. **Enable detailed logging** for encoding/decoding steps  
3. **Check content types** in HTTP headers
4. **Validate compression** settings match on both sides
5. **Test with minimal payloads** first

### Performance troubleshooting

**Slow block creation:**
- Profile cryptographic operations
- Check payload serialization performance
- Consider hardware acceleration
- Monitor memory allocation patterns

**High memory usage:**
- Reduce payload sizes
- Enable compression
- Check for memory leaks in custom payloads
- Use streaming where possible

**Network timeouts:**
- Reduce payload sizes
- Enable compression
- Check network connectivity
- Configure appropriate timeouts

## Development Questions

### How do I contribute to Olocus Protocol?

Contributions are welcome:

1. **Core protocol**: Minimal changes only, focus on bug fixes
2. **Extensions**: New extensions are encouraged
3. **Documentation**: Always needed and appreciated
4. **Testing**: Help with test coverage and edge cases
5. **Security**: Report vulnerabilities responsibly

### What's the release process?

Olocus Protocol follows semantic versioning:

- **Major versions**: Breaking changes to core protocol
- **Minor versions**: New extensions, non-breaking features  
- **Patch versions**: Bug fixes and security updates

### How do I write custom extensions?

Follow the enum/trait hybrid pattern:

```rust
// Define trait for custom implementations
pub trait MyFunctionality: Send + Sync {
    fn do_something(&self) -> Result<()>;
}

// Define enum for built-in implementations
pub enum BuiltInImpl {
    MethodA { param: u32 },
    MethodB { config: String },
    // Future: Quantum*, AI*, etc.
}

impl MyFunctionality for BuiltInImpl {
    fn do_something(&self) -> Result<()> {
        // Implementation
    }
}
```

### Where can I get help?

- **Documentation**: Comprehensive docs at [docs site]
- **Examples**: Check the examples directory
- **Issues**: [Codeberg issues](https://codeberg.org/olocus/protocol/issues) for bug reports
- **Discussions**: [Codeberg forum](https://codeberg.org/olocus/forum/issues) for questions
- **Security**: security@olocus.protocol for vulnerabilities
