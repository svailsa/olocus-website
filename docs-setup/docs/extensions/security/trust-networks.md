---
id: trust-networks
title: Trust Networks
sidebar_position: 1
---

# Trust Networks

The Trust extension (v2.0) provides comprehensive trust establishment, peer connections, and reputation management for decentralized networks. It unifies trust protocols, attestations, and peer relationship management.

## Overview

The unified trust extension combines multiple trust mechanisms:

- **DIDs**: Decentralized identifiers for peer identity
- **Trust Credentials**: Verifiable trust assertions  
- **Reputation Algorithms**: PageRank, EigenTrust, Bayesian inference
- **Attestations**: Spatial-temporal proofs and claims
- **Peer Connections**: Network relationship management

```rust
use olocus_trust::*;
use olocus_core::measure::*;

// Create trust network
let trust_config = TrustNetworkConfig {
    reputation_algorithm: ReputationAlgorithm::EigenTrust {
        alpha: 0.5,           // Pre-trust weight
        epsilon: 0.01,        // Convergence threshold
        max_iterations: 100,
    },
    attestation_config: AttestationConfig {
        spatial_radius: 100.0,     // 100m spatial verification
        temporal_window: Duration::from_secs(300), // 5 min temporal window
        required_witnesses: 3,      // Minimum witnesses
    },
    connection_config: ConnectionConfig {
        max_connections: 150,       // Dunbar's number
        trust_threshold: 0.7,       // Minimum trust for connection
        attestation_required: true,
    },
};

let trust_network = TrustNetwork::new(trust_config);
```

## Decentralized Identifiers (DIDs)

DIDs provide cryptographically verifiable, self-sovereign identities:

### DID Structure

```rust
use olocus_trust::identity::*;

#[derive(Debug, Clone, PartialEq)]
pub struct Did {
    pub method: String,           // "olocus"
    pub method_specific_id: String, // Base58-encoded public key
}

impl Did {
    pub fn new(public_key: &PublicKey) -> Self {
        let encoded_key = bs58::encode(&public_key.as_bytes()).into_string();
        Self {
            method: "olocus".to_string(),
            method_specific_id: encoded_key,
        }
    }
    
    pub fn to_string(&self) -> String {
        format!("did:{}:{}", self.method, self.method_specific_id)
    }
    
    pub fn from_string(did_string: &str) -> Result<Self, DidError> {
        let parts: Vec<&str> = did_string.split(':').collect();
        if parts.len() != 3 || parts[0] != "did" {
            return Err(DidError::InvalidFormat);
        }
        
        Ok(Self {
            method: parts[1].to_string(),
            method_specific_id: parts[2].to_string(),
        })
    }
    
    pub fn resolve(&self) -> Result<DidDocument, DidError> {
        // Resolve DID to DID Document
        let public_key_bytes = bs58::decode(&self.method_specific_id)
            .into_vec()
            .map_err(|_| DidError::InvalidEncoding)?;
            
        let public_key = PublicKey::from_bytes(&public_key_bytes)?;
        
        Ok(DidDocument {
            did: self.clone(),
            public_keys: vec![DidPublicKey {
                id: format!("{}#key-1", self.to_string()),
                key_type: KeyType::Ed25519VerificationKey2020,
                public_key,
            }],
            authentication: vec![format!("{}#key-1", self.to_string())],
            created: SystemTime::now(),
            updated: SystemTime::now(),
        })
    }
}
```

### DID Document Management

