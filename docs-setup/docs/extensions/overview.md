---
id: overview
title: Extensions Overview
sidebar_position: 1
---

# Extensions Catalog

The Olocus Protocol provides 23 modular extensions that add specialized functionality to the minimal core. Each extension follows the same trait/enum pattern for maximum flexibility.

## Extension Categories

### 🌍 Location & Spatial

<div className="extension-grid">
  <div className="extension-card">
    <div className="extension-card__title">📍 Location</div>
    <div className="extension-card__description">
      GPS tracking, visit detection, DBSCAN/KMeans clustering, spoofing detection
    </div>
    <div className="extension-card__badge extension-card__badge--stable">Stable</div>
  </div>
</div>

### 🔐 Trust & Security

<div className="extension-grid">
  <div className="extension-card">
    <div className="extension-card__title">🤝 Trust</div>
    <div className="extension-card__description">
      Unified reputation, peer connections, attestations, spatial-temporal proofs
    </div>
    <div className="extension-card__badge extension-card__badge--stable">Stable v2.0</div>
  </div>
  
  <div className="extension-card">
    <div className="extension-card__title">⏰ TSA</div>
    <div className="extension-card__description">
      RFC 3161 timestamps, blockchain anchoring, OpenTimestamps
    </div>
    <div className="extension-card__badge extension-card__badge--stable">Stable</div>
  </div>
  
  <div className="extension-card">
    <div className="extension-card__title">✅ Integrity</div>
    <div className="extension-card__description">
      iOS App Attest, Android Play Integrity, fraud detection
    </div>
    <div className="extension-card__badge extension-card__badge--stable">Stable</div>
  </div>
  
  <div className="extension-card">
    <div className="extension-card__title">🔒 HSM</div>
    <div className="extension-card__description">
      Hardware Security Modules, PKCS#11, Cloud HSM, FIPS 140-2/3
    </div>
    <div className="extension-card__badge extension-card__badge--stable">Stable</div>
  </div>
</div>

### 🛡️ Privacy & Compliance

<div className="extension-grid">
  <div className="extension-card">
    <div className="extension-card__title">🕵️ Privacy</div>
    <div className="extension-card__description">
      k-anonymity, differential privacy, GDPR/CCPA compliance
    </div>
    <div className="extension-card__badge extension-card__badge--stable">Stable</div>
  </div>
  
  <div className="extension-card">
    <div className="extension-card__title">📜 Credentials</div>
    <div className="extension-card__description">
      W3C Verifiable Credentials, DIDs, selective disclosure
    </div>
    <div className="extension-card__badge extension-card__badge--stable">Stable</div>
  </div>
  
  <div className="extension-card">
    <div className="extension-card__title">📊 Audit</div>
    <div className="extension-card__description">
      Immutable audit logging, SOC2/HIPAA/PCI-DSS templates
    </div>
    <div className="extension-card__badge extension-card__badge--alpha">Alpha</div>
  </div>
  
  <div className="extension-card">
    <div className="extension-card__title">📋 Policy</div>
    <div className="extension-card__description">
      Enterprise policy enforcement, RBAC/ABAC, encryption requirements
    </div>
    <div className="extension-card__badge extension-card__badge--alpha">Alpha</div>
  </div>
</div>

### 🤖 AI & Machine Learning

<div className="extension-grid">
  <div className="extension-card">
    <div className="extension-card__title">🧠 ML</div>
    <div className="extension-card__description">
      On-device inference, federated learning, differential privacy
    </div>
    <div className="extension-card__badge extension-card__badge--alpha">Alpha</div>
  </div>
  
  <div className="extension-card">
    <div className="extension-card__title">🤖 Agent</div>
    <div className="extension-card__description">
      AI agent interaction tracking, reliability scoring, compliance
    </div>
    <div className="extension-card__badge extension-card__badge--alpha">Alpha</div>
  </div>
</div>

### 🌐 Infrastructure

