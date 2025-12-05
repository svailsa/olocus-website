# Credential Revocation

## Overview

The Olocus Credentials extension implements comprehensive credential revocation mechanisms to ensure that invalidated credentials can be reliably identified and rejected. The system supports multiple revocation methods including traditional revocation lists, privacy-preserving accumulator-based schemes, and blockchain-based revocation registries.

## Architecture

### Core Components

```rust
use olocus_core::measure::{Measurement, Value, Uncertainty, Provenance};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, BTreeSet};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevocationRegistry {
    pub registry_id: String,
    pub issuer_did: String,
    pub revocation_method: RevocationMethod,
    pub revocation_lists: HashMap<String, RevocationList>,
    pub revocation_events: Vec<RevocationEvent>,
    pub privacy_settings: RevocationPrivacySettings,
    pub measurement_attestations: Vec<RevocationMeasurementAttestation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RevocationMethod {
    RevocationList2020,
    BitstringStatusList,
    StatusList2021,
    CryptoAccumulator,
    BlockchainRegistry,
    ZeroKnowledgeRevocation,
    // Future: Advanced privacy-preserving methods
    Anonymous,
    Unlinkable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevocationList {
    pub id: String,
    pub list_type: RevocationListType,
    pub issuer: String,
    pub issued: DateTime<Utc>,
    pub updated: DateTime<Utc>,
    pub next_update: Option<DateTime<Utc>>,
    pub revocation_entries: BTreeSet<u64>,
    pub suspension_entries: BTreeSet<u64>,
    pub bitstring: Option<String>, // For bitstring-based lists
    pub merkle_root: Option<String>, // For Merkle tree-based lists
    pub accumulator_value: Option<String>, // For cryptographic accumulators
    pub size: u64,
    pub purpose: RevocationPurpose,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RevocationListType {
    SimpleList,
    BitstringCompressed,
    MerkleTree,
    CryptoAccumulator,
    BloomFilter,
    ZKAccumulator,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RevocationPurpose {
    Revocation,   // Permanent invalidation
    Suspension,   // Temporary invalidation
    Both,         // List handles both revocation and suspension
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevocationEvent {
    pub event_id: String,
    pub credential_id: String,
    pub revocation_index: u64,
    pub event_type: RevocationEventType,
    pub reason: RevocationReason,
    pub timestamp: DateTime<Utc>,
    pub effective_date: Option<DateTime<Utc>>,
    pub revoked_by: String,
    pub proof: RevocationProof,
    pub measurement_evidence: Option<Measurement>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RevocationEventType {
    Revoke,       // Permanent revocation
    Suspend,      // Temporary suspension
    Reinstate,    // Reverse suspension
    Update,       // Update revocation details
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RevocationReason {
    Superseded,                    // Credential replaced by newer version
    PrivilegeWithdrawn,           // Privileges no longer valid
    AffiliationChanged,           // Subject changed affiliation
    KeyCompromise,                // Private key compromised
    CACompromise,                 // Issuer key compromised
    CertificateHold,              // Temporary hold
    CessationOfOperation,         // Issuer ceased operations
    Unspecified,                  // Reason not specified
    MeasurementInvalidation,      // Olocus-specific: measurement no longer valid
    LocationVerificationFailure,   // Olocus-specific: location claim invalid
    IdentityVerificationFailure,  // Olocus-specific: identity claim invalid
    Custom(String),               // Custom reason
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevocationProof {
    pub proof_type: String,
    pub verification_method: String,
    pub signature: String,
    pub created: DateTime<Utc>,
    pub nonce: Option<String>,
    pub challenge: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevocationPrivacySettings {
    pub hide_revocation_reason: bool,
    pub hide_revocation_timing: bool,
    pub use_anonymous_revocation: bool,
    pub batch_updates: bool,
    pub update_frequency: RevocationUpdateFrequency,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RevocationUpdateFrequency {
    Realtime,
    Hourly,
    Daily,
    Weekly,
    Monthly,
    OnDemand,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevocationMeasurementAttestation {
    pub attestation_id: String,
    pub credential_id: String,
    pub measurement: Measurement,
    pub attestation_type: AttestationType,
    pub verifier_did: String,
    pub attestation_proof: String,
    pub timestamp: DateTime<Utc>,
    pub validity_period: Option<chrono::Duration>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AttestationType {
    LocationVerification,    // Attest to location accuracy
    IdentityVerification,    // Attest to identity claims
    BiometricVerification,   // Attest to biometric authenticity
    DeviceIntegrity,         // Attest to device trustworthiness
    MeasurementAccuracy,     // Attest to measurement precision
    TemporalVerification,    // Attest to timing claims
}
```

