---
id: zero-knowledge
title: Zero Knowledge
sidebar_position: 1
---

# Zero Knowledge Proofs

The Privacy extension provides zero-knowledge proof implementations for privacy-preserving attestations and verifications without revealing sensitive information.

## Overview

Zero-knowledge proofs enable proving knowledge of information without revealing the information itself. The Olocus Protocol integrates ZKP techniques for:

- **Privacy-Preserving Attestations**: Prove location presence without revealing exact coordinates
- **Anonymous Credentials**: Verify claims without revealing identity
- **Range Proofs**: Prove values are within ranges without revealing exact values
- **Set Membership**: Prove membership in groups without revealing which group
- **Threshold Proofs**: Prove aggregate properties without revealing individual contributions

```rust
use olocus_privacy::zkp::*;
use olocus_core::measure::*;

// Create a ZK proof that you were at a location without revealing the exact coordinates
let location_proof = LocationZKProof::new()
    .location_within_radius(
        center: Coordinate::new(37.7749, -122.4194), // San Francisco
        radius: 1000.0, // 1km radius
        actual_location: private_location,
        witness: location_witness
    )
    .generate()?;

// Verify the proof without learning the actual location
let is_valid = location_proof.verify(&public_parameters)?;
```

## Zero-Knowledge Proof Primitives

### Core ZKP Types

```rust
use olocus_privacy::zkp::primitives::*;

#[derive(Debug, Clone)]
pub struct ZKProof {
    pub proof_type: ZKProofType,
    pub commitment: Commitment,
    pub challenge: Challenge,
    pub response: Response,
    pub public_parameters: PublicParameters,
    pub nullifier: Option<Nullifier>,  // Prevents double-spending/double-use
}

#[derive(Debug, Clone)]
pub enum ZKProofType {
    LocationPresence {
        region: GeographicRegion,
        time_window: TimeWindow,
    },
    RangeProof {
        range: (i64, i64),           // (min, max) values
        bit_length: usize,           // Bit length of the value
    },
    SetMembership {
        set_size: usize,
        merkle_depth: usize,
    },
    ThresholdProof {
        threshold: u64,
        participant_count: usize,
    },
    AnonymousCredential {
        credential_schema: CredentialSchema,
        revealed_attributes: Vec<AttributeIndex>,
    },
}

#[derive(Debug, Clone)]
pub struct Commitment {
    pub value: Vec<u8>,              // Pedersen or other commitment
    pub randomness_commitment: Vec<u8>, // Commitment to randomness
}

#[derive(Debug, Clone)]
pub struct Challenge {
    pub value: Vec<u8>,              // Fiat-Shamir challenge
    pub transcript_hash: Vec<u8>,    // Hash of all previous messages
}

#[derive(Debug, Clone)]  
pub struct Response {
    pub value_response: Vec<u8>,     // Response for committed value
    pub randomness_response: Vec<u8>, // Response for randomness
}
```

### Sigma Protocols

```rust
use olocus_privacy::zkp::sigma::*;

pub trait SigmaProtocol {
    type Statement;
    type Witness;
    type Commitment;
    type Challenge;
    type Response;
    
    fn commit(&self, witness: &Self::Witness) -> (Self::Commitment, CommitmentSecret);
    fn challenge(&self, statement: &Self::Statement, commitment: &Self::Commitment) -> Self::Challenge;
    fn respond(&self, challenge: &Self::Challenge, witness: &Self::Witness, secret: &CommitmentSecret) -> Self::Response;
    fn verify(&self, statement: &Self::Statement, commitment: &Self::Commitment, challenge: &Self::Challenge, response: &Self::Response) -> bool;
}

// Schnorr proof of knowledge of discrete log
pub struct SchnorrProof {
    base: GroupElement,
    generator: GroupElement,
}

impl SigmaProtocol for SchnorrProof {
    type Statement = GroupElement;  // y = g^x
    type Witness = Scalar;          // x
    type Commitment = GroupElement; // r = g^v
    type Challenge = Scalar;        // c
    type Response = Scalar;         // z = v + cx
    
    fn commit(&self, witness: &Self::Witness) -> (Self::Commitment, CommitmentSecret) {
        let v = Scalar::random();
        let r = self.generator * v;
        (r, CommitmentSecret::Scalar(v))
    }
    
    fn challenge(&self, statement: &Self::Statement, commitment: &Self::Commitment) -> Self::Challenge {
        // Fiat-Shamir transform
        let mut hasher = Sha256::new();
        hasher.update(&self.generator.to_bytes());
        hasher.update(&statement.to_bytes());
        hasher.update(&commitment.to_bytes());
        
        Scalar::from_hash(hasher.finalize().as_slice())
    }
    
    fn respond(&self, challenge: &Self::Challenge, witness: &Self::Witness, secret: &CommitmentSecret) -> Self::Response {
        let v = match secret {
            CommitmentSecret::Scalar(v) => v,
            _ => panic!("Invalid commitment secret type"),
        };
        
        // z = v + cx
        v + (challenge * witness)
    }
    
    fn verify(&self, statement: &Self::Statement, commitment: &Self::Commitment, challenge: &Self::Challenge, response: &Self::Response) -> bool {
        // Check that g^z = r * y^c
        let left = self.generator * response;
        let right = commitment + (statement * challenge);
        left == right
    }
}
```

