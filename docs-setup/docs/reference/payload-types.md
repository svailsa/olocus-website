---
id: payload-types
title: Payload Types
sidebar_position: 3
---

# Payload Types Registry

Complete registry of payload type identifiers and their meanings across the Olocus Protocol ecosystem.

## Allocation Ranges

Payload types are allocated in specific ranges to ensure no conflicts and enable decentralized extension development.

| Range | Purpose | Registration | Total IDs |
|-------|---------|--------------|-----------|
| `0x0000-0x00FF` | Core protocol | Reserved | 256 |
| `0x0100-0x7FFF` | Standard extensions | Maintainer-allocated | 32,512 |
| `0x8000-0xFFFF` | User-defined | No registration required | 32,768 |

## Core Protocol Types (`0x0000-0x00FF`)

Reserved for fundamental protocol operations and future expansion.

| Type ID | Name | Description | Status |
|---------|------|-------------|--------|
| `0x0000` | Reserved | Null payload type | Reserved |
| `0x0001-0x00FE` | - | Future core types | Reserved |
| `0x00FF` | Checkpoint | Chain checkpoint payload | Reserved |

## Standard Extension Allocations (`0x0100-0x7FFF`)

Official extensions maintained by the Olocus Protocol team.

### Location Extension (`0x0100-0x01FF`)

**Extension**: `olocus-location`  
**Description**: GPS tracking, visit detection, and location analytics

| Type ID | Name | Description |
|---------|------|-------------|
| `0x0100` | LocationRecord | Basic GPS coordinates with timestamp |
| `0x0101` | LocationUpdate | Differential location update |
| `0x0102` | VisitDetection | Detected visit to a location |
| `0x0103` | GeofenceEvent | Geofence entry/exit events |
| `0x0104` | TrackingSession | Location tracking session metadata |
| `0x0105` | SpoofingAlert | Location spoofing detection alert |
| `0x0106` | ClusterResult | Location clustering analysis result |
| `0x0107-0x01FF` | - | Reserved for location extension |

### Trust & Peer Networks (`0x0200-0x02FF`)

**Extension**: `olocus-trust`  
**Description**: Peer identity, trust establishment, and reputation management

| Type ID | Name | Description |
|---------|------|-------------|
| `0x0200` | PeerIdentity | Peer DID and identity information |
| `0x0201` | TrustScore | Trust score calculation result |
| `0x0202` | ReputationUpdate | Reputation algorithm update |
| `0x0203` | AttestationClaim | Peer-to-peer attestation claim |
| `0x0204` | TrustRevocation | Trust relationship revocation |
| `0x0205` | PeerConnection | Peer connection establishment |
| `0x0206` | TrustMetrics | Trust network analytics |
| `0x0207` | SpatialAttestation | Location-bound attestation |
| `0x0208` | TemporalAttestation | Time-bound attestation |
| `0x0209-0x02FF` | - | Reserved for trust extension |

### Timestamping Authority (`0x0300-0x03FF`)

**Extension**: `olocus-tsa`  
**Description**: RFC 3161 timestamps, blockchain anchoring, Merkle aggregation

| Type ID | Name | Description |
|---------|------|-------------|
| `0x0300` | RFC3161Timestamp | RFC 3161 timestamp response |
| `0x0301` | BlockchainAnchor | Blockchain anchoring proof |
| `0x0302` | MerkleProof | Merkle tree inclusion proof |
| `0x0303` | AggregatedTimestamp | Batched timestamp aggregation |
| `0x0304` | OpentimestampsProof | OpenTimestamps proof |
| `0x0305` | RoughtimeResponse | Roughtime protocol response |
| `0x0306` | TimestampChain | Chain of timestamp proofs |
| `0x0307-0x03FF` | - | Reserved for TSA extension |

### Device Integrity (`0x0400-0x04FF`)

**Extension**: `olocus-integrity`  
**Description**: Device attestation, fraud detection, platform integrity