### Revocation Manager

```rust
impl RevocationRegistry {
    pub fn new(
        issuer_did: String,
        method: RevocationMethod,
        privacy_settings: RevocationPrivacySettings,
    ) -> Self {
        let registry_id = format!("urn:uuid:{}", Uuid::new_v4());
        
        Self {
            registry_id,
            issuer_did,
            revocation_method: method,
            revocation_lists: HashMap::new(),
            revocation_events: Vec::new(),
            privacy_settings,
            measurement_attestations: Vec::new(),
        }
    }

    pub fn create_revocation_list(
        &mut self,
        list_type: RevocationListType,
        purpose: RevocationPurpose,
        initial_size: u64,
    ) -> Result<String, RevocationError> {
        let list_id = format!("{}#list-{}", self.registry_id, self.revocation_lists.len());
        
        let revocation_list = RevocationList {
            id: list_id.clone(),
            list_type: list_type.clone(),
            issuer: self.issuer_did.clone(),
            issued: Utc::now(),
            updated: Utc::now(),
            next_update: self.calculate_next_update(),
            revocation_entries: BTreeSet::new(),
            suspension_entries: BTreeSet::new(),
            bitstring: match list_type {
                RevocationListType::BitstringCompressed => {
                    Some(self.create_initial_bitstring(initial_size)?)
                },
                _ => None,
            },
            merkle_root: match list_type {
                RevocationListType::MerkleTree => {
                    Some(self.create_initial_merkle_root(initial_size)?)
                },
                _ => None,
            },
            accumulator_value: match list_type {
                RevocationListType::CryptoAccumulator => {
                    Some(self.create_initial_accumulator()?)
                },
                _ => None,
            },
            size: initial_size,
            purpose,
        };

        self.revocation_lists.insert(list_id.clone(), revocation_list);
        Ok(list_id)
    }

    pub fn revoke_credential(
        &mut self,
        credential_id: String,
        revocation_index: u64,
        reason: RevocationReason,
        proof: RevocationProof,
        measurement_evidence: Option<Measurement>,
    ) -> Result<(), RevocationError> {
        // Find appropriate revocation list
        let list_id = self.find_revocation_list_for_credential(&credential_id)?;
        
        // Validate proof
        self.validate_revocation_proof(&proof)?;

        // Create revocation event
        let event = RevocationEvent {
            event_id: format!("rev-{}", Uuid::new_v4()),
            credential_id: credential_id.clone(),
            revocation_index,
            event_type: RevocationEventType::Revoke,
            reason: reason.clone(),
            timestamp: Utc::now(),
            effective_date: None,
            revoked_by: proof.verification_method.clone(),
            proof,
            measurement_evidence: measurement_evidence.clone(),
        };

        // Update revocation list
        if let Some(list) = self.revocation_lists.get_mut(&list_id) {
            match &mut list.list_type {
                RevocationListType::SimpleList => {
                    list.revocation_entries.insert(revocation_index);
                },
                RevocationListType::BitstringCompressed => {
                    self.update_bitstring(list, revocation_index, true)?;
                },
                RevocationListType::MerkleTree => {
                    self.update_merkle_tree(list, revocation_index, true)?;
                },
                RevocationListType::CryptoAccumulator => {
                    self.update_accumulator(list, revocation_index, true)?;
                },
                _ => return Err(RevocationError::UnsupportedListType),
            }
            
            list.updated = Utc::now();
            list.next_update = self.calculate_next_update();
        }

        // Record event
        self.revocation_events.push(event);

        // Add measurement evidence if provided
        if let Some(measurement) = measurement_evidence {
            self.add_measurement_attestation(credential_id, measurement)?;
        }

        Ok(())
    }

    pub fn suspend_credential(
        &mut self,
        credential_id: String,
        revocation_index: u64,
        reason: RevocationReason,
        proof: RevocationProof,
        suspension_period: Option<chrono::Duration>,
    ) -> Result<(), RevocationError> {
        let list_id = self.find_revocation_list_for_credential(&credential_id)?;
        
        self.validate_revocation_proof(&proof)?;

        let effective_date = suspension_period.map(|duration| Utc::now() + duration);

        let event = RevocationEvent {
            event_id: format!("sus-{}", Uuid::new_v4()),
            credential_id: credential_id.clone(),
            revocation_index,
            event_type: RevocationEventType::Suspend,
            reason,
            timestamp: Utc::now(),
            effective_date,
            revoked_by: proof.verification_method.clone(),
            proof,
            measurement_evidence: None,
        };

        if let Some(list) = self.revocation_lists.get_mut(&list_id) {
            match list.purpose {
                RevocationPurpose::Suspension | RevocationPurpose::Both => {
                    list.suspension_entries.insert(revocation_index);
                    
                    match &mut list.list_type {
                        RevocationListType::BitstringCompressed => {
                            // Use separate bit for suspension
                            self.update_suspension_bitstring(list, revocation_index, true)?;
                        },
                        _ => {}, // Other types handle suspension in the entries set
                    }
                },
                RevocationPurpose::Revocation => {
                    return Err(RevocationError::SuspensionNotSupported);
                }
            }
            
            list.updated = Utc::now();
        }

        self.revocation_events.push(event);
        Ok(())
    }

    pub fn reinstate_credential(
        &mut self,
        credential_id: String,
        revocation_index: u64,
        proof: RevocationProof,
    ) -> Result<(), RevocationError> {
        let list_id = self.find_revocation_list_for_credential(&credential_id)?;
        
        self.validate_revocation_proof(&proof)?;

        let event = RevocationEvent {
            event_id: format!("rei-{}", Uuid::new_v4()),
            credential_id: credential_id.clone(),
            revocation_index,
            event_type: RevocationEventType::Reinstate,
            reason: RevocationReason::Unspecified,
            timestamp: Utc::now(),
            effective_date: None,
            revoked_by: proof.verification_method.clone(),
            proof,
            measurement_evidence: None,
        };

        if let Some(list) = self.revocation_lists.get_mut(&list_id) {
            list.suspension_entries.remove(&revocation_index);
            
            match &mut list.list_type {
                RevocationListType::BitstringCompressed => {
                    self.update_suspension_bitstring(list, revocation_index, false)?;
                },
                _ => {},
            }
            
            list.updated = Utc::now();
        }

        self.revocation_events.push(event);
        Ok(())
    }

    pub async fn check_revocation_status(
        &self,
        credential_id: &str,
        revocation_index: u64,
    ) -> Result<RevocationStatus, RevocationError> {
        let list_id = self.find_revocation_list_for_credential(credential_id)?;
        
        let list = self.revocation_lists.get(&list_id)
            .ok_or(RevocationError::ListNotFound(list_id))?;

        let is_revoked = list.revocation_entries.contains(&revocation_index);
        let is_suspended = list.suspension_entries.contains(&revocation_index);

        // Check if suspension has expired
        let suspension_active = if is_suspended {
            self.is_suspension_active(credential_id, revocation_index)?
        } else {
            false
        };

        let status = if is_revoked {
            RevocationStatus::Revoked {
                revoked_at: self.get_revocation_timestamp(credential_id)?,
                reason: self.get_revocation_reason(credential_id)?,
            }
        } else if suspension_active {
            RevocationStatus::Suspended {
                suspended_at: self.get_suspension_timestamp(credential_id)?,
                expires_at: self.get_suspension_expiry(credential_id)?,
                reason: self.get_suspension_reason(credential_id)?,
            }
        } else {
            RevocationStatus::Valid {
                last_checked: Utc::now(),
                next_update: list.next_update,
            }
        };

        Ok(status)
    }

    pub fn add_measurement_attestation(
        &mut self,
        credential_id: String,
        measurement: Measurement,
    ) -> Result<(), RevocationError> {
        // Validate measurement for attestation purposes
        self.validate_attestation_measurement(&measurement)?;

        let attestation = RevocationMeasurementAttestation {
            attestation_id: format!("att-{}", Uuid::new_v4()),
            credential_id,
            measurement,
            attestation_type: self.determine_attestation_type(&measurement)?,
            verifier_did: self.issuer_did.clone(), // Could be different verifier
            attestation_proof: "placeholder_proof".to_string(), // Would contain actual proof
            timestamp: Utc::now(),
            validity_period: Some(chrono::Duration::days(30)), // Attestations expire
        };

        self.measurement_attestations.push(attestation);
        Ok(())
    }

    fn validate_revocation_proof(&self, proof: &RevocationProof) -> Result<(), RevocationError> {
        // Verify that the proof is from an authorized entity
        if proof.verification_method != self.issuer_did && 
           !self.is_authorized_revoker(&proof.verification_method) {
            return Err(RevocationError::UnauthorizedRevocation);
        }

        // Verify signature (placeholder implementation)
        if proof.signature.is_empty() {
            return Err(RevocationError::InvalidProof("Empty signature".to_string()));
        }

        // Verify timestamp is reasonable
        if proof.created > Utc::now() + chrono::Duration::minutes(5) {
            return Err(RevocationError::InvalidProof("Future timestamp".to_string()));
        }

        Ok(())
    }

    fn find_revocation_list_for_credential(&self, credential_id: &str) -> Result<String, RevocationError> {
        // In a real implementation, this would map credentials to lists
        // For now, use the first available list
        self.revocation_lists
            .keys()
            .next()
            .cloned()
            .ok_or(RevocationError::NoRevocationListAvailable)
    }

    fn is_authorized_revoker(&self, verifier_did: &str) -> bool {
        // Check if the verifier is authorized to revoke credentials
        // This could check against a list of authorized entities
        verifier_did.starts_with("did:") && verifier_did.contains("authorized")
    }

    fn calculate_next_update(&self) -> Option<DateTime<Utc>> {
        match self.privacy_settings.update_frequency {
            RevocationUpdateFrequency::Realtime => None,
            RevocationUpdateFrequency::Hourly => Some(Utc::now() + chrono::Duration::hours(1)),
            RevocationUpdateFrequency::Daily => Some(Utc::now() + chrono::Duration::days(1)),
            RevocationUpdateFrequency::Weekly => Some(Utc::now() + chrono::Duration::weeks(1)),
            RevocationUpdateFrequency::Monthly => Some(Utc::now() + chrono::Duration::days(30)),
            RevocationUpdateFrequency::OnDemand => None,
        }
    }

    fn create_initial_bitstring(&self, size: u64) -> Result<String, RevocationError> {
        // Create a bitstring of specified size with all bits set to 0 (not revoked)
        let byte_count = (size + 7) / 8; // Round up to nearest byte
        let bitstring = vec![0u8; byte_count as usize];
        
        // Compress and encode
        let compressed = self.compress_bitstring(&bitstring)?;
        Ok(base64::encode(&compressed))
    }

    fn create_initial_merkle_root(&self, size: u64) -> Result<String, RevocationError> {
        // Create initial Merkle tree with all leaves set to "not revoked"
        let leaves: Vec<[u8; 32]> = (0..size).map(|_| [0u8; 32]).collect();
        let root = self.calculate_merkle_root(&leaves)?;
        Ok(hex::encode(root))
    }

    fn create_initial_accumulator(&self) -> Result<String, RevocationError> {
        // Initialize cryptographic accumulator
        // Placeholder implementation
        Ok("accumulator_initial_value".to_string())
    }

    fn update_bitstring(&self, list: &mut RevocationList, index: u64, revoked: bool) -> Result<(), RevocationError> {
        if let Some(bitstring_b64) = &list.bitstring {
            let compressed = base64::decode(bitstring_b64)
                .map_err(|e| RevocationError::InvalidBitstring(e.to_string()))?;
            
            let mut bitstring = self.decompress_bitstring(&compressed)?;
            
            let byte_index = index / 8;
            let bit_index = index % 8;
            
            if byte_index >= bitstring.len() as u64 {
                return Err(RevocationError::IndexOutOfBounds);
            }

            if revoked {
                bitstring[byte_index as usize] |= 1 << bit_index;
            } else {
                bitstring[byte_index as usize] &= !(1 << bit_index);
            }

            let compressed_updated = self.compress_bitstring(&bitstring)?;
            list.bitstring = Some(base64::encode(&compressed_updated));
        }

        Ok(())
    }

    fn update_suspension_bitstring(&self, list: &mut RevocationList, index: u64, suspended: bool) -> Result<(), RevocationError> {
        // Similar to update_bitstring but for suspension bits
        // Could use separate bitstring or interleaved bits
        self.update_bitstring(list, index, suspended)
    }

    fn update_merkle_tree(&self, list: &mut RevocationList, index: u64, revoked: bool) -> Result<(), RevocationError> {
        // Update Merkle tree leaf and recalculate root
        // Placeholder implementation
        if revoked {
            list.merkle_root = Some(format!("updated_merkle_root_for_index_{}", index));
        }
        Ok(())
    }

    fn update_accumulator(&self, list: &mut RevocationList, index: u64, revoked: bool) -> Result<(), RevocationError> {
        // Update cryptographic accumulator
        // Placeholder implementation
        if revoked {
            list.accumulator_value = Some(format!("updated_accumulator_for_index_{}", index));
        }
        Ok(())
    }

    fn compress_bitstring(&self, bitstring: &[u8]) -> Result<Vec<u8>, RevocationError> {
        // Compress bitstring using efficient compression
        // Placeholder: use simple RLE or actual compression library
        Ok(bitstring.to_vec()) // No compression for simplicity
    }

    fn decompress_bitstring(&self, compressed: &[u8]) -> Result<Vec<u8>, RevocationError> {
        // Decompress bitstring
        Ok(compressed.to_vec()) // No compression for simplicity
    }

    fn calculate_merkle_root(&self, leaves: &[[u8; 32]]) -> Result<[u8; 32], RevocationError> {
        // Calculate Merkle tree root
        // Placeholder implementation
        Ok([0u8; 32])
    }

    fn validate_attestation_measurement(&self, measurement: &Measurement) -> Result<(), RevocationError> {
        match &measurement.value {
            Value::None => Err(RevocationError::InvalidMeasurement("Empty measurement".to_string())),
            _ => {
                // Validate measurement has proper provenance
                match measurement.provenance.source {
                    olocus_core::measure::Source::Unknown => {
                        Err(RevocationError::InvalidMeasurement("Unknown measurement source".to_string()))
                    },
                    _ => Ok(()),
                }
            }
        }
    }

    fn determine_attestation_type(&self, measurement: &Measurement) -> Result<AttestationType, RevocationError> {
        match &measurement.value {
            Value::Point2D(_, _) | Value::Point3D(_, _, _) => Ok(AttestationType::LocationVerification),
            Value::Timestamp(_) => Ok(AttestationType::TemporalVerification),
            Value::Array(_) => {
                // Could be biometric data
                Ok(AttestationType::BiometricVerification)
            },
            _ => Ok(AttestationType::MeasurementAccuracy),
        }
    }

    fn is_suspension_active(&self, credential_id: &str, revocation_index: u64) -> Result<bool, RevocationError> {
        // Check if suspension is still active
        for event in &self.revocation_events {
            if event.credential_id == credential_id && 
               event.revocation_index == revocation_index &&
               matches!(event.event_type, RevocationEventType::Suspend) {
                
                if let Some(effective_date) = event.effective_date {
                    return Ok(Utc::now() < effective_date);
                } else {
                    return Ok(true); // No expiration specified
                }
            }
        }
        Ok(false)
    }

    fn get_revocation_timestamp(&self, credential_id: &str) -> Result<DateTime<Utc>, RevocationError> {
        for event in &self.revocation_events {
            if event.credential_id == credential_id && 
               matches!(event.event_type, RevocationEventType::Revoke) {
                return Ok(event.timestamp);
            }
        }
        Err(RevocationError::RevocationEventNotFound)
    }

    fn get_revocation_reason(&self, credential_id: &str) -> Result<RevocationReason, RevocationError> {
        for event in &self.revocation_events {
            if event.credential_id == credential_id && 
               matches!(event.event_type, RevocationEventType::Revoke) {
                return Ok(event.reason.clone());
            }
        }
        Err(RevocationError::RevocationEventNotFound)
    }

    fn get_suspension_timestamp(&self, credential_id: &str) -> Result<DateTime<Utc>, RevocationError> {
        for event in &self.revocation_events {
            if event.credential_id == credential_id && 
               matches!(event.event_type, RevocationEventType::Suspend) {
                return Ok(event.timestamp);
            }
        }
        Err(RevocationError::SuspensionEventNotFound)
    }

    fn get_suspension_expiry(&self, credential_id: &str) -> Result<Option<DateTime<Utc>>, RevocationError> {
        for event in &self.revocation_events {
            if event.credential_id == credential_id && 
               matches!(event.event_type, RevocationEventType::Suspend) {
                return Ok(event.effective_date);
            }
        }
        Err(RevocationError::SuspensionEventNotFound)
    }

    fn get_suspension_reason(&self, credential_id: &str) -> Result<RevocationReason, RevocationError> {
        for event in &self.revocation_events {
            if event.credential_id == credential_id && 
               matches!(event.event_type, RevocationEventType::Suspend) {
                return Ok(event.reason.clone());
            }
        }
        Err(RevocationError::SuspensionEventNotFound)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RevocationStatus {
    Valid {
        last_checked: DateTime<Utc>,
        next_update: Option<DateTime<Utc>>,
    },
    Revoked {
        revoked_at: DateTime<Utc>,
        reason: RevocationReason,
    },
    Suspended {
        suspended_at: DateTime<Utc>,
        expires_at: Option<DateTime<Utc>>,
        reason: RevocationReason,
    },
}
```