## Location Privacy Proofs

### Geographic Region Proofs

```rust
use olocus_privacy::zkp::location::*;

pub struct LocationZKProof {
    proof_system: ProofSystem,
    public_parameters: LocationPublicParameters,
}

#[derive(Debug, Clone)]
pub struct LocationPublicParameters {
    pub region_commitment_key: CommitmentKey,
    pub coordinate_range: CoordinateRange,
    pub precision_bits: usize,          // Fixed-point precision
    pub proof_security_level: usize,    // Security parameter
}

#[derive(Debug, Clone)]
pub enum GeographicRegion {
    Circle {
        center: Coordinate,
        radius: f64,                    // meters
    },
    Rectangle {
        northwest: Coordinate,
        southeast: Coordinate,
    },
    Polygon {
        vertices: Vec<Coordinate>,
    },
    PostalCode {
        code: String,
        precision: PostalCodePrecision, // ZIP, ZIP+4, etc.
    },
}

impl LocationZKProof {
    pub fn prove_presence_in_region(
        &self,
        actual_location: &Coordinate,
        region: &GeographicRegion,
        time_window: &TimeWindow,
        witness: &LocationWitness
    ) -> Result<ZKProof> {
        match region {
            GeographicRegion::Circle { center, radius } => {
                self.prove_within_circle(actual_location, center, *radius, witness)
            },
            GeographicRegion::Rectangle { northwest, southeast } => {
                self.prove_within_rectangle(actual_location, northwest, southeast, witness)
            },
            GeographicRegion::Polygon { vertices } => {
                self.prove_within_polygon(actual_location, vertices, witness)
            },
            GeographicRegion::PostalCode { code, precision } => {
                self.prove_within_postal_code(actual_location, code, *precision, witness)
            }
        }
    }
    
    fn prove_within_circle(
        &self,
        location: &Coordinate,
        center: &Coordinate,
        radius: f64,
        witness: &LocationWitness
    ) -> Result<ZKProof> {
        // Convert to fixed-point coordinates
        let loc_x = location.latitude;
        let loc_y = location.longitude;
        let center_x = center.latitude;
        let center_y = center.longitude;
        
        // Calculate distance squared in fixed-point arithmetic
        let dx = loc_x - center_x;
        let dy = loc_y - center_y;
        let distance_sq = dx * dx + dy * dy;
        
        // Convert radius to fixed-point distance squared
        let radius_fixed = (radius * 10_000_000.0) as i64; // Convert to fixed-point meters
        let radius_sq = radius_fixed * radius_fixed;
        
        // Prove that distance_sq <= radius_sq using range proof
        let range_proof = RangeProof::new(
            distance_sq as u64,
            0,
            radius_sq as u64,
            64, // bit length
            witness
        )?;
        
        Ok(ZKProof {
            proof_type: ZKProofType::LocationPresence {
                region: GeographicRegion::Circle {
                    center: center.clone(),
                    radius,
                },
                time_window: witness.time_window.clone(),
            },
            commitment: range_proof.commitment,
            challenge: range_proof.challenge,
            response: range_proof.response,
            public_parameters: self.public_parameters.clone().into(),
            nullifier: Some(witness.generate_nullifier()?),
        })
    }
    
    fn prove_within_polygon(
        &self,
        location: &Coordinate,
        vertices: &[Coordinate],
        witness: &LocationWitness
    ) -> Result<ZKProof> {
        // Use point-in-polygon algorithm with ZK constraints
        // Ray casting algorithm adapted for zero-knowledge proofs
        
        let point = (location.latitude, location.longitude);
        let mut inside_constraints = Vec::new();
        
        for i in 0..vertices.len() {
            let j = (i + 1) % vertices.len();
            let vi = (vertices[i].latitude, vertices[i].longitude);
            let vj = (vertices[j].latitude, vertices[j].longitude);
            
            // Create constraint for ray intersection
            let intersection_constraint = self.create_ray_intersection_constraint(
                &point, &vi, &vj
            )?;
            
            inside_constraints.push(intersection_constraint);
        }
        
        // Prove that odd number of intersections (point inside polygon)
        let parity_proof = ParityProof::new(&inside_constraints, witness)?;
        
        Ok(ZKProof {
            proof_type: ZKProofType::LocationPresence {
                region: GeographicRegion::Polygon {
                    vertices: vertices.to_vec(),
                },
                time_window: witness.time_window.clone(),
            },
            commitment: parity_proof.commitment,
            challenge: parity_proof.challenge,
            response: parity_proof.response,
            public_parameters: self.public_parameters.clone().into(),
            nullifier: Some(witness.generate_nullifier()?),
        })
    }
}
```

