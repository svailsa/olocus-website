---
id: post-quantum
title: Post-Quantum Cryptography
sidebar_position: 5
---

# Post-Quantum Cryptography

The PQC extension provides post-quantum cryptographic algorithms and migration strategies to protect against quantum computing threats while maintaining interoperability with classical systems.

## Overview

The Post-Quantum Cryptography extension implements NIST-standardized algorithms and provides comprehensive migration support:

- **Signatures**: Dilithium (lattice-based), FALCON (lattice-based)
- **Key Exchange**: ML-KEM/Kyber (lattice-based)
- **Hybrid Modes**: Classical + PQC combinations
- **Migration**: Gradual transition strategies
- **Agility**: Algorithm negotiation and flexibility
- **Performance**: Optimized implementations and benchmarking

```rust
use olocus_pqc::*;

// Configure post-quantum cryptography
let pqc_config = PQCConfig {
    mode: PQCMode::Hybrid {
        classical: ClassicalAlgorithm::Ed25519,
        post_quantum: PQAlgorithm::Dilithium3,
        signature_format: HybridFormat::Concatenated,
    },
    migration_policy: MigrationPolicy {
        phase: MigrationPhase::HybridTransition,
        fallback_to_classical: true,
        require_pq_support: false,
    },
    performance_profile: PerformanceProfile::Balanced,
};

let pqc_manager = PQCManager::new(pqc_config)?;
```

## Dilithium Digital Signatures

Dilithium is NIST's primary post-quantum digital signature standard (FIPS 204):

### Dilithium Implementation

```rust
use olocus_pqc::signature::dilithium::*;
use crystal_dilithium::{Dilithium3, Keypair, Signature};

pub struct DilithiumSigner {
    variant: DilithiumVariant,
    keypair: Option<DilithiumKeypair>,
}

#[derive(Debug, Clone)]
pub enum DilithiumVariant {
    Dilithium2,  // ~128-bit security, smaller keys/signatures
    Dilithium3,  // ~192-bit security, recommended for most uses
    Dilithium5,  // ~256-bit security, maximum security
}

#[derive(Debug, Clone)]
pub struct DilithiumKeypair {
    pub public_key: Vec<u8>,     // 1312 bytes (Dilithium3)
    pub private_key: Vec<u8>,    // 2560 bytes (Dilithium3)
    pub variant: DilithiumVariant,
}

impl PQSignatureAlgorithm for DilithiumSigner {
    type Keypair = DilithiumKeypair;
    type Signature = DilithiumSignature;
    
    fn generate_keypair(&mut self, variant: DilithiumVariant) -> Result<DilithiumKeypair> {
        let keypair = match variant {
            DilithiumVariant::Dilithium2 => {
                let (public, private) = crystal_dilithium::dilithium2::keypair();
                DilithiumKeypair {
                    public_key: public.as_bytes().to_vec(),
                    private_key: private.as_bytes().to_vec(),
                    variant,
                }
            },
            DilithiumVariant::Dilithium3 => {
                let (public, private) = crystal_dilithium::dilithium3::keypair();
                DilithiumKeypair {
                    public_key: public.as_bytes().to_vec(),
                    private_key: private.as_bytes().to_vec(),
                    variant,
                }
            },
            DilithiumVariant::Dilithium5 => {
                let (public, private) = crystal_dilithium::dilithium5::keypair();
                DilithiumKeypair {
                    public_key: public.as_bytes().to_vec(),
                    private_key: private.as_bytes().to_vec(),
                    variant,
                }
            }
        };
        
        self.keypair = Some(keypair.clone());
        Ok(keypair)
    }
    
    fn sign(&self, message: &[u8]) -> Result<DilithiumSignature> {
        let keypair = self.keypair.as_ref()
            .ok_or(PQCError::NoKeypairGenerated)?;
            
        let signature_bytes = match keypair.variant {
            DilithiumVariant::Dilithium2 => {
                let private_key = crystal_dilithium::dilithium2::PrivateKey::from_bytes(&keypair.private_key)
                    .map_err(|e| PQCError::InvalidKey(e.to_string()))?;
                let signature = crystal_dilithium::dilithium2::sign(message, &private_key);
                signature.as_bytes().to_vec()
            },
            DilithiumVariant::Dilithium3 => {
                let private_key = crystal_dilithium::dilithium3::PrivateKey::from_bytes(&keypair.private_key)
                    .map_err(|e| PQCError::InvalidKey(e.to_string()))?;
                let signature = crystal_dilithium::dilithium3::sign(message, &private_key);
                signature.as_bytes().to_vec()
            },
            DilithiumVariant::Dilithium5 => {
                let private_key = crystal_dilithium::dilithium5::PrivateKey::from_bytes(&keypair.private_key)
                    .map_err(|e| PQCError::InvalidKey(e.to_string()))?;
                let signature = crystal_dilithium::dilithium5::sign(message, &private_key);
                signature.as_bytes().to_vec()
            }
        };
        
        Ok(DilithiumSignature {
            signature: signature_bytes,
            variant: keypair.variant.clone(),
            algorithm_id: AlgorithmId::Dilithium(keypair.variant.clone()),
        })
    }
    
    fn verify(&self, message: &[u8], signature: &DilithiumSignature, public_key: &[u8]) -> Result<bool> {
        match signature.variant {
            DilithiumVariant::Dilithium2 => {
                let pk = crystal_dilithium::dilithium2::PublicKey::from_bytes(public_key)
                    .map_err(|e| PQCError::InvalidKey(e.to_string()))?;
                let sig = crystal_dilithium::dilithium2::Signature::from_bytes(&signature.signature)
                    .map_err(|e| PQCError::InvalidSignature(e.to_string()))?;
                    
                Ok(crystal_dilithium::dilithium2::verify(message, &sig, &pk))
            },
            DilithiumVariant::Dilithium3 => {
                let pk = crystal_dilithium::dilithium3::PublicKey::from_bytes(public_key)
                    .map_err(|e| PQCError::InvalidKey(e.to_string()))?;
                let sig = crystal_dilithium::dilithium3::Signature::from_bytes(&signature.signature)
                    .map_err(|e| PQCError::InvalidSignature(e.to_string()))?;
                    
                Ok(crystal_dilithium::dilithium3::verify(message, &sig, &pk))
            },
            DilithiumVariant::Dilithium5 => {
                let pk = crystal_dilithium::dilithium5::PublicKey::from_bytes(public_key)
                    .map_err(|e| PQCError::InvalidKey(e.to_string()))?;
                let sig = crystal_dilithium::dilithium5::Signature::from_bytes(&signature.signature)
                    .map_err(|e| PQCError::InvalidSignature(e.to_string()))?;
                    
                Ok(crystal_dilithium::dilithium5::verify(message, &sig, &pk))
            }
        }
    }
}
```

