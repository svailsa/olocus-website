---
id: extension-system
title: Extension System
sidebar_position: 2
---

# Extension System

The Olocus Protocol's extension system provides a modular architecture for adding functionality while maintaining a minimal core (~500 lines). The system uses a hybrid approach combining compile-time enums with runtime traits, offering both performance and flexibility.

## Core Design Philosophy

### Minimal Core + Extensions

The protocol follows an HTTP/SMTP-inspired design philosophy:

- **Minimal Core**: Essential functionality only (~500 lines)
- **Extension-Based**: 22 modular extensions adding ~90,000 lines total
- **Type-Agnostic**: Generic `BlockPayload` trait for any data type
- **Future-Proof**: Enum/trait hybrid pattern for extensibility without breaking changes

### Extension Architecture Principles

1. **Plugin Architecture**: Runtime registration and discovery
2. **Capability-Based**: Feature negotiation between peers
3. **Dependency Management**: Automatic resolution of extension dependencies
4. **Version Compatibility**: Semantic versioning and migration support

## Enum/Trait Hybrid Pattern

All extensions follow this fundamental pattern for maximum extensibility:

### The Pattern

```rust
// Trait for custom implementations
pub trait SomeFunctionality: Send + Sync {
    fn do_something(&self) -> Result<Output>;
    fn get_capabilities(&self) -> Vec<String>;
}

// Enum for built-in implementations
pub enum BuiltInImplementation {
    MethodA { param: u32 },
    MethodB { config: String },
    MethodC { settings: Settings },
    // Future: Quantum*, AI*, Blockchain*, etc.
}

impl SomeFunctionality for BuiltInImplementation {
    fn do_something(&self) -> Result<Output> {
        match self {
            BuiltInImplementation::MethodA { param } => {
                // Implementation for Method A
            }
            BuiltInImplementation::MethodB { config } => {
                // Implementation for Method B  
            }
            BuiltInImplementation::MethodC { settings } => {
                // Implementation for Method C
            }
        }
    }

    fn get_capabilities(&self) -> Vec<String> {
        match self {
            BuiltInImplementation::MethodA { .. } => vec!["method-a".to_string()],
            BuiltInImplementation::MethodB { .. } => vec!["method-b".to_string()],
            BuiltInImplementation::MethodC { .. } => vec!["method-c".to_string()],
        }
    }
}
```

### Benefits of This Pattern

1. **Compile-time Safety**: Built-in implementations are type-safe and fast
2. **Runtime Extensibility**: Custom implementations via traits
3. **Future-Proof**: New variants can be added without breaking changes
4. **Performance**: Enums allow efficient match statements and inlining
5. **Flexibility**: Traits enable dependency injection and testing

### Real-World Example: Clustering Algorithms

```rust
// From olocus-location extension
pub trait ClusteringAlgorithm: Send + Sync {
    fn cluster(&self, locations: &[LocationPayload]) -> Vec<Option<usize>>;
    fn name(&self) -> &'static str;
}

#[derive(Debug, Clone)]
pub enum BuiltInClusteringAlgorithm {
    DBSCAN {
        epsilon: f64,
        min_samples: usize,
    },
    KMeans {
        k: usize,
        max_iterations: usize,
        tolerance: f64,
    },
    OPTICS {
        min_samples: usize,
        max_eps: f64,
        xi: f64,
    },
    HDBSCAN {
        min_cluster_size: usize,
        min_samples: usize,
    },
    // Future: QuantumClustering, AIBasedClustering, etc.
}

impl ClusteringAlgorithm for BuiltInClusteringAlgorithm {
    // Implementation details...
}
```

## Plugin Architecture

### Plugin Registration System

The core provides a global plugin registry for runtime extension management:

```rust
/// Plugin trait that all extensions must implement
pub trait Plugin: Send + Sync {
    /// Get plugin metadata
    fn metadata(&self) -> &PluginMetadata;
    
    /// Initialize the plugin
    fn initialize(&mut self) -> Result<()>;
    
    /// Shutdown the plugin
    fn shutdown(&mut self) -> Result<()>;
    
    /// Create a payload instance for the given type
    fn create_payload(&self, payload_type: u32) -> Option<Box<dyn Any + Send + Sync>>;
    
    /// Negotiate capabilities with peer
    fn negotiate_capabilities(&self, peer_caps: &[String]) -> Vec<String>;
}

/// Plugin metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
    pub id: String,                    // "com.example.myplugin"
    pub name: String,                  // Human-readable name
    pub version: String,               // Semantic version
    pub payload_types: (u32, u32),     // Type ID range
    pub requires: Vec<String>,         // Required capabilities
    pub provides: Vec<String>,         // Provided capabilities
    pub author: String,                // Author/organization
    pub license: String,               // License identifier
}
```