### Temporal Privacy Proofs

```rust
use olocus_privacy::zkp::temporal::*;

pub struct TemporalZKProof {
    proof_system: ProofSystem,
}

#[derive(Debug, Clone)]
pub struct TimeWindow {
    pub start: SystemTime,
    pub end: SystemTime,
    pub granularity: TemporalGranularity,
}

#[derive(Debug, Clone)]
pub enum TemporalGranularity {
    Second,
    Minute,
    Hour,
    Day,
    Week,
    Month,
}

impl TemporalZKProof {
    pub fn prove_time_within_window(
        &self,
        actual_time: SystemTime,
        window: &TimeWindow,
        witness: &TemporalWitness
    ) -> Result<ZKProof> {
        // Convert times to appropriate granularity
        let start_ts = self.time_to_granular_timestamp(window.start, window.granularity);
        let end_ts = self.time_to_granular_timestamp(window.end, window.granularity);
        let actual_ts = self.time_to_granular_timestamp(actual_time, window.granularity);
        
        // Prove start_ts <= actual_ts <= end_ts using range proof
        let range_proof = RangeProof::prove_in_range(
            actual_ts,
            start_ts,
            end_ts,
            64, // timestamp bit length
            witness
        )?;
        
        Ok(ZKProof {
            proof_type: ZKProofType::LocationPresence {
                region: GeographicRegion::Circle {
                    center: witness.dummy_location, // Hidden actual region
                    radius: 0.0,
                },
                time_window: window.clone(),
            },
            commitment: range_proof.commitment,
            challenge: range_proof.challenge,
            response: range_proof.response,
            public_parameters: self.temporal_params.clone().into(),
            nullifier: Some(witness.generate_temporal_nullifier()?),
        })
    }
    
    fn time_to_granular_timestamp(&self, time: SystemTime, granularity: TemporalGranularity) -> u64 {
        let duration = time.duration_since(SystemTime::UNIX_EPOCH).unwrap_or_default();
        let seconds = duration.as_secs();
        
        match granularity {
            TemporalGranularity::Second => seconds,
            TemporalGranularity::Minute => seconds / 60,
            TemporalGranularity::Hour => seconds / 3600,
            TemporalGranularity::Day => seconds / 86400,
            TemporalGranularity::Week => seconds / 604800,
            TemporalGranularity::Month => seconds / 2629746, // Average month
        }
    }
}
```

## Range Proofs

### Bulletproofs Implementation

```rust
use olocus_privacy::zkp::bulletproofs::*;

pub struct BulletproofRangeProof {
    generators: BulletproofGenerators,
    pc_gens: PedersenGens,
}

impl BulletproofRangeProof {
    pub fn prove_value_in_range(
        &self,
        value: u64,
        min: u64,
        max: u64,
        bit_length: usize,
        blinding: Scalar
    ) -> Result<(Commitment, RangeProof)> {
        // Adjust value to be relative to minimum
        let adjusted_value = value - min;
        let range_size = max - min + 1;
        
        // Ensure the range fits in the specified bit length
        if range_size > (1 << bit_length) {
            return Err(ZKError::RangeTooLarge {
                range_size,
                max_size: 1 << bit_length,
            });
        }
        
        // Create Pedersen commitment: C = value * G + blinding * H
        let commitment = self.pc_gens.commit(Scalar::from(adjusted_value), blinding);
        
        // Generate bulletproof
        let mut transcript = Transcript::new(b"olocus-range-proof");
        
        let (proof, _) = RangeProof::prove_single(
            &self.generators,
            &mut transcript,
            adjusted_value,
            &blinding,
            bit_length,
        ).map_err(|e| ZKError::ProofGenerationFailed(e.to_string()))?;
        
        Ok((commitment, proof))
    }
    
    pub fn verify_range_proof(
        &self,
        commitment: &Commitment,
        proof: &RangeProof,
        min: u64,
        max: u64,
        bit_length: usize
    ) -> Result<bool> {
        let range_size = max - min + 1;
        
        if range_size > (1 << bit_length) {
            return Ok(false);
        }
        
        let mut transcript = Transcript::new(b"olocus-range-proof");
        
        proof.verify_single(
            &self.generators,
            &mut transcript,
            commitment,
            bit_length,
        ).map_err(|e| ZKError::VerificationFailed(e.to_string()))?;
        
        Ok(true)
    }
    
    // Batch range proofs for efficiency
    pub fn prove_multiple_ranges(
        &self,
        values: &[u64],
        ranges: &[(u64, u64)], // (min, max) pairs
        bit_length: usize,
        blindings: &[Scalar]
    ) -> Result<(Vec<Commitment>, RangeProof)> {
        if values.len() != ranges.len() || values.len() != blindings.len() {
            return Err(ZKError::InvalidInputLengths);
        }
        
        let mut adjusted_values = Vec::new();
        let mut commitments = Vec::new();
        
        for (i, &value) in values.iter().enumerate() {
            let (min, max) = ranges[i];
            let adjusted_value = value - min;
            adjusted_values.push(adjusted_value);
            
            let commitment = self.pc_gens.commit(Scalar::from(adjusted_value), blindings[i]);
            commitments.push(commitment);
        }
        
        let mut transcript = Transcript::new(b"olocus-batch-range-proof");
        
        let (proof, _) = RangeProof::prove_multiple(
            &self.generators,
            &mut transcript,
            &adjusted_values,
            blindings,
            bit_length,
        ).map_err(|e| ZKError::ProofGenerationFailed(e.to_string()))?;
        
        Ok((commitments, proof))
    }
}
```

