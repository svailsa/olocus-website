---
id: algorithm-ids
title: Algorithm Identifiers
sidebar_position: 2
---

# Algorithm Identifiers

Complete reference for all cryptographic algorithm identifiers used in the Olocus Protocol.

## Crypto Suite Identifiers

The primary cryptographic algorithm combinations supported by the protocol.

| Suite ID | Signature Algorithm | Hash Algorithm | Key Exchange | Status | Security Level |
|----------|---------------------|----------------|--------------|--------|----------------|
| `0x00` | Ed25519 | SHA-256 | X25519 | **Required** | 128-bit |
| `0x01` | Dilithium3 | SHA3-256 | ML-KEM-768 | Optional (PQC) | NIST Level 3 |
| `0x02` | Ed25519+Dilithium3 | SHA-256 | X25519+ML-KEM | Optional (Hybrid) | Hybrid |
| `0x03` | secp256k1 | SHA-256 | ECDH-secp256k1 | Optional | 128-bit |
| `0x04` | secp256r1 | SHA-256 | ECDH-secp256r1 | Optional | 128-bit |
| `0x05` | BLS12-381 | SHA-256 | - | Optional (Threshold) | 128-bit |
| `0x06` | Dilithium5 | SHA3-256 | ML-KEM-1024 | Optional (PQC) | NIST Level 5 |
| `0x07-0x0F` | - | - | - | Reserved | - |

## Signature Algorithm Identifiers

Individual signature algorithms that can be used in various contexts.

### Classical Algorithms

| Algorithm ID | Name | Key Size | Signature Size | Security Level | Status |
|--------------|------|----------|----------------|----------------|--------|
| `0x0100` | Ed25519 | 32 bytes | 64 bytes | 128-bit | **Default** |
| `0x0101` | secp256k1 | 32 bytes | 64 bytes | 128-bit | Optional |
| `0x0102` | secp256r1 | 32 bytes | 64 bytes | 128-bit | Optional |
| `0x0103` | Ed448 | 57 bytes | 114 bytes | 224-bit | Optional |
| `0x0104` | BLS12-381 | 48 bytes | 96 bytes | 128-bit | Threshold |
| `0x0105-0x01FF` | - | - | - | - | Reserved |

### Post-Quantum Algorithms

| Algorithm ID | Name | Key Size | Signature Size | Security Level | Status |
|--------------|------|----------|----------------|----------------|--------|
| `0x0200` | Dilithium2 | 1312 bytes | 2420 bytes | NIST Level 1 | Optional |
| `0x0201` | Dilithium3 | 1952 bytes | 3293 bytes | NIST Level 3 | **Recommended** |
| `0x0202` | Dilithium5 | 2592 bytes | 4595 bytes | NIST Level 5 | Optional |
| `0x0203` | Falcon-512 | 897 bytes | 690 bytes | NIST Level 1 | Optional |
| `0x0204` | Falcon-1024 | 1793 bytes | 1330 bytes | NIST Level 5 | Optional |
| `0x0205` | SPHINCS+-SHA256-128s | 32 bytes | 7856 bytes | NIST Level 1 | Optional |
| `0x0206` | SPHINCS+-SHA256-192s | 48 bytes | 17088 bytes | NIST Level 3 | Optional |
| `0x0207` | SPHINCS+-SHA256-256s | 64 bytes | 29792 bytes | NIST Level 5 | Optional |
| `0x0208-0x02FF` | - | - | - | - | Reserved |

### Hybrid Algorithms

| Algorithm ID | Name | Components | Security | Status |
|--------------|------|------------|----------|--------|
| `0x0300` | Ed25519+Dilithium3 | Classical + PQC | Hybrid | Migration |
| `0x0301` | secp256r1+Dilithium3 | NIST curves + PQC | Hybrid | Optional |
| `0x0302` | Ed25519+Falcon-512 | Classical + PQC | Hybrid | Optional |
| `0x0303-0x03FF` | - | - | - | Reserved |