### FALCON Signatures

FALCON provides more compact signatures than Dilithium:

```rust
use olocus_pqc::signature::falcon::*;

pub struct FalconSigner {
    variant: FalconVariant,
    keypair: Option<FalconKeypair>,
}

#[derive(Debug, Clone)]
pub enum FalconVariant {
    Falcon512,   // ~128-bit security, ~1280 byte signatures
    Falcon1024,  // ~256-bit security, ~2560 byte signatures
}

impl PQSignatureAlgorithm for FalconSigner {
    type Keypair = FalconKeypair;
    type Signature = FalconSignature;
    
    fn generate_keypair(&mut self, variant: FalconVariant) -> Result<FalconKeypair> {
        let (public_key, private_key) = match variant {
            FalconVariant::Falcon512 => {
                let (pk, sk) = falcon::falcon512::keypair(&mut rand::thread_rng());
                (pk.as_bytes().to_vec(), sk.as_bytes().to_vec())
            },
            FalconVariant::Falcon1024 => {
                let (pk, sk) = falcon::falcon1024::keypair(&mut rand::thread_rng());
                (pk.as_bytes().to_vec(), sk.as_bytes().to_vec())
            }
        };
        
        let keypair = FalconKeypair {
            public_key,
            private_key,
            variant: variant.clone(),
        };
        
        self.keypair = Some(keypair.clone());
        Ok(keypair)
    }
    
    fn sign(&self, message: &[u8]) -> Result<FalconSignature> {
        let keypair = self.keypair.as_ref()
            .ok_or(PQCError::NoKeypairGenerated)?;
            
        let signature_bytes = match keypair.variant {
            FalconVariant::Falcon512 => {
                let private_key = falcon::falcon512::PrivateKey::from_bytes(&keypair.private_key)
                    .map_err(|e| PQCError::InvalidKey(e.to_string()))?;
                let signature = falcon::falcon512::sign(message, &private_key, &mut rand::thread_rng());
                signature.as_bytes().to_vec()
            },
            FalconVariant::Falcon1024 => {
                let private_key = falcon::falcon1024::PrivateKey::from_bytes(&keypair.private_key)
                    .map_err(|e| PQCError::InvalidKey(e.to_string()))?;
                let signature = falcon::falcon1024::sign(message, &private_key, &mut rand::thread_rng());
                signature.as_bytes().to_vec()
            }
        };
        
        Ok(FalconSignature {
            signature: signature_bytes,
            variant: keypair.variant.clone(),
            algorithm_id: AlgorithmId::Falcon(keypair.variant.clone()),
        })
    }
}
```

## ML-KEM Key Encapsulation

ML-KEM (Module Lattice Key Encapsulation Mechanism), formerly Kyber, provides post-quantum key exchange:

### ML-KEM Implementation