```rust
#[derive(Debug, Clone)]
pub struct DidDocument {
    pub did: Did,
    pub public_keys: Vec<DidPublicKey>,
    pub authentication: Vec<String>,     // Key IDs for authentication
    pub service_endpoints: Vec<ServiceEndpoint>,
    pub created: SystemTime,
    pub updated: SystemTime,
}

#[derive(Debug, Clone)]
pub struct DidPublicKey {
    pub id: String,                      // Key identifier
    pub key_type: KeyType,
    pub public_key: PublicKey,
}

#[derive(Debug, Clone)]
pub struct ServiceEndpoint {
    pub id: String,
    pub service_type: String,            // "TrustNetwork", "Messaging", etc.
    pub endpoint: String,                // URL or address
}

impl DidDocument {
    pub fn add_service_endpoint(&mut self, endpoint: ServiceEndpoint) {
        self.service_endpoints.push(endpoint);
        self.updated = SystemTime::now();
    }
    
    pub fn rotate_key(&mut self, old_key_id: &str, new_key: DidPublicKey) -> Result<()> {
        // Remove old key
        self.public_keys.retain(|k| k.id != old_key_id);
        
        // Add new key
        self.public_keys.push(new_key.clone());
        
        // Update authentication if needed
        if let Some(pos) = self.authentication.iter().position(|id| id == old_key_id) {
            self.authentication[pos] = new_key.id;
        }
        
        self.updated = SystemTime::now();
        Ok(())
    }
}
```

## Trust Credentials

Trust credentials are verifiable claims about trust relationships:

### Credential Structure

```rust
use olocus_trust::credentials::*;

#[derive(Debug, Clone)]
pub struct TrustCredential {
    pub id: CredentialId,
    pub issuer: Did,                     // Who issued the credential
    pub subject: Did,                    // Who the credential is about
    pub claim: TrustClaim,              // The trust assertion
    pub evidence: Vec<Evidence>,         // Supporting evidence
    pub valid_from: SystemTime,
    pub valid_until: Option<SystemTime>,
    pub proof: CredentialProof,          // Cryptographic proof
}

#[derive(Debug, Clone)]
pub enum TrustClaim {
    DirectTrust {
        score: f64,                      // Trust score [0.0, 1.0]
        confidence: f64,                 // Confidence in assessment
        context: TrustContext,           // Context of trust
    },
    Recommendation {
        recommends: Did,                 // Recommended party
        score: f64,                      // Recommendation strength
        reason: String,                  // Human-readable reason
    },
    Attestation {
        claim_type: AttestationType,     // What is being attested
        claim_value: serde_json::Value,  // The claim content
        spatial_proof: Option<SpatialProof>,
        temporal_proof: Option<TemporalProof>,
    },
    Reputation {
        domain: String,                  // Reputation domain (e.g., "file-sharing")
        score: f64,                      // Normalized reputation score
        interactions: u32,               // Number of interactions
        last_updated: SystemTime,
    }
}

#[derive(Debug, Clone)]
pub enum TrustContext {
    General,                             // General-purpose trust
    Financial,                           // Financial transactions
    DataSharing,                         // Data sharing context
    LocationSharing,                     // Location sharing
    Communication,                       // Messaging/communication
    Emergency,                           // Emergency situations
}
```

### Credential Issuance

```rust
impl TrustCredentialIssuer {
    pub fn issue_trust_credential(
        &self,
        issuer_private_key: &PrivateKey,
        subject: Did,
        claim: TrustClaim,
        evidence: Vec<Evidence>
    ) -> Result<TrustCredential> {
        let credential_id = CredentialId::generate();
        let issuer_did = Did::new(&issuer_private_key.public_key());
        
        let credential = TrustCredential {
            id: credential_id,
            issuer: issuer_did,
            subject,
            claim,
            evidence,
            valid_from: SystemTime::now(),
            valid_until: None,
            proof: CredentialProof::Placeholder, // Will be filled by signing
        };
        
        // Create cryptographic proof
        let proof = self.create_proof(&credential, issuer_private_key)?;
        
        Ok(TrustCredential {
            proof,
            ..credential
        })
    }
    
    fn create_proof(&self, credential: &TrustCredential, private_key: &PrivateKey) -> Result<CredentialProof> {
        // Serialize credential without proof for signing
        let mut credential_for_signing = credential.clone();
        credential_for_signing.proof = CredentialProof::Placeholder;
        
        let serialized = serde_json::to_vec(&credential_for_signing)?;
        let signature = private_key.sign(&serialized)?;
        
        Ok(CredentialProof::Ed25519Signature2020 {
            created: SystemTime::now(),
            verification_method: format!("{}#key-1", credential.issuer.to_string()),
            signature: signature.as_bytes().to_vec(),
        })
    }
}
```