| Type ID | Name | Description |
|---------|------|-------------|
| `0x0400` | DeviceAttestation | Device integrity attestation |
| `0x0401` | PlayIntegrityVerdict | Android Play Integrity result |
| `0x0402` | AppAttestAssertion | iOS App Attest assertion |
| `0x0403` | FraudDetectionResult | Fraud/abuse detection result |
| `0x0404` | JailbreakDetection | Jailbreak/root detection result |
| `0x0405` | SafetyNetResult | Android SafetyNet result (legacy) |
| `0x0406` | IntegrityChallenge | Integrity verification challenge |
| `0x0407-0x04FF` | - | Reserved for integrity extension |

### Privacy & Anonymization (`0x0500-0x05FF`)

**Extension**: `olocus-privacy`  
**Description**: Privacy-preserving techniques, GDPR/CCPA compliance

| Type ID | Name | Description |
|---------|------|-------------|
| `0x0500` | AnonymizedData | k-anonymity processed data |
| `0x0501` | DifferentialPrivacy | DP-processed measurement |
| `0x0502` | ConsentRecord | GDPR/CCPA consent record |
| `0x0503` | DataMinimization | Minimized data representation |
| `0x0504` | ZKProof | Zero-knowledge proof |
| `0x0505` | ObfuscatedLocation | Location obfuscation result |
| `0x0506` | PrivacyBudget | Differential privacy budget |
| `0x0507-0x05FF` | - | Reserved for privacy extension |

### Verifiable Credentials (`0x0600-0x06FF`)

**Extension**: `olocus-credentials`  
**Description**: W3C Verifiable Credentials, DIDs, selective disclosure

| Type ID | Name | Description |
|---------|------|-------------|
| `0x0600` | VerifiableCredential | W3C Verifiable Credential |
| `0x0601` | DIDDocument | DID document registration |
| `0x0602` | CredentialRevocation | Credential revocation record |
| `0x0603` | PresentationRequest | Credential presentation request |
| `0x0604` | SelectiveDisclosure | Selective disclosure proof |
| `0x0605` | CredentialSchema | Credential schema definition |
| `0x0606` | BBSProof | BBS+ signature proof |
| `0x0607-0x06FF` | - | Reserved for credentials extension |

### Keystore & Key Management (`0x0700-0x07FF`)

**Extension**: `olocus-keystore`  
**Description**: Hierarchical deterministic keys, secure storage

| Type ID | Name | Description |
|---------|------|-------------|
| `0x0700` | KeyDerivation | HD key derivation record |
| `0x0701` | KeyRotation | Key rotation event |
| `0x0702` | BiometricBinding | Biometric key binding |
| `0x0703` | HardwareAttestation | Hardware-backed key attestation |
| `0x0704` | KeyBackup | Encrypted key backup |
| `0x0705` | DerivationPath | BIP-32/44 derivation path |
| `0x0706-0x07FF` | - | Reserved for keystore extension |

### Hardware Security Modules (`0x0800-0x08FF`)

**Extension**: `olocus-hsm`  
**Description**: PKCS#11, cloud HSM, enterprise key management

| Type ID | Name | Description |
|---------|------|-------------|
| `0x0800` | HSMAttestation | HSM attestation record |
| `0x0801` | PKCS11Operation | PKCS#11 operation log |
| `0x0802` | CloudHSMOperation | Cloud HSM operation record |
| `0x0803` | KeyCeremony | Key ceremony participation |
| `0x0804` | HSMHealthCheck | HSM health monitoring |
| `0x0805` | SessionPoolStats | HSM session pool statistics |
| `0x0806-0x08FF` | - | Reserved for HSM extension |

### Post-Quantum Cryptography (`0x0900-0x09FF`)

**Extension**: `olocus-pqc`  
**Description**: Quantum-resistant algorithms, hybrid modes, migration

| Type ID | Name | Description |
|---------|------|-------------|
| `0x0900` | DilithiumSignature | Dilithium signature record |
| `0x0901` | MLKEMKeyExchange | ML-KEM key exchange record |
| `0x0902` | HybridSignature | Hybrid classical+PQC signature |
| `0x0903` | AlgorithmMigration | PQC migration progress |
| `0x0904` | CryptoAgility | Algorithm agility metadata |
| `0x0905` | PQCBenchmark | PQC performance benchmark |
| `0x0906-0x09FF` | - | Reserved for PQC extension |

### Network & Transport (`0x0A00-0x0AFF`)