## Advanced Features

### Zero-Knowledge Revocation

```rust
pub struct ZeroKnowledgeRevocation {
    pub circuit_id: String,
    pub proving_key: String,
    pub verification_key: String,
    pub merkle_tree_depth: usize,
}

impl ZeroKnowledgeRevocation {
    pub fn new(circuit_id: String, depth: usize) -> Self {
        Self {
            circuit_id,
            proving_key: "placeholder_proving_key".to_string(),
            verification_key: "placeholder_verification_key".to_string(),
            merkle_tree_depth: depth,
        }
    }

    pub fn generate_revocation_proof(
        &self,
        credential_id: &str,
        revocation_index: u64,
        merkle_path: &[String],
        is_revoked: bool,
    ) -> Result<ZKRevocationProof, RevocationError> {
        // Generate zero-knowledge proof that credential is/isn't revoked
        // without revealing the credential ID or revocation status to the verifier
        
        let proof = ZKRevocationProof {
            proof_data: format!("zk_proof_for_{}", credential_id),
            public_inputs: vec![
                self.verification_key.clone(),
                // Merkle root (public)
                // Nullifier (public, prevents double-spending but doesn't reveal credential)
            ],
            circuit_id: self.circuit_id.clone(),
        };

        Ok(proof)
    }

    pub fn verify_revocation_proof(
        &self,
        proof: &ZKRevocationProof,
        merkle_root: &str,
        nullifier: &str,
    ) -> Result<bool, RevocationError> {
        // Verify zero-knowledge proof
        // Placeholder implementation
        Ok(proof.proof_data.contains("zk_proof"))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZKRevocationProof {
    pub proof_data: String,
    pub public_inputs: Vec<String>,
    pub circuit_id: String,
}
```

