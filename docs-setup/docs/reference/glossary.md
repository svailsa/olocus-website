---
id: glossary
title: Glossary
sidebar_position: 1
---

# Glossary

Comprehensive reference for Olocus Protocol terminology and concepts.

## A

**Algorithm Negotiation**
The process by which peers securely agree on cryptographic algorithms to use during communication, with built-in downgrade protection mechanisms.

**Attestation**
Cryptographic proof or evidence about the integrity, state, or properties of a device, software, or data. Different from peer attestations in trust networks.

**Audit Trail**
An immutable sequence of events recorded in the blockchain that documents all actions, changes, and access patterns for compliance and forensic purposes.

## B

**Block**
The fundamental data structure in Olocus Protocol consisting of a header, payload, signature, and public key. Each block is cryptographically linked to form a chain.

**Block Hash**
The SHA-256 hash of a complete wire-encoded block, used to uniquely identify blocks and create chain linkages.

**Block Header**
Fixed metadata structure containing version, index, timestamp, previous hash, payload hash, and payload type identifier.

**BlockPayload**
Trait that defines the interface for data types that can be stored in blocks, enabling type-agnostic chain operations.

## C

**Chain**
A sequence of cryptographically linked blocks, where each block references the hash of its predecessor, ensuring integrity and ordering.

**Coordinate**
Fixed-point geographic representation using degrees × 10^7 for ~1cm precision, ensuring cross-platform deterministic calculations.

**CryptoSuite**
Enumeration of supported cryptographic algorithm combinations, including Ed25519+SHA-256 (default), post-quantum variants, and hybrid modes.

## D

**Downgrade Protection**
Multi-layer security mechanism preventing attackers from forcing the use of weaker cryptographic algorithms during negotiation.

**DID (Decentralized Identifier)**
W3C standard identifier that enables verifiable, self-sovereign digital identity without requiring a centralized registry.

## E

**Ed25519**
Default elliptic curve signature algorithm used in Olocus Protocol, providing 128-bit security with resistance to side-channel attacks.

**Extension**
Modular component that adds functionality to the core protocol while maintaining interoperability and backward compatibility.

**Extension Negotiation**
Capability-based feature discovery mechanism allowing peers to determine which extensions are available and compatible.

## F

**Fixed-Point Arithmetic**
Mathematical representation using integers to represent fractional values, ensuring deterministic results across different platforms and architectures.

**FROST (Flexible Round-Optimized Schnorr Threshold)**
Threshold signature scheme enabling M-of-N signing with minimal rounds and strong security properties.

## G

**Genesis Block**
The first block in a chain with index 0, previous hash of all zeros, and no predecessor reference.

## H

**HSM (Hardware Security Module)**
Dedicated cryptographic hardware providing secure key storage, generation, and operations with tamper-resistant properties.

**Hash Chain**
Cryptographic linking mechanism where each block contains the hash of its predecessor, creating an immutable sequence.

## I

**Index**
Sequential block number starting from 0 for genesis blocks, ensuring proper ordering and preventing replay attacks.

**Integrity Verification**
Process of validating that data has not been tampered with, using cryptographic hashes and digital signatures.

## K

**Keystore**
Secure storage system for cryptographic keys, supporting hierarchical deterministic derivation and hardware-backed protection.

## M

**MAX_FUTURE_DRIFT**
Protocol constant (300 seconds) defining maximum allowed timestamp ahead of current time for block acceptance.

**MAX_PAYLOAD_SIZE**
Protocol limit (16,777,216 bytes) on the maximum size of payload data in a single block.

**Measurement**
Universal data structure representing measured values with uncertainty quantification, provenance tracking, and validity windows.

**Merkle Tree**
Binary tree structure where leaf nodes contain data hashes and internal nodes contain hashes of their children, enabling efficient verification.

## P

**Payload**
Variable-length data content stored within a block, with type identified by payload_type field in the header.

**Payload Type**
32-bit identifier specifying the format and interpretation of payload data, with allocated ranges for core, extensions, and user-defined types.

**Post-Quantum Cryptography (PQC)**
Cryptographic algorithms believed to be secure against attacks by quantum computers, including Dilithium and ML-KEM.

**Provenance**
Detailed record of data origin, transformations, and attestations that tracks the complete history of a measurement.

## Q

**Query Engine**
Extension providing MongoDB-style declarative query language for flexible block retrieval with indexing and optimization.

## R

**RFC 3161**
Internet standard for time-stamp protocols, providing trusted timestamping services for digital documents.

## S

**SHA-256**
Cryptographic hash function producing 256-bit digests, used throughout Olocus Protocol for integrity verification and chain linking.

**Signature**
Cryptographic proof that a message was created by the holder of a specific private key, providing authentication and non-repudiation.

**Spatial-Temporal Attestation**
Enhanced attestation protocol that binds location and time data to provide stronger security guarantees for mobile and IoT applications.

## T

**Threshold Signature**
Cryptographic scheme requiring M-of-N parties to cooperatively generate signatures, providing enhanced security and availability.

**Timestamp**
Unix epoch time in seconds representing when a block was created, required to be monotonically increasing within a chain.

**Trust Score**
Quantified assessment of peer reliability computed using algorithms like PageRank, EigenTrust, or Bayesian methods.

**TSA (Time Stamping Authority)**
Service providing cryptographic timestamps to prove that data existed at a specific point in time.

## U

**Uncertainty**
Quantified measure of measurement precision using various models: Gaussian, Interval, Circular, Categorical, Confidence, Exact, or Unknown.

**Universal Measurement Foundation**
Core measurement framework providing consistent representation of any measured data with uncertainty, provenance, and validity tracking.

## V

**Value**
Structural data type enum supporting ~25 variants including primitives, temporal types, spatial types, and collections.

**Verifiable Credential**
W3C standard for cryptographically verifiable claims about subjects, supporting selective disclosure and revocation.

**Validity Window**
Temporal range during which a measurement is considered valid, with optional exponential decay modeling.

## W

**Wire Format**
Binary encoding specification defining how blocks are serialized for storage and transmission, supporting multiple formats and compression.

## Z

**Zero-Knowledge Proof**
Cryptographic method allowing verification of statements without revealing the underlying data, enabling privacy-preserving verification.