### Set Membership Proofs

```rust
use olocus_privacy::zkp::set_membership::*;

pub struct SetMembershipProof {
    merkle_depth: usize,
    hasher: PoseidonHasher, // ZK-friendly hash function
}

impl SetMembershipProof {
    pub fn prove_membership(
        &self,
        element: &[u8],
        set_merkle_root: &[u8],
        merkle_path: &MerklePath,
        witness: &SetWitness
    ) -> Result<ZKProof> {
        // Hash the element
        let element_hash = self.hasher.hash(element);
        
        // Prove that we can reconstruct the merkle root from element and path
        let mut current_hash = element_hash;
        let mut path_constraints = Vec::new();
        
        for (i, sibling) in merkle_path.siblings.iter().enumerate() {
            let is_right = merkle_path.directions[i];
            
            // Create constraint: if is_right then hash(sibling, current) else hash(current, sibling)
            let constraint = MerkleConstraint {
                left: if is_right { sibling.clone() } else { current_hash.clone() },
                right: if is_right { current_hash.clone() } else { sibling.clone() },
                output: self.hasher.hash(&[&current_hash, sibling].concat()),
                direction_bit: is_right,
            };
            
            path_constraints.push(constraint);
            current_hash = constraint.output.clone();
        }
        
        // Final constraint: current_hash == merkle_root
        if current_hash != *set_merkle_root {
            return Err(ZKError::InvalidMembershipProof);
        }
        
        // Generate ZK proof for all constraints
        let circuit = MembershipCircuit::new(path_constraints, witness);
        let proof = circuit.generate_proof()?;
        
        Ok(ZKProof {
            proof_type: ZKProofType::SetMembership {
                set_size: 1 << self.merkle_depth,
                merkle_depth: self.merkle_depth,
            },
            commitment: proof.commitment,
            challenge: proof.challenge,
            response: proof.response,
            public_parameters: PublicParameters::SetMembership {
                merkle_root: set_merkle_root.to_vec(),
                set_size: 1 << self.merkle_depth,
            },
            nullifier: Some(witness.generate_nullifier(element)?),
        })
    }
    
    pub fn prove_non_membership(
        &self,
        element: &[u8],
        set_merkle_root: &[u8],
        non_membership_witness: &NonMembershipWitness
    ) -> Result<ZKProof> {
        // For non-membership, prove that all paths in the tree don't lead to the element
        // This is more complex and typically done using accumulated hash sets
        
        let element_hash = self.hasher.hash(element);
        let accumulated_hash = non_membership_witness.accumulated_hash.clone();
        
        // Prove that element_hash is not in the accumulator
        let non_inclusion_proof = AccumulatorNonInclusionProof::new(
            element_hash,
            accumulated_hash,
            non_membership_witness
        )?;
        
        Ok(ZKProof {
            proof_type: ZKProofType::SetMembership {
                set_size: 1 << self.merkle_depth,
                merkle_depth: self.merkle_depth,
            },
            commitment: non_inclusion_proof.commitment,
            challenge: non_inclusion_proof.challenge,
            response: non_inclusion_proof.response,
            public_parameters: PublicParameters::SetNonMembership {
                accumulated_hash,
                set_size: 1 << self.merkle_depth,
            },
            nullifier: None, // No nullifier for non-membership
        })
    }
}

#[derive(Debug, Clone)]
pub struct MerklePath {
    pub siblings: Vec<Vec<u8>>,
    pub directions: Vec<bool>,    // true = right, false = left
}

#[derive(Debug, Clone)]
pub struct MerkleConstraint {
    pub left: Vec<u8>,
    pub right: Vec<u8>,
    pub output: Vec<u8>,
    pub direction_bit: bool,
}
```