```rust
use olocus_pqc::kem::mlkem::*;
use kyber::{Kyber512, Kyber768, Kyber1024};

pub struct MLKEMEncapsulator {
    variant: MLKEMVariant,
    keypair: Option<MLKEMKeypair>,
}

#[derive(Debug, Clone)]
pub enum MLKEMVariant {
    MLKEM512,    // ~128-bit security
    MLKEM768,    // ~192-bit security (recommended)
    MLKEM1024,   // ~256-bit security
}

#[derive(Debug, Clone)]
pub struct MLKEMKeypair {
    pub public_key: Vec<u8>,
    pub private_key: Vec<u8>,
    pub variant: MLKEMVariant,
}

impl PQKEMAlgorithm for MLKEMEncapsulator {
    type Keypair = MLKEMKeypair;
    type Ciphertext = MLKEMCiphertext;
    type SharedSecret = [u8; 32];  // 256-bit shared secret
    
    fn generate_keypair(&mut self, variant: MLKEMVariant) -> Result<MLKEMKeypair> {
        let (public_key, private_key) = match variant {
            MLKEMVariant::MLKEM512 => {
                let (pk, sk) = kyber::kyber512::keypair(&mut rand::thread_rng());
                (pk.as_bytes().to_vec(), sk.as_bytes().to_vec())
            },
            MLKEMVariant::MLKEM768 => {
                let (pk, sk) = kyber::kyber768::keypair(&mut rand::thread_rng());
                (pk.as_bytes().to_vec(), sk.as_bytes().to_vec())
            },
            MLKEMVariant::MLKEM1024 => {
                let (pk, sk) = kyber::kyber1024::keypair(&mut rand::thread_rng());
                (pk.as_bytes().to_vec(), sk.as_bytes().to_vec())
            }
        };
        
        let keypair = MLKEMKeypair {
            public_key,
            private_key,
            variant: variant.clone(),
        };
        
        self.keypair = Some(keypair.clone());
        Ok(keypair)
    }
    
    fn encapsulate(&self, public_key: &[u8]) -> Result<(Self::Ciphertext, Self::SharedSecret)> {
        let keypair = self.keypair.as_ref()
            .ok_or(PQCError::NoKeypairGenerated)?;
            
        match keypair.variant {
            MLKEMVariant::MLKEM512 => {
                let pk = kyber::kyber512::PublicKey::from_bytes(public_key)
                    .map_err(|e| PQCError::InvalidKey(e.to_string()))?;
                let (ciphertext, shared_secret) = kyber::kyber512::encapsulate(&pk, &mut rand::thread_rng());
                
                Ok((
                    MLKEMCiphertext {
                        ciphertext: ciphertext.as_bytes().to_vec(),
                        variant: keypair.variant.clone(),
                    },
                    shared_secret.as_bytes().try_into().unwrap()
                ))
            },
            MLKEMVariant::MLKEM768 => {
                let pk = kyber::kyber768::PublicKey::from_bytes(public_key)
                    .map_err(|e| PQCError::InvalidKey(e.to_string()))?;
                let (ciphertext, shared_secret) = kyber::kyber768::encapsulate(&pk, &mut rand::thread_rng());
                
                Ok((
                    MLKEMCiphertext {
                        ciphertext: ciphertext.as_bytes().to_vec(),
                        variant: keypair.variant.clone(),
                    },
                    shared_secret.as_bytes().try_into().unwrap()
                ))
            },
            MLKEMVariant::MLKEM1024 => {
                let pk = kyber::kyber1024::PublicKey::from_bytes(public_key)
                    .map_err(|e| PQCError::InvalidKey(e.to_string()))?;
                let (ciphertext, shared_secret) = kyber::kyber1024::encapsulate(&pk, &mut rand::thread_rng());
                
                Ok((
                    MLKEMCiphertext {
                        ciphertext: ciphertext.as_bytes().to_vec(),
                        variant: keypair.variant.clone(),
                    },
                    shared_secret.as_bytes().try_into().unwrap()
                ))
            }
        }
    }
    
    fn decapsulate(&self, ciphertext: &Self::Ciphertext) -> Result<Self::SharedSecret> {
        let keypair = self.keypair.as_ref()
            .ok_or(PQCError::NoKeypairGenerated)?;
            
        match ciphertext.variant {
            MLKEMVariant::MLKEM512 => {
                let private_key = kyber::kyber512::PrivateKey::from_bytes(&keypair.private_key)
                    .map_err(|e| PQCError::InvalidKey(e.to_string()))?;
                let ct = kyber::kyber512::Ciphertext::from_bytes(&ciphertext.ciphertext)
                    .map_err(|e| PQCError::InvalidCiphertext(e.to_string()))?;
                    
                let shared_secret = kyber::kyber512::decapsulate(&ct, &private_key);
                Ok(shared_secret.as_bytes().try_into().unwrap())
            },
            MLKEMVariant::MLKEM768 => {
                let private_key = kyber::kyber768::PrivateKey::from_bytes(&keypair.private_key)
                    .map_err(|e| PQCError::InvalidKey(e.to_string()))?;
                let ct = kyber::kyber768::Ciphertext::from_bytes(&ciphertext.ciphertext)
                    .map_err(|e| PQCError::InvalidCiphertext(e.to_string()))?;
                    
                let shared_secret = kyber::kyber768::decapsulate(&ct, &private_key);
                Ok(shared_secret.as_bytes().try_into().unwrap())
            },
            MLKEMVariant::MLKEM1024 => {
                let private_key = kyber::kyber1024::PrivateKey::from_bytes(&keypair.private_key)
                    .map_err(|e| PQCError::InvalidKey(e.to_string()))?;
                let ct = kyber::kyber1024::Ciphertext::from_bytes(&ciphertext.ciphertext)
                    .map_err(|e| PQCError::InvalidCiphertext(e.to_string()))?;
                    
                let shared_secret = kyber::kyber1024::decapsulate(&ct, &private_key);
                Ok(shared_secret.as_bytes().try_into().unwrap())
            }
        }
    }
}
```

## Hybrid Cryptography

Hybrid approaches combine classical and post-quantum algorithms for security and backwards compatibility:

### Hybrid Signatures