## Reputation Algorithms

Multiple reputation algorithms for different network characteristics:

### EigenTrust Implementation

```rust
use olocus_trust::reputation::eigentrust::*;

pub struct EigenTrustAlgorithm {
    alpha: f64,                          // Pre-trust weight
    epsilon: f64,                        // Convergence threshold
    max_iterations: usize,
}

impl ReputationAlgorithm for EigenTrustAlgorithm {
    fn calculate_reputation(&self, network: &TrustNetwork) -> Result<ReputationScores> {
        let peers: Vec<Did> = network.get_all_peers();
        let n = peers.len();
        
        if n == 0 {
            return Ok(ReputationScores::empty());
        }
        
        // Build normalized trust matrix
        let trust_matrix = self.build_trust_matrix(network, &peers)?;
        
        // Initialize reputation vector with uniform distribution
        let mut reputation = vec![1.0 / n as f64; n];
        let pre_trust = vec![1.0 / n as f64; n]; // Uniform pre-trust
        
        // Iterative computation
        for iteration in 0..self.max_iterations {
            let prev_reputation = reputation.clone();
            
            // r = (1 - α) * C^T * r + α * p
            reputation = self.matrix_vector_multiply(&trust_matrix, &prev_reputation);
            
            for i in 0..n {
                reputation[i] = (1.0 - self.alpha) * reputation[i] + self.alpha * pre_trust[i];
            }
            
            // Check convergence
            let diff: f64 = reputation.iter()
                .zip(prev_reputation.iter())
                .map(|(new, old)| (new - old).abs())
                .sum();
                
            if diff < self.epsilon {
                break;
            }
        }
        
        // Convert to reputation scores
        let mut scores = ReputationScores::new();
        for (i, &score) in reputation.iter().enumerate() {
            scores.insert(peers[i].clone(), score);
        }
        
        Ok(scores)
    }
    
    fn build_trust_matrix(&self, network: &TrustNetwork, peers: &[Did]) -> Result<Vec<Vec<f64>>> {
        let n = peers.len();
        let mut matrix = vec![vec![0.0; n]; n];
        
        for (i, trustor) in peers.iter().enumerate() {
            let mut row_sum = 0.0;
            
            // Get trust values for this peer
            for (j, trustee) in peers.iter().enumerate() {
                if i != j {
                    let trust_value = network.get_direct_trust(trustor, trustee)
                        .unwrap_or(0.0);
                    matrix[i][j] = trust_value.max(0.0); // Ensure non-negative
                    row_sum += matrix[i][j];
                }
            }
            
            // Normalize row (make stochastic)
            if row_sum > 0.0 {
                for j in 0..n {
                    matrix[i][j] /= row_sum;
                }
            } else {
                // No outgoing trust - distribute uniformly
                for j in 0..n {
                    if i != j {
                        matrix[i][j] = 1.0 / (n - 1) as f64;
                    }
                }
            }
        }
        
        Ok(matrix)
    }
}
```

### PageRank Reputation

