---
id: formal-verification
title: Formal Verification
sidebar_position: 4
---

# Formal Verification

The Olocus Protocol includes comprehensive formal verification to ensure security properties are mathematically proven rather than just tested. This document outlines the verification approach, tools, and verified properties.

## Verification Philosophy

### Why Formal Verification?

Traditional testing can only show the presence of bugs, not their absence. Formal verification provides mathematical proofs that critical security properties hold under all possible conditions.

**Benefits:**
- **Mathematical Certainty**: Properties are proven, not just tested
- **Complete Coverage**: All possible execution paths analyzed
- **Early Detection**: Catches subtle bugs before implementation
- **Security Confidence**: Cryptographic guarantees verified
- **Regulatory Compliance**: Meets high-assurance requirements

### Verification Strategy

The protocol uses a multi-level verification approach:

| Level | Scope | Method | Tool | Confidence |
|-------|-------|--------|------|------------|
| **FV-L1** | Protocol Logic | Symbolic Model | Tamarin | Dolev-Yao Security |
| **FV-L2** | Core Implementation | Type Verification | hax/F* | Implementation Correctness |
| **FV-L3** | Full System | Computational Model | CryptoVerif | Concrete Security Bounds |

## Verification Levels

### FV-L1: Symbolic Protocol Analysis

**Tool**: Tamarin Prover

**Scope**: Protocol logic and message flows

**Security Model**: Dolev-Yao adversary model
- Adversary controls network completely
- Can intercept, modify, replay, and inject messages
- Cannot break cryptographic primitives
- Perfect cryptography assumption

**Verified Properties**:
- Protocol correctness
- Authentication properties
- Secrecy properties
- Agreement properties

### FV-L2: Implementation Verification

**Tool**: hax + F*/Coq/Lean

**Scope**: Rust implementation verification

**Approach**: Extract functional models from Rust code and verify in proof assistants

**Properties**:
- Type safety
- Memory safety
- Functional correctness
- Absence of runtime errors

### FV-L3: Computational Security

**Tool**: CryptoVerif/hax integration

**Scope**: Full system with concrete security bounds

**Properties**:
- Computational security assumptions
- Concrete attack bounds
- Side-channel resistance
- Implementation security

## Core Protocol Properties

### Chain Integrity Properties

#### Property FV-CHAIN-01: Hash Continuity
```
∀i > 0. block[i].previous = Hash(block[i-1])
```
Every block (except genesis) correctly references the previous block's hash.

**Tamarin Specification**:
```tamarin
lemma chain_continuity:
  "All b1 b2 #t1 #t2. 
    ChainLink(b1, b2) @ t1 & 
    Block(b1) @ t1 & 
    Block(b2) @ t2
    ==> 
    b2.previous = hash(b1)"
```

#### Property FV-CHAIN-02: Index Monotonicity
```
∀i. block[i+1].index = block[i].index + 1
```
Block indices form a monotonic sequence.

#### Property FV-CHAIN-03: Timestamp Ordering
```
∀i. block[i+1].timestamp > block[i].timestamp
```
Timestamps are strictly increasing.

#### Property FV-CHAIN-04: Payload Integrity
```
∀b. b.payload_hash = Hash(b.payload)
```
Payload hashes correctly represent payload contents.

#### Property FV-CHAIN-05: Genesis Validity
```
block[0].index = 0 ∧ block[0].previous = zeros(32)
```
Genesis blocks have correct initial values.

### Signature Properties

#### Property FV-SIG-01: Signature Validity
```
∀b. Verify(b.public_key, message(b), b.signature) = true
```
All blocks have valid signatures.

**Tamarin Specification**:
```tamarin
lemma signature_validity:
  "All b #t. ValidBlock(b) @ t ==> 
    (Ex sk #t2. SigningKey(sk) @ t2 & 
     Valid(verify(pk(sk), message(b), b.signature)))"
```

#### Property FV-SIG-02: Non-repudiation
An adversary cannot produce valid signatures without the private key.

**Tamarin Specification**:
```tamarin
lemma signature_non_repudiation:
  "All b #t. ValidSignature(b) @ t ==> 
    (Ex sk #t2. Honest(sk) @ t2 & 
     SignedWith(b, sk) @ t2)"
```

#### Property FV-SIG-03: Key Binding (Single-Signer)
```
∀b. b.public_key = genesis.public_key
```
All blocks in a chain signed by the same key.