**Extension**: `olocus-network`  
**Description**: P2P networking, discovery, consensus, routing

| Type ID | Name | Description |
|---------|------|-------------|
| `0x0A00` | PeerDiscovery | Peer discovery announcement |
| `0x0A01` | ConsensusVote | Consensus algorithm vote |
| `0x0A02` | NetworkTopology | Network topology snapshot |
| `0x0A03` | RoutingUpdate | Routing table update |
| `0x0A04` | GossipMessage | Gossip protocol message |
| `0x0A05` | DHTRecord | DHT record storage |
| `0x0A06` | NATTraversal | NAT traversal attempt |
| `0x0A07-0x0AFF` | - | Reserved for network extension |

### Storage & Persistence (`0x0B00-0x0BFF`)

**Extension**: `olocus-storage`  
**Description**: Storage backends, caching, compression, WAL

| Type ID | Name | Description |
|---------|------|-------------|
| `0x0B00` | StorageOperation | Storage backend operation |
| `0x0B01` | CacheStatistics | Cache hit/miss statistics |
| `0x0B02` | WALEntry | Write-ahead log entry |
| `0x0B03` | CompressionMetrics | Compression performance metrics |
| `0x0B04` | DatabaseSchema | Database schema version |
| `0x0B05` | IndexOperation | Index creation/update operation |
| `0x0B06-0x0BFF` | - | Reserved for storage extension |

### Metrics & Observability (`0x0C00-0x0CFF`)

**Extension**: `olocus-metrics`  
**Description**: Prometheus, OpenTelemetry, monitoring, alerts

| Type ID | Name | Description |
|---------|------|-------------|
| `0x0C00` | MetricSnapshot | Metrics snapshot export |
| `0x0C01` | PrometheusExport | Prometheus format export |
| `0x0C02` | OpenTelemetrySpan | OpenTelemetry trace span |
| `0x0C03` | AlertTrigger | Monitoring alert trigger |
| `0x0C04` | HealthCheck | System health check result |
| `0x0C05` | PerformanceProfile | Performance profiling data |
| `0x0C06` | TimeSeriesData | Time series database record |
| `0x0C07-0x0CFF` | - | Reserved for metrics extension |

### HTTP Transport (`0x0D00-0x0DFF`)

**Extension**: `olocus-http`  
**Description**: REST API, HTTP transport, web integration

| Type ID | Name | Description |
|---------|------|-------------|
| `0x0D00` | HTTPRequest | HTTP API request log |
| `0x0D01` | HTTPResponse | HTTP API response log |
| `0x0D02` | RESTEndpoint | REST endpoint definition |
| `0x0D03` | WebhookEvent | Webhook delivery event |
| `0x0D04` | CORSPolicy | CORS policy configuration |
| `0x0D05` | APIRateLimit | Rate limiting configuration |
| `0x0D06-0x0DFF` | - | Reserved for HTTP extension |

### Foreign Function Interface (`0x0E00-0x0EFF`)

**Extension**: `olocus-ffi`  
**Description**: C bindings, mobile platforms, WASM

| Type ID | Name | Description |
|---------|------|-------------|
| `0x0E00` | FFICall | FFI function call log |
| `0x0E01` | MobileBinding | Mobile platform binding |
| `0x0E02` | WASMExecution | WebAssembly execution log |
| `0x0E03` | NativeLibrary | Native library registration |
| `0x0E04` | MemoryOperation | Memory management operation |
| `0x0E05-0x0EFF` | - | Reserved for FFI extension |

### Formal Verification (`0x0F00-0x0FFF`)

**Extension**: `olocus-fv`  
**Description**: Tamarin models, hax annotations, proof artifacts

| Type ID | Name | Description |
|---------|------|-------------|
| `0x0F00` | TamarinProof | Tamarin protocol proof |
| `0x0F01` | HaxAnnotation | hax verification annotation |
| `0x0F02` | ProofArtifact | Formal verification artifact |
| `0x0F03` | VerificationResult | Verification result summary |
| `0x0F04` | PropertyCheck | Verified property check |
| `0x0F05-0x0FFF` | - | Reserved for FV extension |

### Enterprise Extensions (`0x1000-0x1FFF`)

Enterprise-focused extensions for large-scale deployments.