```rust
use olocus_trust::reputation::pagerank::*;

pub struct PageRankReputation {
    damping_factor: f64,                 // Usually 0.85
    epsilon: f64,
    max_iterations: usize,
}

impl ReputationAlgorithm for PageRankReputation {
    fn calculate_reputation(&self, network: &TrustNetwork) -> Result<ReputationScores> {
        let peers: Vec<Did> = network.get_all_peers();
        let n = peers.len();
        
        if n == 0 {
            return Ok(ReputationScores::empty());
        }
        
        // Build adjacency matrix from trust relationships
        let adjacency = self.build_adjacency_matrix(network, &peers)?;
        
        // Calculate out-degrees
        let out_degrees: Vec<f64> = adjacency.iter()
            .map(|row| row.iter().sum::<f64>())
            .collect();
            
        // Initialize PageRank scores
        let mut pagerank = vec![1.0 / n as f64; n];
        
        for iteration in 0..self.max_iterations {
            let prev_pagerank = pagerank.clone();
            
            for i in 0..n {
                let mut sum = 0.0;
                
                for j in 0..n {
                    if adjacency[j][i] > 0.0 && out_degrees[j] > 0.0 {
                        sum += adjacency[j][i] * prev_pagerank[j] / out_degrees[j];
                    }
                }
                
                pagerank[i] = (1.0 - self.damping_factor) / n as f64 + 
                              self.damping_factor * sum;
            }
            
            // Check convergence
            let diff: f64 = pagerank.iter()
                .zip(prev_pagerank.iter())
                .map(|(new, old)| (new - old).abs())
                .sum();
                
            if diff < self.epsilon {
                break;
            }
        }
        
        let mut scores = ReputationScores::new();
        for (i, &score) in pagerank.iter().enumerate() {
            scores.insert(peers[i].clone(), score);
        }
        
        Ok(scores)
    }
}
```

### Bayesian Trust

```rust
use olocus_trust::reputation::bayesian::*;

pub struct BayesianTrust {
    prior_alpha: f64,                    // Prior successful interactions
    prior_beta: f64,                     // Prior failed interactions
}

impl ReputationAlgorithm for BayesianTrust {
    fn calculate_reputation(&self, network: &TrustNetwork) -> Result<ReputationScores> {
        let mut scores = ReputationScores::new();
        
        for peer in network.get_all_peers() {
            let interactions = network.get_interaction_history(&peer)?;
            
            // Count positive and negative interactions
            let (positive, negative) = self.count_interactions(&interactions);
            
            // Update Beta distribution parameters
            let alpha = self.prior_alpha + positive as f64;
            let beta = self.prior_beta + negative as f64;
            
            // Expected value of Beta distribution
            let reputation = alpha / (alpha + beta);
            
            // Optionally weight by confidence (higher for more interactions)
            let confidence = self.calculate_confidence(alpha, beta);
            let weighted_reputation = reputation * confidence.sqrt();
            
            scores.insert(peer, weighted_reputation);
        }
        
        Ok(scores)
    }
    
    fn count_interactions(&self, interactions: &[Interaction]) -> (u32, u32) {
        let mut positive = 0;
        let mut negative = 0;
        
        for interaction in interactions {
            match interaction.outcome {
                InteractionOutcome::Positive => positive += 1,
                InteractionOutcome::Negative => negative += 1,
                InteractionOutcome::Neutral => {}, // Don't count neutral
            }
        }
        
        (positive, negative)
    }
    
    fn calculate_confidence(&self, alpha: f64, beta: f64) -> f64 {
        // Wilson score interval width as confidence measure
        let n = alpha + beta;
        let p = alpha / n;
        
        if n < 1.0 {
            return 0.0;
        }
        
        // 95% confidence interval
        let z = 1.96; // z-score for 95% confidence
        let denominator = 1.0 + z * z / n;
        let centre_adjusted_probability = p + z * z / (2.0 * n);
        let adjusted_standard_deviation = ((p * (1.0 - p) + z * z / (4.0 * n)) / n).sqrt();
        
        let lower_bound = (centre_adjusted_probability - z * adjusted_standard_deviation) / denominator;
        let upper_bound = (centre_adjusted_probability + z * adjusted_standard_deviation) / denominator;
        
        // Confidence is inverse of interval width
        1.0 / (upper_bound - lower_bound + f64::EPSILON)
    }
}
```

## Spatial-Temporal Attestations

Enhanced attestation protocol for location and time verification:

### Attestation Types

```rust
use olocus_trust::attestation::*;

#[derive(Debug, Clone)]
pub enum AttestationType {
    Presence {
        location: Coordinate,
        radius: f64,                     // Verification radius (meters)
        timestamp: SystemTime,
        duration: Option<Duration>,      // How long they were there
    },
    Proximity {
        other_party: Did,               // Who they were near
        distance: f64,                  // How close (meters)
        timestamp: SystemTime,
        confidence: f64,                // Confidence in measurement
    },
    Movement {
        path: Vec<Coordinate>,          // Movement trajectory
        start_time: SystemTime,
        end_time: SystemTime,
        mode: MovementMode,             // Walking, driving, etc.
    },
    Identity {
        verified_attributes: HashMap<String, String>,
        verification_method: VerificationMethod,
        confidence_level: f64,
    },
    Interaction {
        interaction_type: InteractionType,
        other_parties: Vec<Did>,
        outcome: InteractionOutcome,
        timestamp: SystemTime,
    }
}

#[derive(Debug, Clone)]
pub enum MovementMode {
    Walking,
    Cycling,
    Driving,
    PublicTransport,
    Unknown,
}

#[derive(Debug, Clone)]
pub enum InteractionType {
    Meeting,
    Transaction,
    DataSharing,
    Communication,
    ServiceProvision,
}
```

### Attestation Protocol

```rust
use olocus_trust::attestation::protocol::*;

pub struct AttestationProtocol {
    config: AttestationConfig,
    witness_registry: WitnessRegistry,
}

impl AttestationProtocol {
    pub async fn create_attestation(
        &self,
        subject: Did,
        claim: AttestationType,
        witnesses: Vec<Did>
    ) -> Result<Attestation> {
        
        // Validate witnesses
        self.validate_witnesses(&witnesses, &claim).await?;
        
        // Create attestation challenge
        let challenge = AttestationChallenge::generate(&claim);
        
        // Collect witness responses
        let witness_responses = self.collect_witness_responses(
            &witnesses,
            &challenge,
            &claim
        ).await?;
        
        // Verify spatial-temporal constraints
        self.verify_spatiotemporal_constraints(&claim, &witness_responses)?;
        
        // Create final attestation
        let attestation = Attestation {
            id: AttestationId::generate(),
            subject,
            claim,
            witnesses: witness_responses,
            created_at: SystemTime::now(),
            validity_period: self.calculate_validity_period(&claim),
            confidence_score: self.calculate_confidence(&witness_responses),
        };
        
        Ok(attestation)
    }
    
    async fn validate_witnesses(
        &self,
        witnesses: &[Did],
        claim: &AttestationType
    ) -> Result<()> {
        if witnesses.len() < self.config.required_witnesses {
            return Err(AttestationError::InsufficientWitnesses {
                required: self.config.required_witnesses,
                provided: witnesses.len(),
            });
        }
        
        match claim {
            AttestationType::Presence { location, radius, timestamp, .. } => {
                // Check if witnesses were spatially and temporally capable
                for witness in witnesses {
                    let witness_location = self.witness_registry
                        .get_location_at_time(witness, *timestamp)
                        .await?;
                        
                    if let Some(loc) = witness_location {
                        let distance = Coordinate::haversine_distance(
                            location.latitude, location.longitude,
                            loc.latitude, loc.longitude
                        );
                        
                        if distance > radius + self.config.witness_proximity_margin {
                            return Err(AttestationError::WitnessOutOfRange {
                                witness: witness.clone(),
                                distance,
                                max_distance: radius + self.config.witness_proximity_margin,
                            });
                        }
                    }
                }
            },
            _ => {} // Other validations as needed
        }
        
        Ok(())
    }
    
    fn verify_spatiotemporal_constraints(
        &self,
        claim: &AttestationType,
        responses: &[WitnessResponse]
    ) -> Result<()> {
        match claim {
            AttestationType::Presence { location, radius, timestamp, .. } => {
                let mut confirmations = 0;
                
                for response in responses {
                    if let WitnessResponseType::PresenceConfirmation { 
                        observed_location, 
                        observation_time,
                        confidence 
                    } = &response.response_type {
                        
                        // Check spatial consistency
                        let distance = Coordinate::haversine_distance(
                            location.latitude, location.longitude,
                            observed_location.latitude, observed_location.longitude
                        );
                        
                        if distance <= *radius {
                            // Check temporal consistency
                            let time_diff = observation_time.duration_since(*timestamp)
                                .unwrap_or_else(|_| timestamp.duration_since(*observation_time).unwrap_or_default());
                                
                            if time_diff <= self.config.temporal_window && *confidence >= 0.7 {
                                confirmations += 1;
                            }
                        }
                    }
                }
                
                if confirmations < self.config.required_confirmations {
                    return Err(AttestationError::InsufficientConfirmations {
                        required: self.config.required_confirmations,
                        received: confirmations,
                    });
                }
            },
            _ => {} // Other constraint checks
        }
        
        Ok(())
    }
}
```