```rust
use olocus_pqc::hybrid::signature::*;

pub struct HybridSignatureManager {
    classical_signer: Ed25519Signer,
    pq_signer: DilithiumSigner,
    format: HybridFormat,
}

#[derive(Debug, Clone)]
pub enum HybridFormat {
    Concatenated,    // classical_sig || pq_sig
    Structured,      // ASN.1 structure with both signatures
    Nested,          // Sign(classical_sig || message) with PQ
}

#[derive(Debug, Clone)]
pub struct HybridSignature {
    pub classical_signature: Vec<u8>,
    pub pq_signature: Vec<u8>,
    pub format: HybridFormat,
    pub classical_algorithm: ClassicalAlgorithm,
    pub pq_algorithm: PQAlgorithm,
}

impl HybridSignatureManager {
    pub fn sign(&self, message: &[u8]) -> Result<HybridSignature> {
        // Sign with classical algorithm
        let classical_sig = self.classical_signer.sign(message)?;
        
        // Sign with post-quantum algorithm
        let pq_sig = match self.format {
            HybridFormat::Concatenated | HybridFormat::Structured => {
                // Independent signatures
                self.pq_signer.sign(message)?
            },
            HybridFormat::Nested => {
                // Sign the classical signature + message
                let combined_data = [&classical_sig, message].concat();
                self.pq_signer.sign(&combined_data)?
            }
        };
        
        Ok(HybridSignature {
            classical_signature: classical_sig,
            pq_signature: pq_sig.signature,
            format: self.format.clone(),
            classical_algorithm: ClassicalAlgorithm::Ed25519,
            pq_algorithm: PQAlgorithm::Dilithium3,
        })
    }
    
    pub fn verify(
        &self,
        message: &[u8],
        signature: &HybridSignature,
        classical_pk: &[u8],
        pq_pk: &[u8]
    ) -> Result<bool> {
        // Verify classical signature
        let classical_valid = self.classical_signer.verify(
            message,
            &signature.classical_signature,
            classical_pk
        )?;
        
        // Verify post-quantum signature
        let pq_valid = match signature.format {
            HybridFormat::Concatenated | HybridFormat::Structured => {
                // Independent verification
                let pq_sig = DilithiumSignature {
                    signature: signature.pq_signature.clone(),
                    variant: DilithiumVariant::Dilithium3,
                    algorithm_id: AlgorithmId::Dilithium(DilithiumVariant::Dilithium3),
                };
                self.pq_signer.verify(message, &pq_sig, pq_pk)?
            },
            HybridFormat::Nested => {
                // Verify against classical signature + message
                let combined_data = [&signature.classical_signature, message].concat();
                let pq_sig = DilithiumSignature {
                    signature: signature.pq_signature.clone(),
                    variant: DilithiumVariant::Dilithium3,
                    algorithm_id: AlgorithmId::Dilithium(DilithiumVariant::Dilithium3),
                };
                self.pq_signer.verify(&combined_data, &pq_sig, pq_pk)?
            }
        };
        
        // Both signatures must be valid
        Ok(classical_valid && pq_valid)
    }
    
    pub fn serialize(&self, signature: &HybridSignature) -> Result<Vec<u8>> {
        match signature.format {
            HybridFormat::Concatenated => {
                // Simple concatenation: classical_len (4) || classical_sig || pq_sig
                let mut serialized = Vec::new();
                serialized.extend_from_slice(&(signature.classical_signature.len() as u32).to_be_bytes());
                serialized.extend_from_slice(&signature.classical_signature);
                serialized.extend_from_slice(&signature.pq_signature);
                Ok(serialized)
            },
            HybridFormat::Structured => {
                // ASN.1 DER encoding
                self.serialize_asn1(signature)
            },
            HybridFormat::Nested => {
                // Only PQ signature (contains classical signature)
                Ok(signature.pq_signature.clone())
            }
        }
    }
    
    fn serialize_asn1(&self, signature: &HybridSignature) -> Result<Vec<u8>> {
        use yasna::construct_der;
        
        let der = construct_der(|writer| {
            writer.write_sequence(|writer| {
                // Classical algorithm OID
                writer.next().write_oid(&signature.classical_algorithm.oid());
                // Classical signature
                writer.next().write_bytes(&signature.classical_signature);
                // PQ algorithm OID  
                writer.next().write_oid(&signature.pq_algorithm.oid());
                // PQ signature
                writer.next().write_bytes(&signature.pq_signature);
            })
        });
        
        Ok(der)
    }
}
```

### Hybrid Key Exchange

```rust
use olocus_pqc::hybrid::kem::*;

pub struct HybridKEM {
    classical_kem: X25519KEM,
    pq_kem: MLKEMEncapsulator,
    combiner: KeyCombiner,
}

#[derive(Debug, Clone)]
pub enum KeyCombiner {
    Concatenate,     // classical_secret || pq_secret
    XOR,             // classical_secret ⊕ pq_secret (same length required)
    HKDF,            // HKDF(classical_secret || pq_secret)
    KDF1,            // Standard KDF1
}

impl HybridKEM {
    pub fn encapsulate(&self, classical_pk: &[u8], pq_pk: &[u8]) -> Result<(HybridCiphertext, [u8; 32])> {
        // Classical key encapsulation
        let (classical_ct, classical_secret) = self.classical_kem.encapsulate(classical_pk)?;
        
        // Post-quantum key encapsulation
        let (pq_ct, pq_secret) = self.pq_kem.encapsulate(pq_pk)?;
        
        // Combine shared secrets
        let combined_secret = self.combine_secrets(&classical_secret, &pq_secret)?;
        
        Ok((
            HybridCiphertext {
                classical_ciphertext: classical_ct,
                pq_ciphertext: pq_ct,
            },
            combined_secret
        ))
    }
    
    pub fn decapsulate(&self, hybrid_ct: &HybridCiphertext) -> Result<[u8; 32]> {
        // Classical decapsulation
        let classical_secret = self.classical_kem.decapsulate(&hybrid_ct.classical_ciphertext)?;
        
        // Post-quantum decapsulation
        let pq_secret = self.pq_kem.decapsulate(&hybrid_ct.pq_ciphertext)?;
        
        // Combine shared secrets
        self.combine_secrets(&classical_secret, &pq_secret)
    }
    
    fn combine_secrets(&self, classical: &[u8], pq: &[u8]) -> Result<[u8; 32]> {
        match self.combiner {
            KeyCombiner::Concatenate => {
                let combined = [classical, pq].concat();
                let hash = sha256::digest(&combined);
                Ok(hash.into())
            },
            KeyCombiner::XOR => {
                if classical.len() != 32 || pq.len() != 32 {
                    return Err(PQCError::InvalidSecretLength);
                }
                
                let mut result = [0u8; 32];
                for i in 0..32 {
                    result[i] = classical[i] ^ pq[i];
                }
                Ok(result)
            },
            KeyCombiner::HKDF => {
                let salt = b"olocus-hybrid-kdf";
                let info = b"hybrid-shared-secret";
                
                let prk = hkdf::Hkdf::<sha2::Sha256>::new(Some(salt), &[classical, pq].concat());
                let mut okm = [0u8; 32];
                prk.expand(info, &mut okm)
                    .map_err(|e| PQCError::KDFError(e.to_string()))?;
                Ok(okm)
            },
            KeyCombiner::KDF1 => {
                // Implement KDF1 per IEEE 1363-2000
                self.kdf1(&[classical, pq].concat(), 32)
            }
        }
    }
}
```