## Anonymous Credentials

### BBS+ Signatures

```rust
use olocus_privacy::zkp::bbs_plus::*;

pub struct BBSPlusCredentialSystem {
    public_key: BBSPublicKey,
    secret_key: Option<BBSSecretKey>, // Only issuer has this
    generators: Vec<GroupElement>,
}

#[derive(Debug, Clone)]
pub struct AnonymousCredential {
    pub signature: BBSSignature,
    pub attributes: Vec<CredentialAttribute>,
    pub issuer_public_key: BBSPublicKey,
    pub schema: CredentialSchema,
}

#[derive(Debug, Clone)]
pub struct CredentialAttribute {
    pub name: String,
    pub value: AttributeValue,
    pub revealed: bool,              // Whether to reveal in proof
}

#[derive(Debug, Clone)]
pub enum AttributeValue {
    String(String),
    Integer(i64),
    Boolean(bool),
    Timestamp(SystemTime),
    Location(Coordinate),
    Hash(Vec<u8>),
}

impl BBSPlusCredentialSystem {
    pub fn issue_credential(
        &self,
        attributes: &[CredentialAttribute],
        secret_key: &BBSSecretKey
    ) -> Result<AnonymousCredential> {
        // Convert attributes to field elements
        let attribute_messages: Result<Vec<FieldElement>, _> = attributes.iter()
            .map(|attr| self.attribute_to_field_element(&attr.value))
            .collect();
        
        let messages = attribute_messages?;
        
        // Generate BBS+ signature
        let signature = self.sign_messages(&messages, secret_key)?;
        
        Ok(AnonymousCredential {
            signature,
            attributes: attributes.to_vec(),
            issuer_public_key: self.public_key.clone(),
            schema: CredentialSchema::from_attributes(attributes),
        })
    }
    
    pub fn create_selective_disclosure_proof(
        &self,
        credential: &AnonymousCredential,
        revealed_indices: &[usize],
        proof_request: &ProofRequest
    ) -> Result<SelectiveDisclosureProof> {
        
        // Split attributes into revealed and hidden
        let mut revealed_messages = Vec::new();
        let mut hidden_messages = Vec::new();
        let mut revealed_indices_set = revealed_indices.iter().collect::<std::collections::HashSet<_>>();
        
        for (i, attr) in credential.attributes.iter().enumerate() {
            let message = self.attribute_to_field_element(&attr.value)?;
            
            if revealed_indices_set.contains(&i) {
                revealed_messages.push((i, message));
            } else {
                hidden_messages.push((i, message));
            }
        }
        
        // Create proof of knowledge for hidden attributes
        let pok = self.create_proof_of_knowledge(
            &credential.signature,
            &revealed_messages,
            &hidden_messages,
            proof_request
        )?;
        
        Ok(SelectiveDisclosureProof {
            revealed_attributes: revealed_messages.into_iter()
                .map(|(i, _)| (i, credential.attributes[i].clone()))
                .collect(),
            proof_of_knowledge: pok,
            issuer_public_key: credential.issuer_public_key.clone(),
            schema: credential.schema.clone(),
        })
    }
    
    fn create_proof_of_knowledge(
        &self,
        signature: &BBSSignature,
        revealed: &[(usize, FieldElement)],
        hidden: &[(usize, FieldElement)],
        proof_request: &ProofRequest
    ) -> Result<ProofOfKnowledge> {
        // Randomize the signature to prevent linking
        let (randomized_signature, randomness) = self.randomize_signature(signature)?;
        
        // Create Schnorr proof for each hidden attribute
        let mut attribute_proofs = Vec::new();
        
        for (index, message) in hidden {
            // Check if this attribute has any constraints in the proof request
            if let Some(constraints) = proof_request.constraints.get(index) {
                for constraint in constraints {
                    match constraint {
                        AttributeConstraint::Range { min, max } => {
                            // Create range proof for this attribute
                            if let AttributeValue::Integer(value) = &credential.attributes[*index].value {
                                let range_proof = self.create_attribute_range_proof(
                                    *value,
                                    *min,
                                    *max,
                                    message,
                                    &randomness
                                )?;
                                attribute_proofs.push(AttributeProof::Range(range_proof));
                            }
                        },
                        AttributeConstraint::SetMembership { allowed_values } => {
                            let membership_proof = self.create_attribute_membership_proof(
                                message,
                                allowed_values,
                                &randomness
                            )?;
                            attribute_proofs.push(AttributeProof::SetMembership(membership_proof));
                        },
                        AttributeConstraint::Predicate { predicate } => {
                            let predicate_proof = self.create_predicate_proof(
                                message,
                                predicate,
                                &randomness
                            )?;
                            attribute_proofs.push(AttributeProof::Predicate(predicate_proof));
                        }
                    }
                }
            }
        }
        
        Ok(ProofOfKnowledge {
            randomized_signature,
            attribute_proofs,
            challenge: self.compute_fiat_shamir_challenge(
                &randomized_signature,
                &attribute_proofs,
                revealed
            )?,
        })
    }
    
    fn attribute_to_field_element(&self, value: &AttributeValue) -> Result<FieldElement> {
        match value {
            AttributeValue::String(s) => {
                let hash = sha256::digest(s.as_bytes());
                Ok(FieldElement::from_bytes(&hash)?)
            },
            AttributeValue::Integer(i) => {
                Ok(FieldElement::from(*i as u64))
            },
            AttributeValue::Boolean(b) => {
                Ok(FieldElement::from(*b as u64))
            },
            AttributeValue::Timestamp(ts) => {
                let secs = ts.duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                Ok(FieldElement::from(secs))
            },
            AttributeValue::Location(coord) => {
                // Combine latitude and longitude into single field element
                let lat_bytes = coord.latitude.to_be_bytes();
                let lon_bytes = coord.longitude.to_be_bytes();
                let combined = [lat_bytes, lon_bytes].concat();
                let hash = sha256::digest(&combined);
                Ok(FieldElement::from_bytes(&hash)?)
            },
            AttributeValue::Hash(h) => {
                Ok(FieldElement::from_bytes(h)?)
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct SelectiveDisclosureProof {
    pub revealed_attributes: Vec<(usize, CredentialAttribute)>,
    pub proof_of_knowledge: ProofOfKnowledge,
    pub issuer_public_key: BBSPublicKey,
    pub schema: CredentialSchema,
}

#[derive(Debug, Clone)]
pub struct ProofRequest {
    pub constraints: HashMap<usize, Vec<AttributeConstraint>>,
    pub nonce: Vec<u8>,
    pub context: ProofContext,
}

#[derive(Debug, Clone)]
pub enum AttributeConstraint {
    Range { min: i64, max: i64 },
    SetMembership { allowed_values: Vec<AttributeValue> },
    Predicate { predicate: String }, // Custom predicate in domain-specific language
}
```