## Trust Network Management

### Peer Connection Management

```rust
use olocus_trust::network::*;

pub struct TrustNetwork {
    connections: HashMap<Did, PeerConnection>,
    trust_relationships: HashMap<(Did, Did), TrustRelationship>,
    reputation_scores: ReputationScores,
    attestations: Vec<Attestation>,
}

#[derive(Debug, Clone)]
pub struct PeerConnection {
    pub peer_did: Did,
    pub connection_type: ConnectionType,
    pub established_at: SystemTime,
    pub last_interaction: SystemTime,
    pub trust_score: f64,
    pub attestations_given: u32,
    pub attestations_received: u32,
    pub interaction_history: Vec<Interaction>,
}

#[derive(Debug, Clone)]
pub enum ConnectionType {
    Direct,           // Direct peer relationship
    Transitive,       // Connected through mutual connections
    Temporary,        // Short-term connection
}

impl TrustNetwork {
    pub fn add_peer_connection(
        &mut self,
        local_did: &Did,
        peer_did: Did,
        connection_type: ConnectionType
    ) -> Result<()> {
        // Check if we've reached maximum connections
        if self.connections.len() >= self.config.max_connections {
            return Err(TrustError::MaxConnectionsReached);
        }
        
        // Check trust threshold for direct connections
        if matches!(connection_type, ConnectionType::Direct) {
            let reputation = self.reputation_scores.get(&peer_did).unwrap_or(&0.0);
            if *reputation < self.config.trust_threshold {
                return Err(TrustError::InsufficientTrust {
                    peer: peer_did,
                    trust_score: *reputation,
                    required: self.config.trust_threshold,
                });
            }
        }
        
        let connection = PeerConnection {
            peer_did: peer_did.clone(),
            connection_type,
            established_at: SystemTime::now(),
            last_interaction: SystemTime::now(),
            trust_score: self.reputation_scores.get(&peer_did).unwrap_or(&0.5).clone(),
            attestations_given: 0,
            attestations_received: 0,
            interaction_history: Vec::new(),
        };
        
        self.connections.insert(peer_did, connection);
        Ok(())
    }
    
    pub fn record_interaction(
        &mut self,
        local_did: &Did,
        peer_did: &Did,
        interaction: Interaction
    ) -> Result<()> {
        // Update connection
        if let Some(connection) = self.connections.get_mut(peer_did) {
            connection.last_interaction = interaction.timestamp;
            connection.interaction_history.push(interaction.clone());
            
            // Update trust score based on interaction outcome
            match interaction.outcome {
                InteractionOutcome::Positive => {
                    connection.trust_score = (connection.trust_score + 0.1).min(1.0);
                },
                InteractionOutcome::Negative => {
                    connection.trust_score = (connection.trust_score - 0.2).max(0.0);
                },
                InteractionOutcome::Neutral => {
                    // No change
                }
            }
        }
        
        // Update global trust relationship
        let relationship_key = (local_did.clone(), peer_did.clone());
        let relationship = self.trust_relationships.entry(relationship_key)
            .or_insert_with(|| TrustRelationship::new(local_did.clone(), peer_did.clone()));
            
        relationship.add_interaction(interaction);
        
        Ok(())
    }
    
    pub fn prune_inactive_connections(&mut self, inactive_threshold: Duration) -> usize {
        let current_time = SystemTime::now();
        let initial_count = self.connections.len();
        
        self.connections.retain(|_, connection| {
            let inactive_duration = current_time.duration_since(connection.last_interaction)
                .unwrap_or_default();
                
            // Keep direct connections longer than transitive ones
            let threshold = match connection.connection_type {
                ConnectionType::Direct => inactive_threshold * 3,
                ConnectionType::Transitive => inactive_threshold,
                ConnectionType::Temporary => inactive_threshold / 2,
            };
            
            inactive_duration < threshold
        });
        
        initial_count - self.connections.len()
    }
}
```