## Migration Strategies

### Gradual Migration Framework

```rust
use olocus_pqc::migration::*;

pub struct PQMigrationManager {
    current_phase: MigrationPhase,
    migration_policy: MigrationPolicy,
    capability_detector: CapabilityDetector,
    fallback_manager: FallbackManager,
}

#[derive(Debug, Clone)]
pub enum MigrationPhase {
    ClassicalOnly,               // Traditional algorithms only
    HybridIntroduction,         // Hybrid available but optional
    HybridTransition,           // Hybrid preferred, classical fallback
    HybridMandatory,            // Hybrid required for new connections
    PostQuantumOnly,            // Pure PQ algorithms
}

#[derive(Debug, Clone)]
pub struct MigrationPolicy {
    pub phase: MigrationPhase,
    pub transition_timeline: TransitionTimeline,
    pub fallback_to_classical: bool,
    pub require_pq_support: bool,
    pub migration_triggers: Vec<MigrationTrigger>,
}

#[derive(Debug, Clone)]
pub enum MigrationTrigger {
    TimeBasedSchedule(SystemTime),      // Migrate at specific time
    SecurityLevelChange,                 // When threat level changes
    PeerCapabilityDetected,             // When peer supports PQ
    ComplianceRequirement,              // Regulatory requirement
    PerformanceThreshold(f64),          // When PQ performance acceptable
}

impl PQMigrationManager {
    pub async fn negotiate_algorithms(
        &self,
        peer_id: &str,
        local_capabilities: &PQCapabilities,
        peer_capabilities: &PQCapabilities
    ) -> Result<NegotiatedAlgorithms> {
        
        // Check current migration phase requirements
        let phase_requirements = self.get_phase_requirements();
        
        // Find compatible algorithms
        let compatible_signatures = self.find_compatible_signatures(
            local_capabilities,
            peer_capabilities,
            &phase_requirements
        )?;
        
        let compatible_kems = self.find_compatible_kems(
            local_capabilities,
            peer_capabilities,
            &phase_requirements
        )?;
        
        // Select optimal algorithms based on policy
        let selected_signature = self.select_optimal_signature(&compatible_signatures)?;
        let selected_kem = self.select_optimal_kem(&compatible_kems)?;
        
        Ok(NegotiatedAlgorithms {
            signature: selected_signature,
            kem: selected_kem,
            hybrid_mode: self.determine_hybrid_mode(&phase_requirements),
            fallback_available: self.migration_policy.fallback_to_classical,
        })
    }
    
    fn find_compatible_signatures(
        &self,
        local: &PQCapabilities,
        peer: &PQCapabilities,
        requirements: &PhaseRequirements
    ) -> Result<Vec<SignatureAlgorithm>> {
        let mut compatible = Vec::new();
        
        match self.current_phase {
            MigrationPhase::ClassicalOnly => {
                // Only classical algorithms
                for alg in &local.classical_signatures {
                    if peer.classical_signatures.contains(alg) {
                        compatible.push(SignatureAlgorithm::Classical(*alg));
                    }
                }
            },
            MigrationPhase::HybridIntroduction | MigrationPhase::HybridTransition => {
                // Prefer hybrid, fall back to classical
                for classical in &local.classical_signatures {
                    for pq in &local.pq_signatures {
                        if peer.classical_signatures.contains(classical) &&
                           peer.pq_signatures.contains(pq) {
                            compatible.push(SignatureAlgorithm::Hybrid {
                                classical: *classical,
                                post_quantum: *pq,
                            });
                        }
                    }
                }
                
                // Add classical fallbacks if policy allows
                if self.migration_policy.fallback_to_classical {
                    for alg in &local.classical_signatures {
                        if peer.classical_signatures.contains(alg) {
                            compatible.push(SignatureAlgorithm::Classical(*alg));
                        }
                    }
                }
            },
            MigrationPhase::HybridMandatory => {
                // Only hybrid algorithms
                for classical in &local.classical_signatures {
                    for pq in &local.pq_signatures {
                        if peer.classical_signatures.contains(classical) &&
                           peer.pq_signatures.contains(pq) {
                            compatible.push(SignatureAlgorithm::Hybrid {
                                classical: *classical,
                                post_quantum: *pq,
                            });
                        }
                    }
                }
            },
            MigrationPhase::PostQuantumOnly => {
                // Only post-quantum algorithms
                for alg in &local.pq_signatures {
                    if peer.pq_signatures.contains(alg) {
                        compatible.push(SignatureAlgorithm::PostQuantum(*alg));
                    }
                }
            }
        }
        
        if compatible.is_empty() {
            return Err(PQCError::NoCompatibleAlgorithms);
        }
        
        Ok(compatible)
    }
    
    pub async fn schedule_migration_phase_transition(&mut self, target_phase: MigrationPhase, transition_time: SystemTime) -> Result<()> {
        // Validate transition is allowed
        self.validate_phase_transition(&self.current_phase, &target_phase)?;
        
        // Schedule the transition
        let migration_task = MigrationTask {
            task_id: Uuid::new_v4().to_string(),
            current_phase: self.current_phase.clone(),
            target_phase: target_phase.clone(),
            scheduled_time: transition_time,
            preparation_tasks: self.generate_preparation_tasks(&target_phase)?,
        };
        
        self.schedule_migration_task(migration_task).await?;
        
        Ok(())
    }
    
    fn validate_phase_transition(&self, current: &MigrationPhase, target: &MigrationPhase) -> Result<()> {
        use MigrationPhase::*;
        
        let valid_transition = match (current, target) {
            (ClassicalOnly, HybridIntroduction) => true,
            (HybridIntroduction, HybridTransition) => true,
            (HybridTransition, HybridMandatory) => true,
            (HybridMandatory, PostQuantumOnly) => true,
            // Allow backwards transitions for emergency rollback
            (HybridIntroduction, ClassicalOnly) => true,
            (HybridTransition, HybridIntroduction) => true,
            (HybridMandatory, HybridTransition) => true,
            (PostQuantumOnly, HybridMandatory) => true,
            _ => false,
        };
        
        if !valid_transition {
            return Err(PQCError::InvalidPhaseTransition {
                current: current.clone(),
                target: target.clone(),
            });
        }
        
        Ok(())
    }
    
    fn generate_preparation_tasks(&self, target_phase: &MigrationPhase) -> Result<Vec<PreparationTask>> {
        let mut tasks = Vec::new();
        
        match target_phase {
            MigrationPhase::HybridIntroduction => {
                tasks.push(PreparationTask::GenerateHybridKeypairs);
                tasks.push(PreparationTask::UpdateCapabilityAdvertisement);
                tasks.push(PreparationTask::ConfigureFallbackPolicies);
            },
            MigrationPhase::HybridTransition => {
                tasks.push(PreparationTask::PromoteHybridAlgorithms);
                tasks.push(PreparationTask::DeprecateClassicalOnlyMode);
                tasks.push(PreparationTask::UpdateSecurityPolicies);
            },
            MigrationPhase::HybridMandatory => {
                tasks.push(PreparationTask::RequireHybridSupport);
                tasks.push(PreparationTask::DisableClassicalFallback);
                tasks.push(PreparationTask::AuditConnections);
            },
            MigrationPhase::PostQuantumOnly => {
                tasks.push(PreparationTask::GeneratePostQuantumKeypairs);
                tasks.push(PreparationTask::MigrateExistingKeys);
                tasks.push(PreparationTask::DisableClassicalAlgorithms);
            },
            _ => {}
        }
        
        Ok(tasks)
    }
}
```