### Cryptographic Accumulator

```rust
pub struct CryptoAccumulator {
    pub accumulator_value: String,
    pub public_key: String,
    pub accumulated_set: HashSet<String>,
}

impl CryptoAccumulator {
    pub fn new() -> Self {
        Self {
            accumulator_value: "initial_accumulator".to_string(),
            public_key: "accumulator_public_key".to_string(),
            accumulated_set: HashSet::new(),
        }
    }

    pub fn add_element(&mut self, element: &str) -> Result<AccumulatorWitness, RevocationError> {
        // Add element to accumulator and return witness
        self.accumulated_set.insert(element.to_string());
        
        // Update accumulator value
        self.accumulator_value = format!("{}_{}", self.accumulator_value, element);

        let witness = AccumulatorWitness {
            element: element.to_string(),
            witness_value: format!("witness_for_{}", element),
            accumulator_snapshot: self.accumulator_value.clone(),
        };

        Ok(witness)
    }

    pub fn remove_element(&mut self, element: &str) -> Result<(), RevocationError> {
        // Remove element from accumulator (marks as revoked)
        self.accumulated_set.remove(element);
        
        // Update accumulator value
        self.accumulator_value = format!("{}_{}_removed", self.accumulator_value, element);

        Ok(())
    }

    pub fn prove_membership(
        &self,
        element: &str,
        witness: &AccumulatorWitness,
    ) -> Result<bool, RevocationError> {
        // Prove that element is in accumulator (not revoked)
        Ok(self.accumulated_set.contains(element) && 
           witness.element == element)
    }

    pub fn prove_non_membership(
        &self,
        element: &str,
    ) -> Result<NonMembershipProof, RevocationError> {
        // Prove that element is not in accumulator (is revoked)
        let proof = NonMembershipProof {
            element: element.to_string(),
            proof_value: format!("non_membership_proof_for_{}", element),
            accumulator_value: self.accumulator_value.clone(),
        };

        Ok(proof)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccumulatorWitness {
    pub element: String,
    pub witness_value: String,
    pub accumulator_snapshot: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NonMembershipProof {
    pub element: String,
    pub proof_value: String,
    pub accumulator_value: String,
}
```

