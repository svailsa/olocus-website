---
id: downgrade-protection
title: Downgrade Protection
sidebar_position: 1
---

# Downgrade Protection

Downgrade protection is a critical security feature in Olocus Protocol that prevents attackers from forcing the use of weaker cryptographic algorithms or older protocol versions. The protocol implements seven complementary layers of protection to defend against sophisticated downgrade attacks.

## What Are Downgrade Attacks?

A downgrade attack occurs when an adversary manipulates the algorithm negotiation process to force peers to use weaker cryptographic algorithms than they would normally choose. This can happen through:

- **Man-in-the-middle attacks**: Intercepting and modifying negotiation messages
- **Active network attackers**: Selectively dropping messages for stronger algorithms
- **Protocol manipulation**: Exploiting weaknesses in negotiation logic
- **Replay attacks**: Re-using old negotiation messages with weaker algorithms

## The Seven Layers of Protection

Olocus Protocol implements a defense-in-depth approach with seven independent protection mechanisms:

### Layer 1: Protocol Version Checking

The first line of defense enforces minimum protocol version requirements:

```rust
pub struct AlgorithmPreferences {
    pub protocol_version: u16,        // Current version
    pub min_protocol_version: u16,    // Minimum acceptable
    pub max_protocol_version: u16,    // Maximum supported
}
```

**Protection Mechanism:**
- Each peer specifies minimum acceptable protocol version
- Connections are rejected if peer version is too old
- Prevents rollback to vulnerable protocol versions

**Example:**
```rust
if peer_preferences.protocol_version < our_min_protocol_version {
    return Err(Error::ProtocolVersionTooOld);
}
```

### Layer 2: Signed Algorithm Preferences

Algorithm preferences are cryptographically signed to detect tampering:

```rust
pub struct SignedAlgorithmPreferences {
    pub preferences: AlgorithmPreferences,
    pub signature: Vec<u8>,          // Ed25519 signature
    pub signer_key: Vec<u8>,         // Public key
    pub timestamp: i64,              // When signed
    pub nonce: Vec<u8>,              // Replay protection
}
```

**Protection Mechanism:**
- Preferences are signed with Ed25519 before transmission
- Recipients verify signatures before processing
- Tampered preferences are rejected immediately
- Prevents modification of algorithm lists in transit

**Security Properties:**
- **Integrity**: Signatures detect any modification
- **Authenticity**: Signatures prove the sender's identity
- **Non-repudiation**: Signers cannot deny their preferences

### Layer 3: Strict Preference Ordering

The initiator's algorithm preference order is authoritative:

```rust
// Initiator's preferences take precedence
let selected_algorithm = find_best_common_algorithm(
    &initiator_preferences.signature_algorithms,  // Order matters
    &responder_preferences.signature_algorithms   // Support check only
)?;
```

**Protection Mechanism:**
- Initiator ranks algorithms in order of preference (strongest first)
- Selection chooses first algorithm in initiator's list that responder supports
- Prevents responder from forcing a weaker algorithm