## Algorithm Negotiation

### Capability-Based Negotiation

```rust
use olocus_pqc::negotiation::*;

pub struct PQNegotiator {
    local_capabilities: PQCapabilities,
    algorithm_preferences: AlgorithmPreferences,
    security_requirements: SecurityRequirements,
}

#[derive(Debug, Clone)]
pub struct PQCapabilities {
    pub classical_signatures: Vec<ClassicalSignature>,
    pub pq_signatures: Vec<PQSignature>,
    pub classical_kems: Vec<ClassicalKEM>,
    pub pq_kems: Vec<PQKEM>,
    pub hybrid_support: bool,
    pub performance_profiles: Vec<PerformanceProfile>,
}

#[derive(Debug, Clone)]
pub struct AlgorithmPreferences {
    pub signature_preference_order: Vec<SignatureAlgorithmId>,
    pub kem_preference_order: Vec<KEMAlgorithmId>,
    pub security_level_priority: SecurityLevelPriority,
    pub performance_priority: PerformancePriority,
}

impl PQNegotiator {
    pub fn negotiate_signature_algorithm(
        &self,
        peer_capabilities: &PQCapabilities,
        context: &NegotiationContext
    ) -> Result<SignatureAlgorithmChoice> {
        
        // Filter algorithms based on security requirements
        let mut candidates = self.filter_by_security_requirements(
            &self.local_capabilities.get_all_signature_algorithms(),
            peer_capabilities
        )?;
        
        // Apply context-specific filters
        candidates = self.apply_context_filters(candidates, context)?;
        
        // Score algorithms based on preferences
        let scored_candidates: Vec<_> = candidates.into_iter()
            .map(|alg| (alg.clone(), self.score_signature_algorithm(&alg, context)))
            .collect();
            
        // Sort by score (highest first)
        let mut sorted_candidates = scored_candidates;
        sorted_candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        
        // Select best algorithm
        let selected_algorithm = sorted_candidates.into_iter()
            .next()
            .ok_or(PQCError::NoSuitableAlgorithm)?
            .0;
            
        Ok(SignatureAlgorithmChoice {
            algorithm: selected_algorithm,
            rationale: self.generate_selection_rationale(&selected_algorithm, context),
            fallback_algorithms: self.generate_fallback_list(peer_capabilities)?,
        })
    }
    
    fn score_signature_algorithm(&self, algorithm: &SignatureAlgorithmId, context: &NegotiationContext) -> f64 {
        let mut score = 0.0;
        
        // Security level scoring
        let security_score = match algorithm.security_level() {
            SecurityLevel::Level128 => 1.0,
            SecurityLevel::Level192 => 1.5,
            SecurityLevel::Level256 => 2.0,
            SecurityLevel::PQLevel3 => 2.5,
            SecurityLevel::PQLevel5 => 3.0,
        };
        
        score += security_score * self.algorithm_preferences.security_level_priority.weight();
        
        // Performance scoring
        let performance_score = self.estimate_performance_score(algorithm, context);
        score += performance_score * self.algorithm_preferences.performance_priority.weight();
        
        // Preference order scoring
        let preference_score = self.calculate_preference_score(algorithm);
        score += preference_score;
        
        // Future-proofing scoring
        let future_proof_score = match algorithm {
            SignatureAlgorithmId::Hybrid { .. } => 1.0,  // Good for transition
            SignatureAlgorithmId::PostQuantum(_) => 1.5, // Best for future
            SignatureAlgorithmId::Classical(_) => 0.5,   // Legacy
        };
        score += future_proof_score * 0.3;
        
        score
    }
    
    fn estimate_performance_score(&self, algorithm: &SignatureAlgorithmId, context: &NegotiationContext) -> f64 {
        // Get performance characteristics
        let characteristics = algorithm.get_performance_characteristics();
        
        let mut performance_score = 0.0;
        
        // Key generation performance
        performance_score += self.score_operation_time(
            characteristics.keygen_time,
            context.keygen_frequency
        );
        
        // Signing performance
        performance_score += self.score_operation_time(
            characteristics.sign_time,
            context.signing_frequency
        ) * 2.0; // Weight signing more heavily
        
        // Verification performance
        performance_score += self.score_operation_time(
            characteristics.verify_time,
            context.verification_frequency
        ) * 1.5; // Weight verification highly
        
        // Size considerations
        let size_penalty = self.calculate_size_penalty(
            characteristics.signature_size,
            context.bandwidth_constraints
        );
        performance_score -= size_penalty;
        
        performance_score.max(0.0)
    }
}
```