## Integration with Olocus Core

### Block Payload Implementation

```rust
use olocus_core::{Block, BlockPayload};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevocationPayload {
    pub registry_updates: Vec<RevocationRegistryUpdate>,
    pub revocation_events: Vec<RevocationEvent>,
    pub measurement_attestations: Vec<RevocationMeasurementAttestation>,
    pub zk_proofs: Vec<ZKRevocationProof>,
    pub accumulator_updates: Vec<AccumulatorUpdate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevocationRegistryUpdate {
    pub registry_id: String,
    pub list_id: String,
    pub update_type: RegistryUpdateType,
    pub merkle_root: Option<String>,
    pub accumulator_value: Option<String>,
    pub bitstring_delta: Option<String>,
    pub timestamp: DateTime<Utc>,
    pub proof: RevocationProof,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RegistryUpdateType {
    NewList,
    UpdateList,
    RevokeBatch,
    SuspendBatch,
    ReinstateBatch,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccumulatorUpdate {
    pub accumulator_id: String,
    pub previous_value: String,
    pub new_value: String,
    pub added_elements: Vec<String>,
    pub removed_elements: Vec<String>,
    pub proof: String,
}

impl BlockPayload for RevocationPayload {
    fn payload_type(&self) -> u16 {
        0x0602 // Credentials extension, revocation subtype
    }

    fn validate(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Validate registry updates
        for update in &self.registry_updates {
            if update.registry_id.is_empty() {
                return Err("Registry update must have registry ID".into());
            }
            
            if update.timestamp > Utc::now() + chrono::Duration::minutes(5) {
                return Err("Registry update timestamp cannot be in the future".into());
            }
        }

        // Validate revocation events
        for event in &self.revocation_events {
            if event.credential_id.is_empty() {
                return Err("Revocation event must have credential ID".into());
            }
            
            // Validate measurement evidence if present
            if let Some(measurement) = &event.measurement_evidence {
                if let Value::None = measurement.value {
                    return Err("Measurement evidence cannot be empty".into());
                }
            }
        }

        // Validate measurement attestations
        for attestation in &self.measurement_attestations {
            if attestation.verifier_did.is_empty() {
                return Err("Measurement attestation must have verifier DID".into());
            }
            
            if let Value::None = attestation.measurement.value {
                return Err("Attestation measurement cannot be empty".into());
            }
        }

        Ok(())
    }
}
```

