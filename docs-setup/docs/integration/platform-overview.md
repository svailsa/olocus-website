---
id: platform-overview
title: Platform Integration Overview
sidebar_position: 1
---

# Platform Integration Overview

Olocus Protocol runs on multiple platforms with tailored integration strategies for each.

## Supported Platforms

| Platform | Status | Integration Method | Key Extensions |
|----------|--------|-------------------|----------------|
| **iOS** | ✅ Stable | FFI + Swift | Location, Integrity, Keystore |
| **Android** | ✅ Stable | FFI + JNI | Location, Integrity, Keystore |
| **Web** | ✅ Stable | WASM | HTTP, Storage, Metrics |
| **Linux** | ✅ Stable | Native | All extensions |
| **macOS** | ✅ Stable | Native | All extensions |
| **Windows** | ✅ Stable | Native | Most extensions |
| **Embedded** | 🔶 Beta | Native/FFI | Core + Limited |

## Integration Approaches

### 1. Native Integration (Rust)
Direct use in Rust applications:

```toml
[dependencies]
olocus-core = "0.1"
olocus-location = "0.1"
olocus-trust = "0.1"
```

**Advantages:**
- Full API access
- Best performance
- All extensions available
- Type safety

**Use Cases:**
- Server applications
- Desktop applications
- System services
- Command-line tools

### 2. FFI Integration (C Interface)
For mobile and other language bindings:

```c
// Initialize
olocus_init();

// Create block
FFIBlock* block = olocus_block_create_genesis(
    timestamp, payload, payload_len,
    payload_type, private_key
);

// Verify
int valid = olocus_block_verify(block);

// Cleanup
olocus_block_destroy(block);
```

**Advantages:**
- Universal compatibility
- Minimal overhead
- Memory safe interface
- Platform SDK integration

**Use Cases:**
- iOS apps (Swift/Objective-C)
- Android apps (Java/Kotlin)
- Python applications
- Node.js addons

### 3. WebAssembly (Browser/Node.js)
For web applications:

```javascript
import init, { 
    generate_key, 
    create_genesis_block,
    verify_block 
} from 'olocus-wasm';

await init();

const keypair = generate_key();
const block = create_genesis_block(
    payload, 
    keypair.private_key,
    Date.now()
);
```

**Advantages:**
- Browser compatible
- Node.js support
- Sandboxed security
- Easy deployment

**Use Cases:**
- Progressive Web Apps
- Browser extensions
- Electron apps
- Node.js services

### 4. HTTP API
RESTful interface for any language:

```bash
# Submit block
curl -X POST https://api.example.com/blocks \
  -H "Content-Type: application/json" \
  -d '{"payload": {...}}'

# Retrieve block
curl https://api.example.com/blocks/{hash}
```

**Advantages:**
- Language agnostic
- Simple integration
- Scalable deployment
- Standard tooling

**Use Cases:**
- Microservices
- Third-party integrations
- Legacy systems
- Quick prototypes

## Platform-Specific Features

### Mobile Platforms

#### iOS
- **Secure Enclave**: Hardware key storage
- **App Attest**: Device integrity verification
- **Core Location**: GPS integration
- **Keychain**: Credential storage

#### Android
- **Android Keystore**: Hardware-backed keys
- **Play Integrity**: Anti-tampering
- **Location Services**: Fused location provider
- **SharedPreferences**: Encrypted storage

### Desktop Platforms

#### Windows
- **CryptoAPI**: System cryptography
- **Windows Hello**: Biometric auth
- **Registry**: Configuration storage

#### macOS
- **Keychain Services**: Secure storage
- **Touch ID**: Biometric authentication
- **Core Location**: Location services

#### Linux
- **libsecret**: Keyring integration
- **systemd**: Service management
- **D-Bus**: Inter-process communication

## Choosing an Integration Method

### Decision Matrix

| Factor | Native | FFI | WASM | HTTP |
|--------|--------|-----|------|------|
| Performance | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Ease of Use | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Feature Access | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Type Safety | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐ |
| Deployment | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

### Recommendations by Use Case

**High Performance Required**
→ Use Native (Rust) integration

**Mobile Application**
→ Use FFI with platform SDK

**Web Application**
→ Use WASM for client, HTTP for server

**Rapid Prototyping**
→ Use HTTP API

**Cross-Platform Desktop**
→ Use Native with conditional compilation

## Architecture Patterns

### 1. Client-Server
```
[Mobile App] --FFI--> [Olocus] --HTTP--> [Server] --Native--> [Olocus]
```

### 2. Peer-to-Peer
```
[Device A] <--Network Extension--> [Device B]
     ↓                                    ↓
[Olocus Core]                    [Olocus Core]
```

### 3. Hybrid Cloud
```
[Edge Device] --MQTT--> [Gateway] --HTTP--> [Cloud]
      ↓                      ↓                  ↓
   [WASM]                  [FFI]            [Native]
```

## Security Considerations

### Platform Security Features

**Use Platform Features:**
- Hardware security modules
- Secure enclaves/elements
- Biometric authentication
- Platform attestation

**Secure Communication:**
- TLS 1.3 for network
- Certificate pinning
- Mutual authentication
- End-to-end encryption

**Key Management:**
- Platform keychains
- Hardware-backed storage
- Key rotation policies
- Secure key derivation

## Performance Optimization

### By Platform

**Mobile:**
- Minimize battery usage
- Adaptive sampling rates
- Background processing limits
- Memory constraints

**Web:**
- Bundle size optimization
- Lazy loading
- Web Workers
- IndexedDB caching

**Server:**
- Connection pooling
- Horizontal scaling
- Load balancing
- Database optimization

## Testing Strategies

### Platform Testing Matrix

| Test Type | iOS | Android | Web | Desktop |
|-----------|-----|---------|-----|---------|
| Unit Tests | ✅ | ✅ | ✅ | ✅ |
| Integration | ✅ | ✅ | ✅ | ✅ |
| UI Tests | Appium | Espresso | Selenium | Native |
| Performance | Instruments | Profiler | Lighthouse | Native |
| Security | App Attest | Play Integrity | CSP | Platform |

## Common Integration Issues

### Problem: Binary Size
**Solution:** Use dynamic linking, feature flags, or HTTP API

### Problem: Memory Leaks
**Solution:** Proper FFI cleanup, reference counting

### Problem: Platform Differences
**Solution:** Abstract platform layer, conditional compilation

### Problem: Version Mismatch
**Solution:** Version negotiation, backward compatibility

## Getting Started

Choose your platform:
- [iOS Integration Guide](./ios)
- [Android Integration Guide](./android)
- [Web Integration Guide](./web)
- [FFI Reference](./ffi)
- [WASM Guide](./wasm)
- [Language SDKs](./language-sdks)

## Support Matrix

| Feature | iOS 14+ | Android 7+ | Chrome 90+ | Firefox 88+ |
|---------|---------|------------|------------|-------------|
| Core Protocol | ✅ | ✅ | ✅ | ✅ |
| Location | ✅ | ✅ | 🔶 | 🔶 |
| Integrity | ✅ | ✅ | ❌ | ❌ |
| Storage | ✅ | ✅ | ✅ | ✅ |
| Network | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ Full Support | 🔶 Partial Support | ❌ Not Available