## Performance Optimization

### Performance Benchmarking

```rust
use olocus_pqc::benchmark::*;

pub struct PQBenchmarkSuite {
    algorithms: Vec<Box<dyn PQAlgorithm>>,
    test_data_sizes: Vec<usize>,
    iterations: usize,
}

#[derive(Debug, Clone)]
pub struct BenchmarkResults {
    pub algorithm: AlgorithmId,
    pub keygen_time: Duration,
    pub keygen_stddev: Duration,
    pub sign_time: Duration,
    pub sign_stddev: Duration,
    pub verify_time: Duration,
    pub verify_stddev: Duration,
    pub key_size: usize,
    pub signature_size: usize,
    pub throughput: BenchmarkThroughput,
}

#[derive(Debug, Clone)]
pub struct BenchmarkThroughput {
    pub signings_per_second: f64,
    pub verifications_per_second: f64,
    pub bytes_per_second_signing: f64,
    pub bytes_per_second_verification: f64,
}

impl PQBenchmarkSuite {
    pub async fn run_comprehensive_benchmark(&self) -> Result<Vec<BenchmarkResults>> {
        let mut all_results = Vec::new();
        
        for algorithm in &self.algorithms {
            let results = self.benchmark_algorithm(algorithm.as_ref()).await?;
            all_results.push(results);
        }
        
        // Sort by overall performance score
        all_results.sort_by(|a, b| {
            let score_a = self.calculate_overall_score(a);
            let score_b = self.calculate_overall_score(b);
            score_b.partial_cmp(&score_a).unwrap_or(std::cmp::Ordering::Equal)
        });
        
        Ok(all_results)
    }
    
    async fn benchmark_algorithm(&self, algorithm: &dyn PQAlgorithm) -> Result<BenchmarkResults> {
        let mut keygen_times = Vec::new();
        let mut sign_times = Vec::new();
        let mut verify_times = Vec::new();
        
        let test_message = b"Hello, post-quantum world!";
        
        // Benchmark key generation
        for _ in 0..self.iterations {
            let start = Instant::now();
            let keypair = algorithm.generate_keypair().await?;
            let duration = start.elapsed();
            keygen_times.push(duration);
            
            // Benchmark signing
            let start = Instant::now();
            let signature = algorithm.sign(test_message, &keypair).await?;
            let sign_duration = start.elapsed();
            sign_times.push(sign_duration);
            
            // Benchmark verification
            let start = Instant::now();
            let is_valid = algorithm.verify(test_message, &signature, &keypair.public_key).await?;
            let verify_duration = start.elapsed();
            verify_times.push(verify_duration);
            
            assert!(is_valid);
        }
        
        // Calculate statistics
        let keygen_stats = self.calculate_time_statistics(&keygen_times);
        let sign_stats = self.calculate_time_statistics(&sign_times);
        let verify_stats = self.calculate_time_statistics(&verify_times);
        
        // Measure sizes
        let keypair = algorithm.generate_keypair().await?;
        let signature = algorithm.sign(test_message, &keypair).await?;
        
        let key_size = keypair.public_key.len() + keypair.private_key.len();
        let signature_size = signature.len();
        
        // Calculate throughput
        let throughput = self.calculate_throughput(&sign_times, &verify_times, test_message.len());
        
        Ok(BenchmarkResults {
            algorithm: algorithm.algorithm_id(),
            keygen_time: keygen_stats.mean,
            keygen_stddev: keygen_stats.stddev,
            sign_time: sign_stats.mean,
            sign_stddev: sign_stats.stddev,
            verify_time: verify_stats.mean,
            verify_stddev: verify_stats.stddev,
            key_size,
            signature_size,
            throughput,
        })
    }
    
    fn calculate_throughput(&self, sign_times: &[Duration], verify_times: &[Duration], message_size: usize) -> BenchmarkThroughput {
        let avg_sign_time = sign_times.iter().sum::<Duration>() / sign_times.len() as u32;
        let avg_verify_time = verify_times.iter().sum::<Duration>() / verify_times.len() as u32;
        
        let signings_per_second = if avg_sign_time.as_nanos() > 0 {
            1_000_000_000.0 / avg_sign_time.as_nanos() as f64
        } else {
            f64::INFINITY
        };
        
        let verifications_per_second = if avg_verify_time.as_nanos() > 0 {
            1_000_000_000.0 / avg_verify_time.as_nanos() as f64
        } else {
            f64::INFINITY
        };
        
        BenchmarkThroughput {
            signings_per_second,
            verifications_per_second,
            bytes_per_second_signing: signings_per_second * message_size as f64,
            bytes_per_second_verification: verifications_per_second * message_size as f64,
        }
    }
    
    fn calculate_overall_score(&self, results: &BenchmarkResults) -> f64 {
        // Weighted score considering multiple factors
        let speed_score = 1000.0 / results.sign_time.as_millis() as f64;  // Higher is better
        let size_score = 1000.0 / results.signature_size as f64;          // Smaller is better
        let throughput_score = results.throughput.signings_per_second / 1000.0; // Normalize
        
        // Weighted combination
        speed_score * 0.4 + size_score * 0.3 + throughput_score * 0.3
    }
}
```