## Nullifiers and Anti-Replay

### Nullifier Generation

```rust
use olocus_privacy::zkp::nullifiers::*;

pub struct NullifierSystem {
    nullifier_key: PrivateKey,      // Long-term nullifier key
    used_nullifiers: HashSet<Nullifier>,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct Nullifier {
    pub value: [u8; 32],
    pub context: NullifierContext,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub enum NullifierContext {
    LocationProof { region_id: String, time_bucket: u64 },
    CredentialProof { schema_id: String, proof_session: String },
    AnonymousVote { election_id: String },
    AnonymousLogin { service_id: String, time_bucket: u64 },
}

impl NullifierSystem {
    pub fn generate_nullifier(
        &self,
        context: &NullifierContext,
        secret: &[u8]
    ) -> Result<Nullifier> {
        // PRF: nullifier = HMAC(nullifier_key, context || secret)
        let mut mac = HmacSha256::new_from_slice(&self.nullifier_key.as_bytes())
            .map_err(|_| ZKError::InvalidKey)?;
        
        // Add context to the MAC
        match context {
            NullifierContext::LocationProof { region_id, time_bucket } => {
                mac.update(b"location_proof");
                mac.update(region_id.as_bytes());
                mac.update(&time_bucket.to_be_bytes());
            },
            NullifierContext::CredentialProof { schema_id, proof_session } => {
                mac.update(b"credential_proof");
                mac.update(schema_id.as_bytes());
                mac.update(proof_session.as_bytes());
            },
            NullifierContext::AnonymousVote { election_id } => {
                mac.update(b"anonymous_vote");
                mac.update(election_id.as_bytes());
            },
            NullifierContext::AnonymousLogin { service_id, time_bucket } => {
                mac.update(b"anonymous_login");
                mac.update(service_id.as_bytes());
                mac.update(&time_bucket.to_be_bytes());
            },
        }
        
        // Add secret
        mac.update(secret);
        
        let result = mac.finalize().into_bytes();
        let mut nullifier_bytes = [0u8; 32];
        nullifier_bytes.copy_from_slice(&result);
        
        Ok(Nullifier {
            value: nullifier_bytes,
            context: context.clone(),
        })
    }
    
    pub fn check_and_record_nullifier(&mut self, nullifier: &Nullifier) -> Result<bool> {
        if self.used_nullifiers.contains(nullifier) {
            return Ok(false); // Already used (replay attack)
        }
        
        self.used_nullifiers.insert(nullifier.clone());
        Ok(true) // Fresh nullifier
    }
    
    pub fn cleanup_expired_nullifiers(&mut self, retention_period: Duration) {
        // Remove old nullifiers based on context-specific expiry
        let current_time = SystemTime::now();
        let cutoff = current_time - retention_period;
        
        self.used_nullifiers.retain(|nullifier| {
            match &nullifier.context {
                NullifierContext::LocationProof { time_bucket, .. } |
                NullifierContext::AnonymousLogin { time_bucket, .. } => {
                    // Convert time bucket back to SystemTime
                    let bucket_time = SystemTime::UNIX_EPOCH + Duration::from_secs(*time_bucket);
                    bucket_time > cutoff
                },
                _ => true, // Keep other nullifiers
            }
        });
    }
}
```