**Example Scenario:**
- Initiator prefers: `[Dilithium3, Ed25519, Ed448]`
- Responder supports: `[Ed448, Ed25519]`
- **Selected**: `Ed25519` (first in initiator's list that responder supports)
- **NOT**: `Ed448` (would be responder manipulation)

### Layer 4: Negotiation Commitment

All offered algorithms are cryptographically committed in a transcript:

```rust
pub struct NegotiationTranscript {
    pub initiator_offered: Vec<AlgorithmId>,    // All algorithms offered
    pub responder_offered: Vec<AlgorithmId>,    
    pub selected_algorithms: SelectedAlgorithms,
    pub commitment_hash: [u8; 32],              // SHA-256 of above
    pub timestamp: i64,
}
```

**Protection Mechanism:**
- Complete algorithm lists are hashed and committed
- Transcript must be included in subsequent handshake messages
- Prevents selective algorithm hiding or modification
- Creates auditable record of what was offered

**Commitment Process:**
1. Hash all offered algorithms from both parties
2. Include selected algorithms and timestamp
3. Store commitment hash for handshake verification
4. Reject handshakes that don't include matching transcript

### Layer 5: Minimum Security Requirements

Security policies enforce baseline algorithm strength:

```rust
pub struct SecurityRequirements {
    pub min_security_level: SecurityLevel,      // e.g., Level128
    pub require_post_quantum: bool,
    pub forbidden_algorithms: HashSet<AlgorithmId>,
    pub required_algorithms: Vec<AlgorithmId>,
}
```

**Protection Mechanism:**
- Algorithms below minimum security level are automatically rejected
- Organizations can mandate post-quantum algorithms
- Known-broken algorithms are explicitly forbidden
- Critical algorithms can be marked as required

**Example Policy:**
```rust
let policy = SecurityRequirements {
    min_security_level: SecurityLevel::Level128,
    require_post_quantum: false,
    forbidden_algorithms: [
        AlgorithmId::Md5,     // Cryptographically broken
        AlgorithmId::Sha1,    // Collision attacks exist
    ].into(),
    required_algorithms: vec![
        AlgorithmId::Ed25519, // Must support Ed25519
    ],
};
```

### Layer 6: Forbidden Algorithm Lists

Explicitly blocked algorithms cannot be negotiated:

```rust
impl AlgorithmStatus {
    Broken,                    // MUST NOT use
    Deprecated,               // SHOULD NOT use
    Deprecating { sunset_date }, // WARNING: will be deprecated
    Acceptable,               // OK to use
    Recommended,              // Preferred choice
}
```

**Protection Mechanism:**
- Algorithms marked as `Broken` are automatically rejected
- Deprecated algorithms require explicit policy override
- Deprecating algorithms trigger warnings
- Dynamic algorithm status based on security research

**Automatic Blocking:**
```rust
if algorithm_metadata.status == AlgorithmStatus::Broken {
    return Err(Error::ForbiddenAlgorithm(algorithm));
}
```

### Layer 7: Handshake Transcript Binding

The negotiation transcript MUST be included in the cryptographic handshake:

```rust
pub struct HandshakeMessage {
    // ... other fields
    pub negotiation_transcript: NegotiationTranscript,
    pub transcript_signature: Signature,
}
```

**Protection Mechanism:**
- Negotiation transcript is cryptographically bound to handshake
- Any modification to the negotiation invalidates the handshake
- Provides end-to-end integrity for the entire negotiation process
- Creates immutable audit trail

**Verification Process:**
1. Extract transcript from handshake message
2. Verify transcript hash matches negotiated algorithms
3. Confirm transcript signature is valid
4. Reject handshake if transcript doesn't match negotiation

## Attack Scenarios and Defenses

### Scenario 1: Algorithm Substitution Attack

**Attack:** Attacker modifies algorithm preferences in transit to force weaker algorithms.

**Defense:** 
- **Layer 2**: Signature verification detects modification
- **Layer 4**: Negotiation commitment prevents substitution
- **Layer 7**: Handshake binding ensures end-to-end integrity

### Scenario 2: Protocol Version Rollback

**Attack:** Attacker forces use of older protocol version with known vulnerabilities.

**Defense:**
- **Layer 1**: Minimum version requirements reject old protocols
- **Layer 5**: Security policies enforce version minimums

### Scenario 3: Selective Algorithm Hiding

**Attack:** Attacker selectively blocks stronger algorithms to force weaker choices.

**Defense:**
- **Layer 3**: Strict ordering prevents manipulation of preference lists
- **Layer 4**: Commitment includes all offered algorithms
- **Layer 6**: Forbidden lists block known-weak algorithms

### Scenario 4: Replay Attack

**Attack:** Attacker replays old negotiation with deprecated algorithms.

**Defense:**
- **Layer 2**: Timestamp and nonce prevent replay
- **Layer 6**: Algorithm status blocking prevents deprecated algorithms
- **Layer 7**: Fresh handshake transcript required

### Scenario 5: Policy Bypass

**Attack:** Attacker tries to bypass organizational security policies.

**Defense:**
- **Layer 5**: Minimum security requirements are enforced client-side
- **Layer 6**: Forbidden algorithm lists cannot be overridden
- Local policy enforcement prevents bypass

## Implementation Guidelines

### Proper Configuration

```rust
// Example secure configuration
let preferences = AlgorithmPreferences {
    // Strong algorithms first
    signature_algorithms: vec![
        AlgorithmId::Dilithium3,    // Post-quantum
        AlgorithmId::Ed25519,       // Classical strong
    ],
    
    // Set conservative minimums
    min_security_level: SecurityLevel::Level128,
    allow_deprecated: false,
    
    // Prevent version rollback
    protocol_version: 2,
    min_protocol_version: 2,
    max_protocol_version: 3,
};

// Strong security requirements
let requirements = SecurityRequirements {
    min_security_level: SecurityLevel::Level128,
    require_post_quantum: false,  // Set true when ready
    forbidden_algorithms: [
        AlgorithmId::Md5,
        AlgorithmId::Sha1,
        AlgorithmId::Rsa1024,      // Too weak
    ].into(),
    required_algorithms: vec![
        AlgorithmId::Ed25519,      // Must support
    ],
};
```

### Validation Process

```rust
fn validate_negotiation(
    initiator_prefs: &SignedAlgorithmPreferences,
    responder_prefs: &SignedAlgorithmPreferences,
    requirements: &SecurityRequirements,
) -> Result<()> {
    // Layer 1: Check protocol versions
    if initiator_prefs.preferences.protocol_version < requirements.min_protocol_version {
        return Err(Error::ProtocolVersionTooOld);
    }
    
    // Layer 2: Verify signatures
    verify_preferences_signature(initiator_prefs)?;
    verify_preferences_signature(responder_prefs)?;
    
    // Layer 3: Use initiator's ordering (automatic in selection)
    
    // Layer 4: Generate commitment transcript
    let transcript = generate_negotiation_transcript(initiator_prefs, responder_prefs)?;
    
    // Layer 5: Apply security requirements
    validate_security_requirements(&transcript.selected_algorithms, requirements)?;
    
    // Layer 6: Check forbidden algorithms
    validate_forbidden_algorithms(&transcript.selected_algorithms, requirements)?;
    
    // Layer 7: Store transcript for handshake binding
    store_transcript_for_handshake(transcript)?;
    
    Ok(())
}
```

### Monitoring and Alerting

Organizations should monitor for downgrade attempts:

```rust
// Log all negotiation attempts
fn log_negotiation_attempt(
    peer_id: &PeerId,
    offered_algorithms: &[AlgorithmId],
    selected_algorithms: &SelectedAlgorithms,
) {
    info!("Negotiation with {}: offered={:?}, selected={:?}", 
          peer_id, offered_algorithms, selected_algorithms);
    
    // Alert on suspicious patterns
    if contains_deprecated_algorithms(offered_algorithms) {
        warn!("Peer {} offered deprecated algorithms: {:?}", 
              peer_id, deprecated_algorithms);
    }
    
    if security_level(&selected_algorithms) < SecurityLevel::Level128 {
        error!("Negotiation resulted in weak algorithms: {:?}", 
               selected_algorithms);
    }
}
```

## Testing Downgrade Protection

### Attack Simulation

The protocol includes comprehensive tests simulating various attack scenarios:

```rust
#[test]
fn test_algorithm_substitution_attack() {
    let mut preferences = create_test_preferences();
    
    // Simulate attacker modifying preferences
    preferences.signature_algorithms = vec![AlgorithmId::WeakAlgorithm];
    
    // Should be detected by signature verification
    let result = negotiate_algorithms(&preferences, &responder_prefs, &requirements);
    assert_eq!(result.unwrap_err(), Error::InvalidSignature);
}

#[test]
fn test_version_rollback_attack() {
    let mut preferences = create_test_preferences();
    preferences.protocol_version = 1;  // Try to force old version
    
    let result = negotiate_algorithms(&preferences, &responder_prefs, &requirements);
    assert_eq!(result.unwrap_err(), Error::ProtocolVersionTooOld);
}
```

### Penetration Testing

Regular security testing should include:

- **Protocol fuzzing**: Test with malformed negotiation messages
- **Man-in-the-middle simulation**: Verify protection against active attackers  
- **Policy bypass attempts**: Ensure security requirements are enforced
- **Timing attacks**: Verify constant-time negotiation processing

## Best Practices

### For Developers

1. **Always verify signatures** before processing preferences
2. **Use strong default preferences** with post-quantum algorithms
3. **Set conservative minimums** for security levels and protocol versions
4. **Log all negotiations** for security monitoring
5. **Test downgrade scenarios** regularly

### For Administrators

1. **Define organizational policies** with appropriate security requirements
2. **Monitor negotiation patterns** for suspicious activity
3. **Keep algorithm status updated** based on current security research
4. **Plan post-quantum migration** with hybrid algorithm support
5. **Regular security audits** of negotiation configurations

### For Security Teams

1. **Review algorithm metadata** regularly for new vulnerabilities
2. **Update forbidden lists** as algorithms are broken
3. **Monitor for policy violations** in production systems
4. **Test downgrade resistance** as part of security assessments
5. **Plan incident response** for cryptographic vulnerabilities

## Future Enhancements

The downgrade protection system is designed for evolution:

- **Dynamic algorithm updates**: Real-time updates to algorithm status
- **Zero-knowledge proofs**: Prove negotiation integrity without revealing preferences
- **Formal verification**: Mathematical proofs of downgrade resistance
- **Machine learning detection**: AI-powered detection of unusual negotiation patterns
- **Quantum-safe commitment schemes**: Post-quantum secure transcript binding