## Testing & Integration

```rust
#[cfg(test)]
mod pqc_tests {
    use super::*;
    
    #[tokio::test]
    async fn test_dilithium_signature_roundtrip() {
        let mut signer = DilithiumSigner::new(DilithiumVariant::Dilithium3);
        let keypair = signer.generate_keypair(DilithiumVariant::Dilithium3).unwrap();
        
        let message = b"Test message for Dilithium signature";
        let signature = signer.sign(message).unwrap();
        
        let is_valid = signer.verify(message, &signature, &keypair.public_key).unwrap();
        assert!(is_valid);
        
        // Test with wrong message
        let wrong_message = b"Wrong message";
        let is_invalid = signer.verify(wrong_message, &signature, &keypair.public_key).unwrap();
        assert!(!is_invalid);
    }
    
    #[tokio::test]
    async fn test_mlkem_key_encapsulation() {
        let mut kem = MLKEMEncapsulator::new(MLKEMVariant::MLKEM768);
        let keypair = kem.generate_keypair(MLKEMVariant::MLKEM768).unwrap();
        
        // Encapsulate
        let (ciphertext, shared_secret1) = kem.encapsulate(&keypair.public_key).unwrap();
        
        // Decapsulate
        let shared_secret2 = kem.decapsulate(&ciphertext).unwrap();
        
        // Secrets should match
        assert_eq!(shared_secret1, shared_secret2);
    }
    
    #[tokio::test]
    async fn test_hybrid_signature() {
        let classical_signer = Ed25519Signer::new();
        let pq_signer = DilithiumSigner::new(DilithiumVariant::Dilithium3);
        
        let hybrid_manager = HybridSignatureManager::new(
            classical_signer,
            pq_signer,
            HybridFormat::Concatenated
        );
        
        let message = b"Hybrid signature test message";
        let signature = hybrid_manager.sign(message).unwrap();
        
        // Generate keypairs for verification
        let classical_keypair = Ed25519Keypair::generate();
        let pq_keypair = DilithiumKeypair::generate(DilithiumVariant::Dilithium3);
        
        let is_valid = hybrid_manager.verify(
            message,
            &signature,
            &classical_keypair.public_key,
            &pq_keypair.public_key
        ).unwrap();
        
        assert!(is_valid);
    }
    
    #[tokio::test]
    async fn test_migration_phase_transition() {
        let mut migration_manager = PQMigrationManager::new(MigrationPhase::ClassicalOnly);
        
        // Test valid transition
        let result = migration_manager.schedule_migration_phase_transition(
            MigrationPhase::HybridIntroduction,
            SystemTime::now() + Duration::from_secs(3600)
        ).await;
        
        assert!(result.is_ok());
        
        // Test invalid transition
        let invalid_result = migration_manager.schedule_migration_phase_transition(
            MigrationPhase::PostQuantumOnly, // Skip intermediate phases
            SystemTime::now() + Duration::from_secs(7200)
        ).await;
        
        assert!(invalid_result.is_err());
    }
    
    #[tokio::test]
    async fn test_algorithm_negotiation() {
        let local_capabilities = PQCapabilities {
            classical_signatures: vec![ClassicalSignature::Ed25519, ClassicalSignature::ECDSA_P256],
            pq_signatures: vec![PQSignature::Dilithium3, PQSignature::Falcon512],
            classical_kems: vec![ClassicalKEM::X25519],
            pq_kems: vec![PQKEM::MLKEM768],
            hybrid_support: true,
            performance_profiles: vec![PerformanceProfile::Balanced],
        };
        
        let peer_capabilities = PQCapabilities {
            classical_signatures: vec![ClassicalSignature::Ed25519],
            pq_signatures: vec![PQSignature::Dilithium3],
            classical_kems: vec![ClassicalKEM::X25519],
            pq_kems: vec![PQKEM::MLKEM768],
            hybrid_support: true,
            performance_profiles: vec![PerformanceProfile::HighSecurity],
        };
        
        let migration_manager = PQMigrationManager::new(MigrationPhase::HybridTransition);
        
        let negotiated = migration_manager.negotiate_algorithms(
            "test_peer",
            &local_capabilities,
            &peer_capabilities
        ).await.unwrap();
        
        // Should negotiate hybrid algorithms in hybrid transition phase
        match negotiated.signature {
            SignatureAlgorithm::Hybrid { classical, post_quantum } => {
                assert_eq!(classical, ClassicalSignature::Ed25519);
                assert_eq!(post_quantum, PQSignature::Dilithium3);
            },
            _ => panic!("Expected hybrid signature algorithm"),
        }
    }
}
```

## Related Documentation

- [Trust Networks](./trust-networks.md) - PQ-secured trust relationships
- [HSM Integration](./hsm-integration.md) - Hardware-backed PQ operations
- [Keystore](./keystore.md) - PQ key lifecycle management
- [Device Integrity](./device-integrity.md) - PQ-enabled device attestation
- [Formal Verification](/architecture/formal-verification.md) - PQ protocol verification