## Integration Examples

### Privacy-Preserving Location Attestation

```rust
use olocus_privacy::zkp::*;
use olocus_trust::*;
use olocus_location::*;

async fn create_private_location_attestation(
    actual_location: Coordinate,
    public_region: GeographicRegion,
    trust_network: &TrustNetwork,
    zkp_system: &LocationZKProof
) -> Result<PrivateAttestation> {
    
    // 1. Generate zero-knowledge proof of presence in region
    let location_witness = LocationWitness {
        actual_location,
        timestamp: SystemTime::now(),
        randomness: Scalar::random(),
        time_window: TimeWindow {
            start: SystemTime::now() - Duration::from_mins(5),
            end: SystemTime::now() + Duration::from_mins(5),
            granularity: TemporalGranularity::Minute,
        },
    };
    
    let zk_proof = zkp_system.prove_presence_in_region(
        &actual_location,
        &public_region,
        &location_witness.time_window,
        &location_witness
    )?;
    
    // 2. Get trust network attestation without revealing exact location
    let attestation_claim = AttestationType::Presence {
        location: public_region.center(), // Only reveal region center
        radius: public_region.radius(),   // And radius
        timestamp: SystemTime::now(),
        duration: Some(Duration::from_mins(10)),
    };
    
    let witnesses = trust_network.find_nearby_witnesses(&public_region, 3).await?;
    let trust_attestation = trust_network.create_attestation(
        trust_network.local_did(),
        attestation_claim,
        witnesses
    ).await?;
    
    // 3. Combine ZK proof with trust attestation
    Ok(PrivateAttestation {
        zk_proof,
        trust_attestation,
        nullifier: location_witness.generate_nullifier()?,
        public_region,
        confidence_level: 0.95,
    })
}

#[derive(Debug, Clone)]
pub struct PrivateAttestation {
    pub zk_proof: ZKProof,
    pub trust_attestation: Attestation,
    pub nullifier: Nullifier,
    pub public_region: GeographicRegion,
    pub confidence_level: f64,
}

impl PrivateAttestation {
    pub fn verify(&self, zkp_system: &LocationZKProof, trust_network: &TrustNetwork) -> Result<bool> {
        // Verify ZK proof
        let zk_valid = zkp_system.verify_proof(&self.zk_proof)?;
        if !zk_valid {
            return Ok(false);
        }
        
        // Verify trust attestation
        let trust_valid = trust_network.verify_attestation(&self.trust_attestation)?;
        if !trust_valid {
            return Ok(false);
        }
        
        // Check nullifier hasn't been used
        let nullifier_valid = zkp_system.check_nullifier(&self.nullifier)?;
        
        Ok(zk_valid && trust_valid && nullifier_valid)
    }
}
```

### Anonymous Credential Presentation

```rust
async fn present_anonymous_credential(
    credential: &AnonymousCredential,
    proof_request: &ProofRequest,
    bbs_system: &BBSPlusCredentialSystem
) -> Result<CredentialPresentation> {
    
    // Determine which attributes to reveal
    let mut revealed_indices = Vec::new();
    let mut hidden_constraints = HashMap::new();
    
    for (attr_index, constraints) in &proof_request.constraints {
        let mut should_reveal = false;
        
        for constraint in constraints {
            match constraint {
                AttributeConstraint::Range { .. } => {
                    // Can prove range without revealing exact value
                    hidden_constraints.entry(*attr_index).or_insert_with(Vec::new).push(constraint.clone());
                },
                AttributeConstraint::SetMembership { .. } => {
                    // May need to reveal for set membership depending on implementation
                    should_reveal = true;
                },
                AttributeConstraint::Predicate { predicate } => {
                    // Depends on the predicate
                    if predicate.contains("reveal") {
                        should_reveal = true;
                    } else {
                        hidden_constraints.entry(*attr_index).or_insert_with(Vec::new).push(constraint.clone());
                    }
                }
            }
        }
        
        if should_reveal {
            revealed_indices.push(*attr_index);
        }
    }
    
    // Create selective disclosure proof
    let disclosure_proof = bbs_system.create_selective_disclosure_proof(
        credential,
        &revealed_indices,
        proof_request
    )?;
    
    // Generate nullifier to prevent multiple presentations
    let nullifier_context = NullifierContext::CredentialProof {
        schema_id: credential.schema.id.clone(),
        proof_session: proof_request.context.session_id.clone(),
    };
    
    let nullifier = bbs_system.nullifier_system.generate_nullifier(
        &nullifier_context,
        &credential.signature.as_bytes()
    )?;
    
    Ok(CredentialPresentation {
        disclosure_proof,
        nullifier,
        context: proof_request.context.clone(),
        timestamp: SystemTime::now(),
    })
}

#[derive(Debug, Clone)]
pub struct CredentialPresentation {
    pub disclosure_proof: SelectiveDisclosureProof,
    pub nullifier: Nullifier,
    pub context: ProofContext,
    pub timestamp: SystemTime,
}
```