### Trust Propagation

```rust
impl TrustNetwork {
    pub fn propagate_trust(&self, source: &Did, max_hops: usize) -> HashMap<Did, f64> {
        let mut trust_scores = HashMap::new();
        let mut visited = HashSet::new();
        let mut queue = VecDeque::new();
        
        // Initialize with direct connections
        queue.push_back((source.clone(), 1.0, 0));
        visited.insert(source.clone());
        
        while let Some((current_did, current_trust, hops)) = queue.pop_front() {
            if hops >= max_hops {
                continue;
            }
            
            // Get current peer's connections
            if let Some(connection) = self.connections.get(&current_did) {
                for (peer_did, relationship) in &self.trust_relationships {
                    if peer_did.0 == current_did && !visited.contains(&peer_did.1) {
                        let propagated_trust = current_trust * relationship.trust_score * 0.8; // Decay factor
                        
                        if propagated_trust > 0.1 { // Minimum threshold
                            trust_scores.insert(peer_did.1.clone(), propagated_trust);
                            queue.push_back((peer_did.1.clone(), propagated_trust, hops + 1));
                            visited.insert(peer_did.1.clone());
                        }
                    }
                }
            }
        }
        
        trust_scores
    }
    
    pub fn find_trust_path(&self, from: &Did, to: &Did, max_hops: usize) -> Option<TrustPath> {
        let mut queue = VecDeque::new();
        let mut visited = HashMap::new();
        
        queue.push_back(TrustPath {
            nodes: vec![from.clone()],
            total_trust: 1.0,
        });
        
        while let Some(current_path) = queue.pop_front() {
            let current_node = current_path.nodes.last().unwrap();
            
            if current_node == to {
                return Some(current_path);
            }
            
            if current_path.nodes.len() >= max_hops {
                continue;
            }
            
            // Explore neighbors
            for (relationship_key, relationship) in &self.trust_relationships {
                if relationship_key.0 == *current_node {
                    let next_node = &relationship_key.1;
                    
                    if !current_path.nodes.contains(next_node) { // Avoid cycles
                        let path_trust = current_path.total_trust * relationship.trust_score;
                        
                        if path_trust > 0.01 { // Minimum path trust
                            let mut new_path = current_path.clone();
                            new_path.nodes.push(next_node.clone());
                            new_path.total_trust = path_trust;
                            
                            queue.push_back(new_path);
                        }
                    }
                }
            }
        }
        
        None
    }
}
```

## Integration Examples

### Trust-Based Access Control