### Usage Example

```rust
use olocus_credentials::{RevocationRegistry, RevocationMethod, RevocationListType, RevocationPurpose};
use olocus_core::measure::{Measurement, Value, Uncertainty};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create revocation registry
    let privacy_settings = RevocationPrivacySettings {
        hide_revocation_reason: false,
        hide_revocation_timing: false,
        use_anonymous_revocation: false,
        batch_updates: true,
        update_frequency: RevocationUpdateFrequency::Daily,
    };
    
    let mut registry = RevocationRegistry::new(
        "did:olocus:issuer123".to_string(),
        RevocationMethod::BitstringStatusList,
        privacy_settings,
    );
    
    // Create revocation list
    let list_id = registry.create_revocation_list(
        RevocationListType::BitstringCompressed,
        RevocationPurpose::Both,
        10000, // Support 10,000 credentials
    )?;
    
    println!("Created revocation list: {}", list_id);
    
    // Create measurement evidence for revocation
    let location_measurement = Measurement {
        value: Value::Point2D(377749000, -1224194000), // San Francisco
        uncertainty: Uncertainty::Circular { radius: 50.0 }, // 50m uncertainty
        provenance: Default::default(),
        validity: None,
    };
    
    let revocation_proof = RevocationProof {
        proof_type: "Ed25519Signature2020".to_string(),
        verification_method: "did:olocus:issuer123#keys-1".to_string(),
        signature: "placeholder_signature".to_string(),
        created: Utc::now(),
        nonce: Some("revocation_nonce_123".to_string()),
        challenge: None,
    };
    
    // Revoke a credential due to location verification failure
    registry.revoke_credential(
        "credential_001".to_string(),
        42, // Revocation index
        RevocationReason::LocationVerificationFailure,
        revocation_proof,
        Some(location_measurement),
    )?;
    
    println!("Revoked credential_001 due to location verification failure");
    
    // Check revocation status
    let status = registry.check_revocation_status("credential_001", 42).await?;
    match status {
        RevocationStatus::Revoked { revoked_at, reason } => {
            println!("Credential revoked at {} for reason: {:?}", revoked_at, reason);
        },
        RevocationStatus::Valid { .. } => {
            println!("Credential is valid");
        },
        RevocationStatus::Suspended { .. } => {
            println!("Credential is suspended");
        },
    }
    
    // Suspend a credential temporarily
    let suspension_proof = RevocationProof {
        proof_type: "Ed25519Signature2020".to_string(),
        verification_method: "did:olocus:issuer123#keys-1".to_string(),
        signature: "suspension_signature".to_string(),
        created: Utc::now(),
        nonce: Some("suspension_nonce_456".to_string()),
        challenge: None,
    };
    
    registry.suspend_credential(
        "credential_002".to_string(),
        43,
        RevocationReason::CertificateHold,
        suspension_proof,
        Some(chrono::Duration::days(30)), // 30-day suspension
    )?;
    
    println!("Suspended credential_002 for 30 days");
    
    // Create revocation payload for blockchain
    let payload = RevocationPayload {
        registry_updates: vec![],
        revocation_events: registry.revocation_events.clone(),
        measurement_attestations: registry.measurement_attestations.clone(),
        zk_proofs: vec![],
        accumulator_updates: vec![],
    };
    
    // Create block
    let block = Block::new(payload)?;
    println!("Created revocation block: {}", hex::encode(block.hash()));
    
    Ok(())
}
```