### Plugin Registration

```rust
use olocus_core::plugin::{register_plugin, Plugin, PluginMetadata};

// Register a custom plugin
let my_plugin = Arc::new(MyCustomPlugin::new());
register_plugin(my_plugin)?;

// List all registered plugins
let plugins = list_plugins();
for plugin in plugins {
    println!("Plugin: {} v{}", plugin.name, plugin.version);
}

// Get plugin for specific payload type
if let Some(plugin) = get_plugin_for_type(0x8000) {
    let payload = plugin.create_payload(0x8000);
}
```

## Extension Negotiation

### Capability-Based Discovery

Extensions announce their capabilities and negotiate common functionality:

```rust
/// Extension capability descriptor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionDescriptor {
    pub id: String,                    // Extension identifier
    pub version: String,               // Semantic version
    pub capabilities: Vec<String>,     // Provided capabilities
    pub depends_on: Vec<String>,       // Dependencies
    pub payload_types: Option<(u32, u32)>, // Payload type range
    pub mandatory: bool,               // Required for communication
    pub config: HashMap<String, String>, // Configuration
}
```

### Negotiation Process

1. **Announcement**: Each peer announces supported extensions
2. **Analysis**: Find common extensions and capabilities
3. **Dependency Resolution**: Ensure all dependencies are met
4. **Version Compatibility**: Select compatible versions
5. **Configuration**: Exchange configuration parameters

```rust
use olocus_core::extension_negotiation::{ExtensionNegotiator, ExtensionDescriptor};

// Create negotiator with our extensions
let our_extensions = vec![
    ExtensionDescriptor {
        id: "olocus.location".to_string(),
        version: "1.0.0".to_string(),
        capabilities: vec!["gps-tracking".to_string(), "visit-detection".to_string()],
        depends_on: vec!["olocus.core".to_string()],
        payload_types: Some((0x0100, 0x01FF)),
        mandatory: false,
        config: HashMap::new(),
    },
];

let mut negotiator = ExtensionNegotiator::new(our_extensions);

// Process peer's announcement
let peer_announcement = /* received from peer */;
negotiator.process_peer_announcement(peer_announcement)?;

// Perform negotiation
let result = negotiator.negotiate()?;
println!("Negotiated {} extensions", result.negotiated_extensions.len());

// Check specific capability availability
if negotiator.has_capability("gps-tracking") {
    // Use GPS tracking functionality
}
```

## Standard Extensions

The protocol includes 22 standard extensions organized by functionality:

### Core Infrastructure Extensions

1. **Location** (`olocus-location`) - GPS tracking, visit detection, spoofing detection
2. **Trust** (`olocus-trust`) - Peer identity, trust establishment, attestations
3. **TSA** (`olocus-tsa`) - RFC 3161 timestamps, blockchain anchoring
4. **Integrity** (`olocus-integrity`) - iOS App Attest, Android Play Integrity
5. **Privacy** (`olocus-privacy`) - k-anonymity, differential privacy, GDPR compliance

### Cryptographic Extensions

6. **Keystore** (`olocus-keystore`) - BIP-32/44 derivation, secure storage
7. **HSM** (`olocus-hsm`) - PKCS#11, Cloud HSM, hardware security
8. **Credentials** (`olocus-credentials`) - W3C Verifiable Credentials, DIDs
9. **PQC** (`olocus-pqc`) - Post-quantum cryptography (Dilithium, ML-KEM)
10. **Threshold** (`olocus-threshold`) - M-of-N threshold signatures (FROST, BLS)

### System Extensions

11. **Network** (`olocus-network`) - Transport protocols, discovery, consensus
12. **Storage** (`olocus-storage`) - Multiple backends, caching, compression
13. **Metrics** (`olocus-metrics`) - Prometheus, OpenTelemetry, monitoring
14. **HTTP** (`olocus-http`) - REST API for block operations
15. **FFI** (`olocus-ffi`) - C-compatible interface for iOS/Android/WASM

### Advanced Extensions