### Algorithm Negotiation Properties

#### Property FV-NEG-01: Downgrade Resistance
Cannot negotiate an algorithm weaker than the minimum requirement.

**Tamarin Specification**:
```tamarin
lemma no_downgrade:
  "not (Ex A B alg #t. 
    Negotiated(A, B, alg) @ t &
    WeakerThan(alg, MinimumRequirement))"
```

#### Property FV-NEG-02: Preference Authenticity
Algorithm preferences are cryptographically bound to the signer.

**Tamarin Specification**:
```tamarin
lemma preference_authenticity:
  "All prefs sig pk #t. 
    SignedPreferences(prefs, sig, pk) @ t ==>
    (Ex sk #t2. PrivateKey(sk, pk) @ t2 &
     SignedBy(prefs, sk) @ t2)"
```

#### Property FV-NEG-03: Transcript Binding
Complete negotiation transcript is cryptographically bound to the session.

#### Property FV-NEG-04: Freshness
Nonces prevent replay of old preferences.

**Tamarin Specification**:
```tamarin
lemma preference_freshness:
  "All prefs nonce #t1 #t2.
    UsedPreference(prefs, nonce) @ t1 &
    UsedPreference(prefs, nonce) @ t2
    ==> t1 = t2"
```

#### Property FV-NEG-05: Forbidden Exclusion
Blacklisted algorithms are never selected.

## Security Properties

### Authentication Properties

#### Block Authenticity
Every valid block was created by the holder of the corresponding private key.

```tamarin
lemma block_authenticity:
  "All b pk #t. BlockVerified(b, pk) @ t ==>
    (Ex #t2. BlockCreated(b, pk) @ t2 & t2 < t)"
```

#### Chain Authenticity
Every valid chain was created by a single entity (in single-signer mode).

### Secrecy Properties

#### Private Key Secrecy
Private keys never leak to the adversary.

```tamarin
lemma private_key_secrecy:
  "not (Ex sk #t. K(sk) @ t & PrivateKey(sk))"
```

#### Nonce Secrecy
Fresh nonces remain secret until used.

### Agreement Properties

#### Chain Agreement
Honest parties agree on the same chain structure.

```tamarin
lemma chain_agreement:
  "All A B chain #t1 #t2.
    Accepts(A, chain) @ t1 &
    Accepts(B, chain) @ t2
    ==> SameChain(A, B, chain)"
```

#### Algorithm Agreement
Parties agree on the negotiated cryptographic algorithms.

```tamarin
lemma algorithm_agreement:
  "All A B alg #t1 #t2.
    Negotiated(A, B, alg) @ t1 &
    Negotiated(B, A, alg) @ t2
    ==> SameAlgorithm(alg)"
```

## Tamarin Models

### Core Protocol Model

**File**: `olocus-fv/models/core/protocol.spthy`

**Key Elements**:
- Block creation and verification rules
- Hash chaining mechanics  
- Signature generation and verification
- Adversary capabilities

**Rules**:
```tamarin
rule CreateBlock:
  [ SigningKey(sk), PreviousBlock(prev) ]
  --[ BlockCreated(block, pk(sk)), Honest(sk) ]->
  [ Block(block), Out(block) ]

rule VerifyBlock:
  [ Block(block), In(block) ]
  --[ BlockVerified(block, block.public_key) ]->
  [ ValidBlock(block) ]
```

### Algorithm Negotiation Model  

**File**: `olocus-fv/models/negotiation/downgrade.spthy`

**Focus**: Multi-layer downgrade protection

**Adversary Goals**:
- Force weak algorithm selection
- Replay old preferences
- Modify preference ordering
- Bypass minimum requirements

### Attestation Protocol Model

**File**: `olocus-fv/models/attestation/spatial.spthy`

**Properties**:
- Spatial proximity proofs
- Temporal overlap verification  
- Trust establishment
- Privacy preservation

## Implementation Verification

### hax Integration

The protocol implementation includes hax annotations for extraction to F*:

```rust
#[hax_lib::requires(self.previous.len() == 32)]
#[hax_lib::ensures(result.len() == 32)]
pub fn compute_block_hash(&self) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(&self.to_bytes());
    hasher.finalize().into()
}
```

### Functional Specifications

Critical functions have formal specifications:

```fstar
val block_verify: block -> public_key -> bool
requires
  valid_block block /\
  valid_public_key public_key
ensures fun result ->
  result = true <==> 
  signature_valid block.signature 
                  (message_of_block block) 
                  public_key
```

### Verified Properties

**Memory Safety**: Rust's type system provides memory safety guarantees that are verified through the type checker.

**Functional Correctness**: Key algorithms are verified to meet their specifications.

**No Runtime Errors**: Absence of panics, overflows, and other runtime failures.

## Verification Artifacts

### Generated Proofs

For each verified property, the system generates:

```rust
pub struct VerificationArtifact {
    pub property_id: String,           // e.g., "FV-CHAIN-01"
    pub tool: String,                  // e.g., "Tamarin 1.8.0"
    pub model_hash: [u8; 32],          // SHA-256 of model file
    pub proof_status: ProofStatus,     // Verified, Failed, Timeout
    pub proof_file: Option<String>,    // Path to proof artifact
    pub verified_at: Timestamp,
    pub verifier: String,              // Organization/individual
}

pub enum ProofStatus {
    Verified,                          // Proof completed successfully
    Failed { reason: String },         // Proof failed with reason
    Timeout { duration_ms: u64 },      // Proof timed out
    Unknown,                           // Status not determined
}
```

### Machine-Checkable Proofs

All proofs are machine-checkable and can be independently verified:

- **Tamarin**: Generates proof trees in internal format
- **F***: Produces type derivations and proof terms  
- **Coq**: Creates proof objects in Gallina
- **Lean**: Generates proof terms in dependent type theory

## Continuous Verification

### CI Integration

Verification is integrated into the continuous integration pipeline:

```yaml
# .github/workflows/verification.yml
name: Formal Verification

on: [push, pull_request]

jobs:
  tamarin:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Tamarin
        run: |
          wget https://tamarin-prover.github.io/tamarin-linux
          chmod +x tamarin-linux
      - name: Verify Protocol Models
        run: |
          ./tamarin-linux prove olocus-fv/models/**/*.spthy
```

### Automated Checking

- **Model Consistency**: Verify models match implementation
- **Property Coverage**: Ensure all critical properties are verified  
- **Proof Validity**: Check proof artifacts are current
- **Regression Detection**: Detect when changes break proofs

## Verification Limitations

### Assumptions

Formal verification relies on several assumptions:

**Cryptographic Assumptions**:
- Ed25519 signatures are unforgeable
- SHA-256 is collision-resistant  
- Random numbers are truly random
- Side-channel attacks are not considered

**Model Assumptions**:
- Perfect cryptography (symbolic models)
- Dolev-Yao adversary model
- Bounded computation (for termination)
- Abstract protocol semantics

**Implementation Assumptions**:
- Compiler correctness
- Hardware correctness
- Operating system security
- Library implementation correctness

### Scope Limitations

**Not Verified**:
- Extension implementations (outside core)
- Network protocol implementations
- Performance characteristics
- Usability properties
- Business logic correctness

**Partially Verified**:
- Extension interfaces (signatures only)
- Standard library usage
- Concurrent execution safety
- Memory usage bounds

## Using Formal Verification

### For Protocol Implementers

1. **Study Models**: Understand the formal specifications
2. **Run Verification**: Execute proofs on your implementation
3. **Maintain Annotations**: Keep hax annotations current
4. **Validate Properties**: Ensure your code meets verified properties

### For Security Auditors

1. **Review Models**: Check model accuracy against implementation
2. **Verify Claims**: Run independent verification tools
3. **Test Boundaries**: Focus on unverified components
4. **Check Assumptions**: Validate cryptographic and model assumptions

### For High-Assurance Deployments

1. **Require Verification**: Only use verified implementations
2. **Monitor Artifacts**: Track verification status
3. **Audit Regularly**: Periodic verification review
4. **Plan Updates**: Coordinate verification with updates

## Future Verification Work

### Planned Enhancements

**Extended Coverage**:
- Verify more extension properties
- Add concurrency verification
- Include performance properties
- Model resource usage

**Tool Improvements**:
- Better hax integration
- Automated model generation
- Faster proof checking
- Better error reporting

**New Properties**:
- Quantum resistance proofs
- Privacy preservation properties
- Liveness guarantees
- Fairness properties

The formal verification framework continues to evolve, providing increasingly strong guarantees about the protocol's security and correctness properties.