## Performance & Security Considerations

### Performance Metrics

```rust
// Typical performance characteristics
pub struct ZKPPerformanceMetrics {
    pub proof_generation_time: Duration,    // ~500ms for location proofs
    pub verification_time: Duration,        // ~50ms for most proofs
    pub proof_size: usize,                  // ~2KB for range proofs
    pub memory_usage: usize,                // ~100MB during generation
}

// Benchmark different proof types
#[cfg(test)]
mod zkp_benchmarks {
    use super::*;
    use criterion::{black_box, Criterion};
    
    #[bench]
    fn bench_location_proof_generation(c: &mut Criterion) {
        let zkp_system = LocationZKProof::new();
        let location = Coordinate::new(37.7749, -122.4194);
        let region = GeographicRegion::Circle {
            center: Coordinate::new(37.7749, -122.4194),
            radius: 1000.0,
        };
        
        c.bench_function("location_proof_generation", |b| {
            b.iter(|| {
                let witness = LocationWitness::new();
                zkp_system.prove_presence_in_region(
                    black_box(&location),
                    black_box(&region),
                    black_box(&witness.time_window),
                    black_box(&witness)
                )
            });
        });
    }
    
    #[bench]
    fn bench_range_proof_generation(c: &mut Criterion) {
        let bulletproof_system = BulletproofRangeProof::new();
        
        c.bench_function("range_proof_generation", |b| {
            b.iter(|| {
                bulletproof_system.prove_value_in_range(
                    black_box(42),
                    black_box(0),
                    black_box(100),
                    black_box(8),
                    black_box(Scalar::random())
                )
            });
        });
    }
}
```

### Security Properties

```rust
pub struct ZKPSecurityProperties {
    // Completeness: Honest provers can always convince honest verifiers
    pub completeness: bool,          // true
    
    // Soundness: Dishonest provers cannot convince honest verifiers
    pub soundness_error: f64,        // 2^-128 (negligible)
    
    // Zero-knowledge: Verifiers learn nothing beyond statement validity
    pub zero_knowledge: bool,        // true (statistical/perfect ZK)
    
    // Additional properties
    pub honest_verifier_zk: bool,    // true (for Fiat-Shamir proofs)
    pub non_interactive: bool,       // true (using random oracle model)
    pub composable: bool,            // true (proofs can be combined)
}

// Security analysis
impl ZKPSecurityProperties {
    pub fn analyze_security_level(&self, proof: &ZKProof) -> SecurityLevel {
        match proof.proof_type {
            ZKProofType::LocationPresence { .. } => {
                // Location privacy depends on region size and temporal granularity
                SecurityLevel::High // 128-bit equivalent
            },
            ZKProofType::RangeProof { bit_length, .. } => {
                // Range proof security scales with bit length
                if bit_length >= 64 {
                    SecurityLevel::High
                } else if bit_length >= 32 {
                    SecurityLevel::Medium
                } else {
                    SecurityLevel::Low
                }
            },
            ZKProofType::SetMembership { set_size, .. } => {
                // Anonymity set size determines privacy level
                if set_size >= 1024 {
                    SecurityLevel::High
                } else if set_size >= 256 {
                    SecurityLevel::Medium
                } else {
                    SecurityLevel::Low
                }
            },
            _ => SecurityLevel::Medium,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum SecurityLevel {
    Low,     // < 80 bits of security
    Medium,  // 80-112 bits of security  
    High,    // >= 128 bits of security
}
```

## Related Documentation

- [Privacy Techniques](./techniques.md) - Differential privacy and k-anonymity
- [Anonymous Credentials](../credentials/anonymous.md) - W3C VC with ZK proofs
- [Trust Networks](../security/trust-networks.md) - ZK-enhanced attestations
- [Formal Verification](/architecture/formal-verification.md) - ZK protocol verification