<div className="extension-grid">
  <div className="extension-card">
    <div className="extension-card__title">🌐 Network</div>
    <div className="extension-card__description">
      P2P, DHT, consensus protocols, QUIC, WebRTC
    </div>
    <div className="extension-card__badge extension-card__badge--beta">Beta</div>
  </div>
  
  <div className="extension-card">
    <div className="extension-card__title">💾 Storage</div>
    <div className="extension-card__description">
      RocksDB, SQLite, in-memory, filesystem, LRU cache
    </div>
    <div className="extension-card__badge extension-card__badge--stable">Stable</div>
  </div>
  
  <div className="extension-card">
    <div className="extension-card__title">📈 Metrics</div>
    <div className="extension-card__description">
      Prometheus, OpenTelemetry, alerting, profiling
    </div>
    <div className="extension-card__badge extension-card__badge--stable">Stable</div>
  </div>
  
  <div className="extension-card">
    <div className="extension-card__title">🎭 Orchestration</div>
    <div className="extension-card__description">
      Multi-extension coordination, pipelines, dependency management
    </div>
    <div className="extension-card__badge extension-card__badge--beta">Beta</div>
  </div>
</div>

### 🔮 Advanced

<div className="extension-grid">
  <div className="extension-card">
    <div className="extension-card__title">🔮 PQC</div>
    <div className="extension-card__description">
      Post-quantum crypto: Dilithium, ML-KEM/Kyber, hybrid modes
    </div>
    <div className="extension-card__badge extension-card__badge--beta">Beta</div>
  </div>
  
  <div className="extension-card">
    <div className="extension-card__title">✍️ Threshold</div>
    <div className="extension-card__description">
      M-of-N signatures, FROST, BLS, key ceremonies
    </div>
    <div className="extension-card__badge extension-card__badge--alpha">Alpha</div>
  </div>
  
  <div className="extension-card">
    <div className="extension-card__title">📐 Schema</div>
    <div className="extension-card__description">
      Payload validation, schema registry, evolution
    </div>
    <div className="extension-card__badge extension-card__badge--beta">Beta</div>
  </div>
  
  <div className="extension-card">
    <div className="extension-card__title">🔍 Query</div>
    <div className="extension-card__description">
      Flexible queries, indexing, cost-based planning
    </div>
    <div className="extension-card__badge extension-card__badge--beta">Beta</div>
  </div>
</div>

### 🔌 Integration

<div className="extension-grid">
  <div className="extension-card">
    <div className="extension-card__title">🌐 HTTP</div>
    <div className="extension-card__description">
      REST API, wire format transport, pluggable storage
    </div>
    <div className="extension-card__badge extension-card__badge--beta">Beta</div>
  </div>
  
  <div className="extension-card">
    <div className="extension-card__title">📱 FFI</div>
    <div className="extension-card__description">
      iOS/Android bindings, C API, WebAssembly
    </div>
    <div className="extension-card__badge extension-card__badge--beta">Beta</div>
  </div>
  
  <div className="extension-card">
    <div className="extension-card__title">🔑 Keystore</div>
    <div className="extension-card__description">
      BIP-32/44, iOS Keychain, Android Keystore, key rotation
    </div>
    <div className="extension-card__badge extension-card__badge--stable">Stable</div>
  </div>
</div>

## Stability Levels

- **Stable** ✅ - Production-ready, backward compatible
- **Beta** 🔶 - Feature-complete, may have breaking changes
- **Alpha** 🔷 - Under development, expect changes

## Using Extensions

Add extensions to your `Cargo.toml`:

```toml
[dependencies]
olocus-core = { git = "https://codeberg.org/olocus/protocol.git" }
olocus-location = { git = "https://codeberg.org/olocus/protocol.git" }
olocus-trust = { git = "https://codeberg.org/olocus/protocol.git" }
```

Import and use:

```rust
use olocus_core::*;
use olocus_location::*;
use olocus_trust::*;

// Your code here
```

## Creating Custom Extensions

Every extension follows the enum/trait hybrid pattern:

```rust
// Trait for custom implementations
pub trait YourExtension: Send + Sync {
    fn process(&self, data: &[u8]) -> Result<Vec<u8>>;
}

// Enum for built-in implementations
pub enum BuiltInImplementation {
    MethodA { config: String },
    MethodB { params: u32 },
    // Future: QuantumMethod, AIMethod, etc.
}

impl YourExtension for BuiltInImplementation {
    // Implementation
}
```

See [Creating Extensions](./creating-extensions) for a complete guide.