16. **Formal Verification** (`olocus-fv`) - Tamarin models, hax annotations
17. **Orchestration** (`olocus-orchestration`) - Multi-extension coordination
18. **Schema** (`olocus-schema`) - Payload validation, schema evolution
19. **Query** (`olocus-query`) - Flexible query language, indexing

### Enterprise Extensions

20. **Agent** (`olocus-agent`) - AI agent interaction data, performance metrics
21. **Audit** (`olocus-audit`) - Immutable audit logging, compliance
22. **Policy** (`olocus-policy`) - Enterprise policy enforcement, RBAC

## Extension Development

### Creating a Custom Extension

```rust
use olocus_core::{BlockPayload, Error, Result};
use serde::{Deserialize, Serialize};

// Define your payload type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MyCustomPayload {
    pub data: String,
    pub metadata: HashMap<String, String>,
}

// Implement BlockPayload trait
impl BlockPayload for MyCustomPayload {
    fn to_bytes(&self) -> Vec<u8> {
        bincode::serialize(self).unwrap()
    }
    
    fn from_bytes(data: &[u8]) -> Result<Self> {
        bincode::deserialize(data).map_err(|_| Error::InvalidPayload)
    }
    
    fn payload_type(&self) -> u32 {
        0x8000 // User-defined range
    }
}

// Implement your extension trait
pub trait MyFunctionality: Send + Sync {
    fn process(&self, input: &str) -> Result<String>;
}

// Built-in implementations enum
#[derive(Debug, Clone)]
pub enum BuiltInProcessor {
    Simple { prefix: String },
    Advanced { config: ProcessorConfig },
    // Future: AIProcessor, QuantumProcessor, etc.
}

impl MyFunctionality for BuiltInProcessor {
    fn process(&self, input: &str) -> Result<String> {
        match self {
            BuiltInProcessor::Simple { prefix } => {
                Ok(format!("{}: {}", prefix, input))
            }
            BuiltInProcessor::Advanced { config } => {
                // Advanced processing logic
                Ok(config.process(input))
            }
        }
    }
}

// Create plugin implementation
pub struct MyPlugin {
    metadata: PluginMetadata,
    processor: Arc<dyn MyFunctionality>,
}

impl Plugin for MyPlugin {
    fn metadata(&self) -> &PluginMetadata {
        &self.metadata
    }
    
    fn initialize(&mut self) -> Result<()> {
        // Initialization logic
        Ok(())
    }
    
    fn shutdown(&mut self) -> Result<()> {
        // Cleanup logic
        Ok(())
    }
    
    fn create_payload(&self, payload_type: u32) -> Option<Box<dyn Any + Send + Sync>> {
        if payload_type == 0x8000 {
            Some(Box::new(MyCustomPayload {
                data: "default".to_string(),
                metadata: HashMap::new(),
            }))
        } else {
            None
        }
    }
    
    fn negotiate_capabilities(&self, peer_caps: &[String]) -> Vec<String> {
        // Return intersection of our and peer capabilities
        vec!["my-custom-capability".to_string()]
    }
}
```

### Payload Type Allocation

Extensions must use allocated payload type ranges to avoid conflicts:

```rust
pub mod payload_ranges {
    /// Core protocol types
    pub const CORE: (u32, u32) = (0x0000, 0x00FF);
    
    /// Standard extension ranges
    pub const LOCATION: (u32, u32) = (0x0100, 0x01FF);
    pub const TRUST: (u32, u32) = (0x0200, 0x02FF);
    pub const ATTESTATION: (u32, u32) = (0x0300, 0x03FF);
    pub const CREDENTIAL: (u32, u32) = (0x0400, 0x04FF);
    
    /// Reserved for future extensions
    pub const RESERVED: (u32, u32) = (0x0500, 0x7FFF);
    
    /// User-defined plugins
    pub const USER: (u32, u32) = (0x8000, 0xFFFF);
}
```

## Extension Composition

### Dependency Management

Extensions can depend on other extensions, with automatic resolution:

```rust
// Extension with dependencies
ExtensionDescriptor {
    id: "my-advanced-extension".to_string(),
    depends_on: vec![
        "olocus.core".to_string(),
        "olocus.location".to_string(),
        "olocus.trust".to_string(),
    ],
    // ...
}

// The negotiator ensures all dependencies are satisfied
let result = negotiator.negotiate()?;
for warning in result.warnings {
    println!("Warning: {}", warning);
}
```

### Cross-Extension Communication

Extensions can communicate through the event bus and shared capabilities:

```rust
// Extension A publishes an event
event_bus.publish("location.update", LocationEvent {
    lat: 37.7749,
    lon: -122.4194,
    timestamp: SystemTime::now(),
})?;

// Extension B subscribes to events
event_bus.subscribe("location.update", |event: LocationEvent| {
    // Process location update
    trust_manager.update_location_trust(event)?;
})?;
```

## Runtime Extension Management

### Dynamic Loading

Extensions can be loaded and unloaded at runtime:

```rust
// Load extension from shared library
let lib = Library::open("path/to/extension.so")?;
let create_plugin: Symbol<unsafe extern fn() -> Box<dyn Plugin>> = 
    lib.get(b"create_plugin")?;
let plugin = unsafe { create_plugin() };

// Register the plugin
register_plugin(Arc::from(plugin))?;

// Later, unregister if needed
unregister_plugin("my.extension.id")?;
```

### Extension Discovery

The system supports multiple discovery mechanisms:

1. **Static Registration**: Compile-time inclusion
2. **Dynamic Loading**: Runtime library loading
3. **Network Discovery**: Remote extension announcements
4. **Configuration**: Extension manifests

```rust
// Configuration-based discovery
let config = ExtensionConfig::from_file("extensions.toml")?;
for ext_config in config.extensions {
    if ext_config.enabled {
        load_extension(&ext_config)?;
    }
}
```

## Performance Considerations

### Extension Overhead

The extension system is designed for minimal overhead:

- **Compile-time optimization**: Built-in enums allow inlining
- **Zero-cost abstractions**: Traits compile to direct calls
- **Lazy loading**: Extensions loaded only when needed
- **Caching**: Capability negotiation results cached

### Benchmarks

Typical performance impact of the extension system:

- **Plugin registration**: ~1µs per plugin
- **Capability negotiation**: ~5ms for 22 extensions
- **Extension lookup**: ~10ns (hash table)
- **Trait dispatch**: ~1ns overhead vs direct call

## Testing Extensions

### Unit Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_custom_extension() {
        let processor = BuiltInProcessor::Simple { 
            prefix: "test".to_string() 
        };
        
        let result = processor.process("input").unwrap();
        assert_eq!(result, "test: input");
    }
    
    #[test]
    fn test_plugin_registration() {
        let plugin = MyPlugin::new();
        register_plugin(Arc::new(plugin)).unwrap();
        
        assert!(get_plugin("my.plugin.id").is_some());
    }
}
```

### Integration Testing

```rust
#[test]
fn test_extension_negotiation() {
    let negotiator = setup_test_negotiator();
    let peer_announcement = create_test_announcement();
    
    negotiator.process_peer_announcement(peer_announcement).unwrap();
    let result = negotiator.negotiate().unwrap();
    
    assert!(result.success);
    assert!(result.negotiated_extensions.len() > 0);
}
```

## Future Extensions

The system is designed for extensibility. Future extension categories include:

### Next Generation Extensions

- **Zero-Knowledge Proofs**: Privacy-preserving protocols
- **Machine Learning**: On-device AI capabilities
- **IoT Integration**: Device-specific protocols
- **Quantum Networking**: Quantum communication protocols
- **Homomorphic Encryption**: Computation on encrypted data

### Extension Comments

All enums include future placeholders to guide development:

```rust
pub enum MyAlgorithm {
    Current { /* current implementation */ },
    // Future: Quantum*, AI*, Blockchain*
}
```

This pattern ensures consistent naming and helps developers understand the intended evolution path.

## Best Practices

### Extension Design Guidelines

1. **Single Responsibility**: Each extension should have a focused purpose
2. **Minimal Dependencies**: Avoid unnecessary dependencies
3. **Graceful Degradation**: Work when optional dependencies are missing
4. **Version Compatibility**: Support multiple API versions
5. **Error Handling**: Provide clear error messages and recovery paths
6. **Documentation**: Include comprehensive examples and API docs
7. **Testing**: Achieve >95% test coverage
8. **Performance**: Profile and optimize critical paths

### Common Pitfalls

1. **Circular Dependencies**: Ensure dependency graphs are acyclic
2. **Version Skew**: Test with multiple versions of dependencies
3. **Resource Leaks**: Properly implement shutdown and cleanup
4. **Thread Safety**: All extension code must be thread-safe
5. **Payload Size**: Keep payloads small to minimize network overhead

The extension system provides a powerful foundation for building modular, extensible applications while maintaining the protocol's core simplicity and performance characteristics.