#### Orchestration (`0x1000-0x10FF`)

**Extension**: `olocus-orchestration`

| Type ID | Name | Description |
|---------|------|-------------|
| `0x1000` | ExtensionRegistry | Extension registration record |
| `0x1001` | DependencyGraph | Extension dependency graph |
| `0x1002` | PipelineExecution | Pipeline execution log |
| `0x1003` | EventBusMessage | Inter-extension event message |
| `0x1004` | ConfigUpdate | Configuration update event |
| `0x1005` | HealthMonitor | Extension health monitoring |
| `0x1006` | CircuitBreaker | Circuit breaker state change |
| `0x1007-0x10FF` | - | Reserved |

#### Schema Registry (`0x1300-0x13FF`)

**Extension**: `olocus-schema`

| Type ID | Name | Description |
|---------|------|-------------|
| `0x1300` | SchemaDefinition | Schema definition record |
| `0x1301` | SchemaEvolution | Schema evolution event |
| `0x1302` | ValidationResult | Schema validation result |
| `0x1303` | SchemaRegistry | Schema registry operation |
| `0x1304` | CompatibilityCheck | Schema compatibility check |
| `0x1305-0x13FF` | - | Reserved |

#### Query Engine (`0x1400-0x14FF`)

**Extension**: `olocus-query`

| Type ID | Name | Description |
|---------|------|-------------|
| `0x1400` | QueryExecution | Query execution record |
| `0x1401` | IndexOperation | Index management operation |
| `0x1402` | QueryPlan | Query execution plan |
| `0x1403` | SearchResult | Query search result |
| `0x1404` | IndexStats | Index statistics |
| `0x1405-0x14FF` | - | Reserved |

#### Threshold Signatures (`0x1500-0x15FF`)

**Extension**: `olocus-threshold`

| Type ID | Name | Description |
|---------|------|-------------|
| `0x1500` | ThresholdSignature | M-of-N threshold signature |
| `0x1501` | KeyCeremony | Threshold key ceremony |
| `0x1502` | ShareDistribution | Key share distribution |
| `0x1503` | FROSTSignature | FROST protocol signature |
| `0x1504` | DKGExecution | Distributed key generation |
| `0x1505` | ShareRefresh | Proactive share refresh |
| `0x1506-0x15FF` | - | Reserved |

#### AI Agent Data (`0x1600-0x16FF`)

**Extension**: `olocus-agent`

| Type ID | Name | Description |
|---------|------|-------------|
| `0x1600` | InteractionRecord | AI agent interaction log |
| `0x1601` | TaskRecord | AI task execution record |
| `0x1602` | AgentRegistration | Agent registration event |
| `0x1603` | MetricsSnapshot | Agent performance metrics |
| `0x1604` | ReliabilityUpdate | Reliability score update |
| `0x1605` | ComplianceReport | Compliance check report |
| `0x1606` | StatusChange | Agent status change event |
| `0x1607` | ConstraintUpdate | Compliance constraint update |
| `0x1608` | AuditEvent | Agent audit trail event |
| `0x1609-0x16FF` | - | Reserved |

#### Enterprise Audit (`0x1700-0x17FF`)

**Extension**: `olocus-audit`

| Type ID | Name | Description |
|---------|------|-------------|
| `0x1700` | AuditEvent | Enterprise audit log event |
| `0x1701` | ComplianceReport | Regulatory compliance report |
| `0x1702` | PrivacyMask | Privacy-masked audit data |
| `0x1703` | AccessLog | System access audit log |
| `0x1704` | DataExport | Audit data export record |
| `0x1705` | RetentionPolicy | Data retention policy application |
| `0x1706` | AuditTrail | Complete audit trail chain |
| `0x1707` | RedactionEvent | Data redaction event |
| `0x1708` | AnonymizationLog | Data anonymization log |
| `0x1709-0x17FF` | - | Reserved |

#### Policy Engine (`0x1800-0x18FF`)

**Extension**: `olocus-policy`

| Type ID | Name | Description |
|---------|------|-------------|
| `0x1800` | PolicyDocument | Enterprise policy document |
| `0x1801` | PolicyDecision | Policy evaluation decision |
| `0x1802` | AccessControl | Access control enforcement |
| `0x1803` | PolicyViolation | Policy violation event |
| `0x1804` | HierarchyUpdate | Policy hierarchy change |
| `0x1805` | ConflictResolution | Policy conflict resolution |
| `0x1806-0x18FF` | - | Reserved |