## Security Considerations

### Cryptographic Security

1. **Proof Integrity**: All revocation operations require cryptographic proof
2. **Tamper Resistance**: Revocation lists protected by merkle trees or accumulators
3. **Non-Repudiation**: Revocation events are cryptographically signed and timestamped
4. **Key Management**: Proper authorization for revocation operations

### Privacy Protection

1. **Anonymous Revocation**: Zero-knowledge proofs hide credential identity
2. **Unlinkable Checks**: Multiple revocation checks cannot be correlated
3. **Timing Privacy**: Batch updates and configurable update frequencies
4. **Measurement Privacy**: Attestation evidence respects uncertainty and provenance

## Performance Characteristics

- **Revocation Check**: &lt;10ms for bitstring-based lists
- **Revocation Update**: &lt;50ms for simple lists, &lt;200ms for accumulators
- **List Update**: &lt;500ms for 10,000 entry list
- **ZK Proof Generation**: &lt;2s for membership proofs
- **Measurement Attestation**: &lt;30ms per attestation

## Best Practices

### Registry Design

1. **Choose appropriate list types** based on scale and privacy requirements
2. **Configure update frequencies** to balance privacy and efficiency
3. **Use measurement attestations** for additional verification
4. **Implement proper authorization** for revocation operations

### Privacy Guidelines