## Hash Algorithm Identifiers

Cryptographic hash functions used for integrity verification.

| Algorithm ID | Name | Output Size | Security Level | Status | Notes |
|--------------|------|-------------|----------------|--------|-------|
| `0x1000` | SHA-256 | 32 bytes | 128-bit | **Default** | FIPS 180-4 |
| `0x1001` | SHA-384 | 48 bytes | 192-bit | Optional | FIPS 180-4 |
| `0x1002` | SHA-512 | 64 bytes | 256-bit | Optional | FIPS 180-4 |
| `0x1003` | SHA3-256 | 32 bytes | 128-bit | Optional | FIPS 202 |
| `0x1004` | SHA3-384 | 48 bytes | 192-bit | Optional | FIPS 202 |
| `0x1005` | SHA3-512 | 64 bytes | 256-bit | Optional | FIPS 202 |
| `0x1006` | BLAKE2b | 32-64 bytes | Configurable | Optional | RFC 7693 |
| `0x1007` | BLAKE3 | 32 bytes | 128-bit | Optional | Modern |
| `0x1008-0x10FF` | - | - | - | Reserved | - |

## Key Exchange Algorithm Identifiers

Key agreement and key encapsulation mechanisms.

### Classical Key Exchange

| Algorithm ID | Name | Key Size | Shared Secret | Security | Status |
|--------------|------|----------|---------------|----------|--------|
| `0x2000` | X25519 | 32 bytes | 32 bytes | 128-bit | **Default** |
| `0x2001` | X448 | 56 bytes | 56 bytes | 224-bit | Optional |
| `0x2002` | ECDH-secp256r1 | 32 bytes | 32 bytes | 128-bit | Optional |
| `0x2003` | ECDH-secp384r1 | 48 bytes | 48 bytes | 192-bit | Optional |
| `0x2004` | ECDH-secp521r1 | 66 bytes | 66 bytes | 256-bit | Optional |
| `0x2005-0x20FF` | - | - | - | - | Reserved |

### Post-Quantum Key Encapsulation

| Algorithm ID | Name | Public Key | Ciphertext | Shared Secret | Security | Status |
|--------------|------|-----------|------------|---------------|----------|--------|
| `0x2100` | ML-KEM-512 | 800 bytes | 768 bytes | 32 bytes | NIST Level 1 | Optional |
| `0x2101` | ML-KEM-768 | 1184 bytes | 1088 bytes | 32 bytes | NIST Level 3 | **Recommended** |
| `0x2102` | ML-KEM-1024 | 1568 bytes | 1568 bytes | 32 bytes | NIST Level 5 | Optional |
| `0x2103` | Classic McEliece | ~1MB | ~1MB | 32 bytes | NIST Level 5 | Optional |
| `0x2104` | HQC-128 | 2249 bytes | 4481 bytes | 64 bytes | NIST Level 1 | Optional |
| `0x2105` | HQC-192 | 4522 bytes | 9026 bytes | 64 bytes | NIST Level 3 | Optional |
| `0x2106` | HQC-256 | 7245 bytes | 14469 bytes | 64 bytes | NIST Level 5 | Optional |
| `0x2107-0x21FF` | - | - | - | - | - | Reserved |

### Hybrid Key Exchange

| Algorithm ID | Name | Components | Security | Status |
|--------------|------|------------|----------|--------|
| `0x2200` | X25519+ML-KEM-768 | Classical + PQC | Hybrid | **Migration** |
| `0x2201` | X448+ML-KEM-1024 | Classical + PQC | Hybrid | Optional |
| `0x2202-0x22FF` | - | - | - | Reserved |

## Symmetric Encryption Identifiers

Symmetric ciphers for bulk encryption operations.