#### Machine Learning (`0x1900-0x19FF`)

**Extension**: `olocus-ml` (v1.19.0)

| Type ID | Name | Description |
|---------|------|-------------|
| `0x1900` | ModelRecord | ML model definition and metadata |
| `0x1901` | InferenceResult | ML inference execution result |
| `0x1902` | FederatedUpdate | Federated learning gradient update |
| `0x1903` | AggregationResult | Federated aggregation result |
| `0x1904` | PrivateInference | Privacy-preserving inference |
| `0x1905` | TrainingEvent | On-device training event |
| `0x1906-0x19FF` | - | Reserved |

### Reserved Standard Extensions (`0x2000-0x7FFF`)

Reserved ranges for future standard extensions.

| Range | Purpose | Status |
|-------|---------|--------|
| `0x2000-0x2FFF` | Future standard extensions | Reserved |
| `0x3000-0x6FFF` | Third-party certified extensions | Available |
| `0x7000-0x7FFF` | Experimental extensions | Available |

## User-Defined Types (`0x8000-0xFFFF`)

Available for custom applications and private extensions. No registration required.

### Recommended Allocation Strategy

For user-defined extensions, consider this allocation approach:

| Range | Purpose | Example Use |
|-------|---------|-------------|
| `0x8000-0x8FFF` | Application-specific types | Custom business logic |
| `0x9000-0x9FFF` | Industry-specific extensions | Healthcare, Finance, IoT |
| `0xA000-0xAFFF` | Research and experimental | Academic research, prototypes |
| `0xB000-0xEFFF` | Enterprise private extensions | Internal corporate extensions |
| `0xF000-0xFFFF` | Testing and development | Development, testing, debugging |

### Example User-Defined Types

```rust
// Custom weather monitoring system
const WEATHER_MEASUREMENT: u32 = 0x8001;
const WEATHER_FORECAST: u32 = 0x8002;
const WEATHER_ALERT: u32 = 0x8003;

// Financial trading application
const TRADE_ORDER: u32 = 0x9100;
const MARKET_DATA: u32 = 0x9101;
const SETTLEMENT: u32 = 0x9102;

// Healthcare research
const PATIENT_DATA: u32 = 0xA200;
const CLINICAL_TRIAL: u32 = 0xA201;
const MEDICAL_DEVICE: u32 = 0xA202;
```

## Implementation Guidelines

### Payload Type Registration

1. **Standard Extensions**: Must be approved and allocated by maintainers
2. **User-Defined**: No registration required, choose from `0x8000-0xFFFF`
3. **Conflicts**: User-defined types may conflict - coordinate within organizations
4. **Documentation**: Document custom types for team collaboration

### Best Practices

1. **Namespace Organization**: Group related types in contiguous ranges
2. **Versioning**: Consider version numbers in type allocation
3. **Future Expansion**: Leave gaps for future related types
4. **Collision Avoidance**: For user types, use random selection or organizational prefixes

### Payload Type Validation

```rust
/// Validate payload type allocation
fn validate_payload_type(payload_type: u32) -> Result<PayloadCategory, Error> {
    match payload_type {
        0x0000..=0x00FF => Ok(PayloadCategory::Core),
        0x0100..=0x7FFF => Ok(PayloadCategory::StandardExtension),
        0x8000..=0xFFFF => Ok(PayloadCategory::UserDefined),
    }
}
```

## Migration and Compatibility

### Payload Type Evolution

- **Backward Compatibility**: New versions should remain parseable by older implementations
- **Schema Evolution**: Use schema registry for complex payload evolution
- **Deprecation**: Old payload types may be marked deprecated but remain valid
- **Migration Tools**: Provide tools for payload type migration

### Version Handling

Payload types are independent of protocol versions, but implementations should handle:

1. **Unknown Types**: Gracefully handle unrecognized payload types
2. **Extension Discovery**: Negotiate supported payload types during handshake
3. **Fallback Handling**: Define fallback behavior for unsupported types