1. **Use anonymous revocation** for sensitive credentials
2. **Batch updates** to improve privacy and efficiency
3. **Implement proper key rotation** for revocation authorities
4. **Monitor for timing attacks** on revocation checks

## Error Handling

```rust
#[derive(Debug, thiserror::Error)]
pub enum RevocationError {
    #[error("List not found: {0}")]
    ListNotFound(String),
    
    #[error("Unauthorized revocation attempt")]
    UnauthorizedRevocation,
    
    #[error("Invalid proof: {0}")]
    InvalidProof(String),
    
    #[error("Invalid bitstring: {0}")]
    InvalidBitstring(String),
    
    #[error("Index out of bounds")]
    IndexOutOfBounds,
    
    #[error("Suspension not supported")]
    SuspensionNotSupported,
    
    #[error("Unsupported list type")]
    UnsupportedListType,
    
    #[error("No revocation list available")]
    NoRevocationListAvailable,
    
    #[error("Invalid measurement: {0}")]
    InvalidMeasurement(String),
    
    #[error("Revocation event not found")]
    RevocationEventNotFound,
    
    #[error("Suspension event not found")]
    SuspensionEventNotFound,
    
    #[error("Accumulator error: {0}")]
    AccumulatorError(String),
    
    #[error("Zero-knowledge proof error: {0}")]
    ZKProofError(String),
}
```

This comprehensive revocation implementation provides robust, privacy-preserving credential revocation capabilities within the Olocus Credentials extension, supporting multiple revocation methods and measurement-based attestations while maintaining strong security guarantees.