| Algorithm ID | Name | Key Size | Block/Nonce | Mode | Status |
|--------------|------|----------|-------------|------|--------|
| `0x3000` | AES-256-GCM | 32 bytes | 12 byte nonce | AEAD | **Default** |
| `0x3001` | AES-128-GCM | 16 bytes | 12 byte nonce | AEAD | Optional |
| `0x3002` | ChaCha20-Poly1305 | 32 bytes | 12 byte nonce | AEAD | Optional |
| `0x3003` | XChaCha20-Poly1305 | 32 bytes | 24 byte nonce | AEAD | Optional |
| `0x3004` | AES-256-CBC | 32 bytes | 16 byte IV | CBC | Legacy |
| `0x3005-0x30FF` | - | - | - | - | Reserved |

## Threshold Signature Schemes

Multi-party signature algorithms for M-of-N scenarios.

| Algorithm ID | Name | Threshold | Key Generation | Security | Status |
|--------------|------|-----------|----------------|----------|--------|
| `0x4000` | FROST-Ed25519 | M-of-N | DKG | 128-bit | **Recommended** |
| `0x4001` | FROST-secp256k1 | M-of-N | DKG | 128-bit | Optional |
| `0x4002` | BLS-Threshold | M-of-N | DKG | 128-bit | Optional |
| `0x4003` | Shamir+Ed25519 | M-of-N | Trusted Dealer | 128-bit | Simple |
| `0x4004` | Schnorr-Threshold | M-of-N | DKG | 128-bit | Optional |
| `0x4005-0x40FF` | - | - | - | - | Reserved |

## Compression Algorithm Identifiers

Data compression methods for payload optimization.

| Algorithm ID | Name | Compression Ratio | Speed | Status |
|--------------|------|-------------------|-------|--------|
| `0x5000` | None | 1.0x | Fastest | Default |
| `0x5001` | Zstd | 2-5x | Fast | **Recommended** |
| `0x5002` | LZ4 | 1.5-2.5x | Fastest | Fallback |
| `0x5003` | Gzip | 2-3x | Medium | Compatible |
| `0x5004` | Brotli | 3-4x | Slow | High ratio |
| `0x5005-0x50FF` | - | - | - | Reserved |

## Algorithm Selection Guidelines

### Default Configuration
For new implementations, use these defaults:
- **Signature**: Ed25519 (`0x0100`)
- **Hash**: SHA-256 (`0x1000`)
- **Key Exchange**: X25519 (`0x2000`)
- **Encryption**: AES-256-GCM (`0x3000`)
- **Compression**: Zstd (`0x5001`) with LZ4 (`0x5002`) fallback

### Post-Quantum Migration
For quantum-resistant deployments:
- **Signature**: Dilithium3 (`0x0201`)
- **Hash**: SHA3-256 (`0x1003`)
- **Key Exchange**: ML-KEM-768 (`0x2101`)

### Hybrid Mode (Recommended for transition)
- **Signature**: Ed25519+Dilithium3 (`0x0300`)
- **Key Exchange**: X25519+ML-KEM-768 (`0x2200`)

### Performance-Critical Applications
- **Signature**: Ed25519 (`0x0100`)
- **Hash**: BLAKE3 (`0x1007`)
- **Compression**: LZ4 (`0x5002`)

## Algorithm Deprecation

Deprecated or discouraged algorithms:

| Algorithm ID | Name | Deprecated | Reason | Replacement |
|--------------|------|------------|--------|-------------|
| `0x3004` | AES-256-CBC | v1.16.0 | No authentication | AES-256-GCM |
| - | MD5 | Never supported | Collision attacks | SHA-256 |
| - | SHA-1 | Never supported | Collision attacks | SHA-256 |
| - | RSA | Never supported | Quantum vulnerable | Ed25519 |

## Security Considerations

1. **Algorithm Agility**: All implementations must support algorithm negotiation
2. **Downgrade Protection**: 7-layer protection against algorithm downgrade attacks
3. **Future Proofing**: Reserved ranges for quantum, AI, and blockchain algorithms
4. **Performance**: Balance security with operational requirements
5. **Standards Compliance**: Prefer NIST/IETF standardized algorithms
6. **Side-Channel Resistance**: Choose constant-time implementations