```rust
use olocus_trust::access::*;

pub struct TrustBasedAccessControl {
    trust_network: TrustNetwork,
    access_policies: HashMap<ResourceId, AccessPolicy>,
}

impl TrustBasedAccessControl {
    pub fn check_access(
        &self,
        requester: &Did,
        resource: &ResourceId,
        operation: &Operation
    ) -> AccessDecision {
        let policy = match self.access_policies.get(resource) {
            Some(p) => p,
            None => return AccessDecision::Deny("No policy found".to_string()),
        };
        
        // Get trust score for requester
        let trust_score = self.trust_network.reputation_scores
            .get(requester)
            .unwrap_or(&0.0);
            
        // Check trust threshold
        if *trust_score < policy.min_trust_score {
            return AccessDecision::Deny(format!(
                "Insufficient trust: {} < {}",
                trust_score, policy.min_trust_score
            ));
        }
        
        // Check attestation requirements
        if policy.requires_attestation {
            let attestations = self.trust_network.get_attestations_for(requester);
            if !self.has_valid_attestation(&attestations, &policy.required_attestation_type) {
                return AccessDecision::Deny("Required attestation not found".to_string());
            }
        }
        
        // Check operation-specific requirements
        match operation {
            Operation::Read => {
                if trust_score >= &policy.read_threshold {
                    AccessDecision::Allow
                } else {
                    AccessDecision::Deny("Insufficient trust for read operation".to_string())
                }
            },
            Operation::Write => {
                if trust_score >= &policy.write_threshold &&
                   self.check_reputation_stability(requester) {
                    AccessDecision::Allow
                } else {
                    AccessDecision::Deny("Insufficient trust or unstable reputation".to_string())
                }
            },
            Operation::Delete => {
                if trust_score >= &policy.delete_threshold &&
                   self.has_administrative_attestation(requester) {
                    AccessDecision::Allow
                } else {
                    AccessDecision::Deny("Insufficient privileges for delete operation".to_string())
                }
            }
        }
    }
}
```

## Testing & Performance

```rust
#[cfg(test)]
mod trust_tests {
    use super::*;
    
    #[test]
    fn test_eigentrust_convergence() {
        let mut network = create_test_network();
        
        // Add some trust relationships
        network.add_trust_relationship(
            &did("alice"),
            &did("bob"),
            0.8
        );
        network.add_trust_relationship(
            &did("bob"),
            &did("charlie"),
            0.9
        );
        
        let algorithm = EigenTrustAlgorithm {
            alpha: 0.5,
            epsilon: 0.01,
            max_iterations: 100,
        };
        
        let scores = algorithm.calculate_reputation(&network).unwrap();
        
        // Charlie should have highest reputation (trusted by Bob, who is trusted by Alice)
        assert!(scores.get(&did("charlie")).unwrap() > scores.get(&did("alice")).unwrap());
    }
    
    #[test]
    fn test_attestation_spatial_verification() {
        let protocol = AttestationProtocol::new(AttestationConfig::default());
        
        let claim = AttestationType::Presence {
            location: Coordinate::new(37.7749, -122.4194), // San Francisco
            radius: 50.0,
            timestamp: SystemTime::now(),
            duration: Some(Duration::from_mins(30)),
        };
        
        // Add witnesses at appropriate locations
        let witnesses = vec![
            did("witness1"), // Close to location
            did("witness2"), // Close to location  
            did("witness3"), // Close to location
        ];
        
        let result = tokio_test::block_on(
            protocol.create_attestation(did("subject"), claim, witnesses)
        );
        
        assert!(result.is_ok());
    }
}

fn create_test_network() -> TrustNetwork {
    TrustNetwork::new(TrustNetworkConfig::default())
}

fn did(name: &str) -> Did {
    // Create test DID from name
    let private_key = PrivateKey::generate_for_testing(name);
    Did::new(&private_key.public_key())
}
```

## Related Documentation

- [Device Integrity](./device-integrity.md) - Device attestation integration
- [HSM Integration](./hsm-integration.md) - Hardware-backed trust
- [Post-Quantum Cryptography](./post-quantum.md) - Future-proof trust
- [Credentials Extension](/extensions/enterprise/credentials/) - W3C VC integration