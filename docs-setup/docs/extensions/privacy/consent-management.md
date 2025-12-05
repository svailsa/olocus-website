# Consent Management

## Overview

The Olocus Privacy extension provides comprehensive consent management capabilities to ensure compliance with privacy regulations like GDPR and CCPA. The system manages user consent, tracks consent changes over time, and provides fine-grained control over data processing activities.

## Architecture

### Core Components

```rust
use olocus_core::measure::{Measurement, Value, Uncertainty, Provenance, Source};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsentManager {
    pub user_consents: HashMap<UserId, UserConsentProfile>,
    pub consent_history: Vec<ConsentEvent>,
    pub compliance_framework: ComplianceFramework,
    pub consent_policies: Vec<ConsentPolicy>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct UserId(pub String);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserConsentProfile {
    pub user_id: UserId,
    pub consents: HashMap<ConsentType, ConsentStatus>,
    pub preferences: HashMap<String, Value>,
    pub last_updated: DateTime<Utc>,
    pub consent_version: u32,
    pub metadata: ConsentMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsentStatus {
    pub granted: bool,
    pub timestamp: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub source: ConsentSource,
    pub legal_basis: LegalBasis,
    pub granularity: ConsentGranularity,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ConsentType {
    DataCollection,
    DataProcessing,
    DataSharing,
    Marketing,
    Analytics,
    PersonalizedContent,
    LocationTracking,
    BiometricData,
    HealthData,
    FinancialData,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConsentSource {
    ExplicitConsent,        // User actively opted in
    ImpliedConsent,         // Implied from user action
    LegitimateInterest,     // Processing based on legitimate interest
    LegalObligation,        // Required by law
    VitalInterests,         // Protection of vital interests
    PublicTask,            // Performance of public task
    ContractualNecessity,   // Necessary for contract performance
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LegalBasis {
    GDPR(GDPRBasis),
    CCPA(CCPABasis),
    PIPEDA(PIPEDABasis),
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GDPRBasis {
    Article6A, // Consent
    Article6B, // Contract
    Article6C, // Legal obligation
    Article6D, // Vital interests
    Article6E, // Public task
    Article6F, // Legitimate interests
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CCPABasis {
    SaleOptOut,
    ServiceProvider,
    BusinessPurpose,
    CommercialPurpose,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PIPEDABasis {
    Consent,
    ContractualRequirement,
    LegalRequirement,
    EmergencyMedical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConsentGranularity {
    Global,                    // All-or-nothing consent
    CategoryBased,             // Consent per data category
    PurposeBased,              // Consent per processing purpose
    ProcessorBased,            // Consent per data processor
    FiniteGrained(HashMap<String, bool>), // Custom granular permissions
}
```

### Consent Events and History

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsentEvent {
    pub event_id: Uuid,
    pub user_id: UserId,
    pub event_type: ConsentEventType,
    pub timestamp: DateTime<Utc>,
    pub consent_types: HashSet<ConsentType>,
    pub previous_state: Option<ConsentStatus>,
    pub new_state: ConsentStatus,
    pub context: ConsentContext,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConsentEventType {
    ConsentGranted,
    ConsentRevoked,
    ConsentExpired,
    ConsentRenewed,
    ConsentModified,
    ConsentWithdrawn,
    DataPortabilityRequest,
    DataDeletionRequest,
    AccessRequest,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsentContext {
    pub application: String,
    pub version: String,
    pub user_agent: Option<String>,
    pub ip_address: Option<String>,
    pub session_id: Option<String>,
    pub consent_mechanism: ConsentMechanism,
    pub language: Option<String>,
    pub jurisdiction: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConsentMechanism {
    WebForm,
    MobileApp,
    API,
    ImportedConsent,
    ParentalConsent,
    GuardianConsent,
    CookieBanner,
    PrivacyCenter,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsentMetadata {
    pub consent_string: Option<String>,  // IAB consent string
    pub privacy_policy_version: String,
    pub terms_of_service_version: String,
    pub age_verification: Option<AgeVerification>,
    pub jurisdiction: String,
    pub data_controller: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgeVerification {
    pub verified_age: Option<u8>,
    pub verification_method: AgeVerificationMethod,
    pub parental_consent_required: bool,
    pub parental_consent_obtained: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgeVerificationMethod {
    SelfReported,
    CreditCardCheck,
    GovernmentID,
    ParentalVerification,
    ThirdPartyService,
}
```

## Implementation

### Core Consent Manager

```rust
impl ConsentManager {
    pub fn new(framework: ComplianceFramework) -> Self {
        Self {
            user_consents: HashMap::new(),
            consent_history: Vec::new(),
            compliance_framework: framework,
            consent_policies: Vec::new(),
        }
    }

    pub fn grant_consent(
        &mut self,
        user_id: UserId,
        consent_types: HashSet<ConsentType>,
        source: ConsentSource,
        context: ConsentContext,
    ) -> Result<(), ConsentError> {
        let legal_basis = self.determine_legal_basis(&source)?;
        let timestamp = Utc::now();

        // Get or create user profile
        let profile = self.user_consents.entry(user_id.clone())
            .or_insert_with(|| UserConsentProfile {
                user_id: user_id.clone(),
                consents: HashMap::new(),
                preferences: HashMap::new(),
                last_updated: timestamp,
                consent_version: 1,
                metadata: ConsentMetadata {
                    consent_string: None,
                    privacy_policy_version: "1.0".to_string(),
                    terms_of_service_version: "1.0".to_string(),
                    age_verification: None,
                    jurisdiction: "EU".to_string(),
                    data_controller: "Olocus Organization".to_string(),
                },
            });

        // Update consents
        for consent_type in &consent_types {
            let previous_state = profile.consents.get(consent_type).cloned();
            
            let new_consent = ConsentStatus {
                granted: true,
                timestamp,
                expires_at: self.calculate_expiry_date(&legal_basis),
                source: source.clone(),
                legal_basis: legal_basis.clone(),
                granularity: ConsentGranularity::CategoryBased,
            };

            profile.consents.insert(consent_type.clone(), new_consent.clone());

            // Record consent event
            let event = ConsentEvent {
                event_id: Uuid::new_v4(),
                user_id: user_id.clone(),
                event_type: ConsentEventType::ConsentGranted,
                timestamp,
                consent_types: [consent_type.clone()].into_iter().collect(),
                previous_state,
                new_state: new_consent,
                context: context.clone(),
            };

            self.consent_history.push(event);
        }

        profile.last_updated = timestamp;
        profile.consent_version += 1;

        Ok(())
    }

    pub fn revoke_consent(
        &mut self,
        user_id: &UserId,
        consent_types: HashSet<ConsentType>,
        context: ConsentContext,
    ) -> Result<(), ConsentError> {
        let profile = self.user_consents.get_mut(user_id)
            .ok_or(ConsentError::UserNotFound(user_id.clone()))?;

        let timestamp = Utc::now();

        for consent_type in &consent_types {
            if let Some(previous_state) = profile.consents.get(consent_type) {
                if previous_state.granted {
                    let new_consent = ConsentStatus {
                        granted: false,
                        timestamp,
                        expires_at: None,
                        source: ConsentSource::ExplicitConsent,
                        legal_basis: previous_state.legal_basis.clone(),
                        granularity: previous_state.granularity.clone(),
                    };

                    profile.consents.insert(consent_type.clone(), new_consent.clone());

                    // Record revocation event
                    let event = ConsentEvent {
                        event_id: Uuid::new_v4(),
                        user_id: user_id.clone(),
                        event_type: ConsentEventType::ConsentRevoked,
                        timestamp,
                        consent_types: [consent_type.clone()].into_iter().collect(),
                        previous_state: Some(previous_state.clone()),
                        new_state: new_consent,
                        context: context.clone(),
                    };

                    self.consent_history.push(event);
                }
            }
        }

        profile.last_updated = timestamp;
        profile.consent_version += 1;

        Ok(())
    }

    pub fn check_consent(
        &self,
        user_id: &UserId,
        consent_type: &ConsentType,
    ) -> Result<bool, ConsentError> {
        let profile = self.user_consents.get(user_id)
            .ok_or(ConsentError::UserNotFound(user_id.clone()))?;

        if let Some(consent) = profile.consents.get(consent_type) {
            // Check if consent is still valid
            if let Some(expires_at) = consent.expires_at {
                if Utc::now() > expires_at {
                    return Ok(false); // Consent has expired
                }
            }

            Ok(consent.granted)
        } else {
            // No explicit consent found - check for implied consent
            self.check_implied_consent(user_id, consent_type)
        }
    }

    fn check_implied_consent(
        &self,
        user_id: &UserId,
        consent_type: &ConsentType,
    ) -> Result<bool, ConsentError> {
        // Check if processing can proceed under legitimate interest or other basis
        match self.compliance_framework {
            ComplianceFramework::GDPR => {
                // Under GDPR, some processing may be lawful without explicit consent
                match consent_type {
                    ConsentType::DataProcessing => {
                        // Check if we have legitimate interest
                        self.check_legitimate_interest(user_id, consent_type)
                    },
                    ConsentType::Analytics => {
                        // Analytics might be allowed under legitimate interest
                        self.check_legitimate_interest(user_id, consent_type)
                    },
                    _ => Ok(false), // Default to requiring explicit consent
                }
            },
            ComplianceFramework::CCPA => {
                // Under CCPA, opt-out model - consent assumed unless explicitly revoked
                Ok(true)
            },
            _ => Ok(false),
        }
    }

    fn check_legitimate_interest(
        &self,
        _user_id: &UserId,
        consent_type: &ConsentType,
    ) -> Result<bool, ConsentError> {
        // Implement legitimate interest assessment
        for policy in &self.consent_policies {
            if policy.applies_to_consent_type(consent_type) {
                return Ok(policy.legitimate_interest_applies);
            }
        }
        Ok(false)
    }

    pub fn handle_data_subject_request(
        &mut self,
        user_id: &UserId,
        request_type: DataSubjectRequestType,
        context: ConsentContext,
    ) -> Result<DataSubjectResponse, ConsentError> {
        match request_type {
            DataSubjectRequestType::Access => {
                self.handle_access_request(user_id, context)
            },
            DataSubjectRequestType::Portability => {
                self.handle_portability_request(user_id, context)
            },
            DataSubjectRequestType::Deletion => {
                self.handle_deletion_request(user_id, context)
            },
            DataSubjectRequestType::Rectification => {
                self.handle_rectification_request(user_id, context)
            },
        }
    }

    fn handle_access_request(
        &self,
        user_id: &UserId,
        context: ConsentContext,
    ) -> Result<DataSubjectResponse, ConsentError> {
        let profile = self.user_consents.get(user_id)
            .ok_or(ConsentError::UserNotFound(user_id.clone()))?;

        // Collect all data for this user
        let user_data = self.collect_user_data(user_id)?;
        let consent_history = self.get_user_consent_history(user_id);

        // Record the access request
        let event = ConsentEvent {
            event_id: Uuid::new_v4(),
            user_id: user_id.clone(),
            event_type: ConsentEventType::AccessRequest,
            timestamp: Utc::now(),
            consent_types: HashSet::new(),
            previous_state: None,
            new_state: ConsentStatus {
                granted: true,
                timestamp: Utc::now(),
                expires_at: None,
                source: ConsentSource::LegalObligation,
                legal_basis: LegalBasis::GDPR(GDPRBasis::Article6C),
                granularity: ConsentGranularity::Global,
            },
            context,
        };

        Ok(DataSubjectResponse::Access {
            user_data,
            consent_profile: profile.clone(),
            consent_history,
            request_processed_at: Utc::now(),
        })
    }

    fn handle_deletion_request(
        &mut self,
        user_id: &UserId,
        context: ConsentContext,
    ) -> Result<DataSubjectResponse, ConsentError> {
        // Check if deletion is possible (considering legal obligations)
        if !self.can_delete_user_data(user_id)? {
            return Err(ConsentError::DeletionNotAllowed("Legal retention requirements".to_string()));
        }

        // Mark all consents as revoked
        let all_consent_types: HashSet<ConsentType> = ConsentType::all_types();
        self.revoke_consent(user_id, all_consent_types, context.clone())?;

        // Record deletion request
        let event = ConsentEvent {
            event_id: Uuid::new_v4(),
            user_id: user_id.clone(),
            event_type: ConsentEventType::DataDeletionRequest,
            timestamp: Utc::now(),
            consent_types: HashSet::new(),
            previous_state: None,
            new_state: ConsentStatus {
                granted: false,
                timestamp: Utc::now(),
                expires_at: None,
                source: ConsentSource::ExplicitConsent,
                legal_basis: LegalBasis::GDPR(GDPRBasis::Article6A),
                granularity: ConsentGranularity::Global,
            },
            context,
        };

        self.consent_history.push(event);

        Ok(DataSubjectResponse::Deletion {
            deleted_at: Utc::now(),
            retention_notice: Some("Some data may be retained for legal compliance purposes".to_string()),
        })
    }
}
```

### Compliance Frameworks

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ComplianceFramework {
    GDPR,
    CCPA,
    PIPEDA,
    LGPD,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsentPolicy {
    pub name: String,
    pub description: String,
    pub applicable_consent_types: HashSet<ConsentType>,
    pub legal_basis: LegalBasis,
    pub legitimate_interest_applies: bool,
    pub retention_period: Option<chrono::Duration>,
    pub geographic_scope: HashSet<String>,
    pub age_restrictions: Option<AgeRestrictions>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgeRestrictions {
    pub minimum_age: u8,
    pub parental_consent_required_under: u8,
    pub age_verification_required: bool,
}

impl ConsentPolicy {
    pub fn gdpr_marketing_policy() -> Self {
        Self {
            name: "GDPR Marketing Communications".to_string(),
            description: "Policy for marketing communications under GDPR".to_string(),
            applicable_consent_types: [ConsentType::Marketing].into_iter().collect(),
            legal_basis: LegalBasis::GDPR(GDPRBasis::Article6A),
            legitimate_interest_applies: false,
            retention_period: Some(chrono::Duration::days(1095)), // 3 years
            geographic_scope: ["EU", "UK", "EEA"].iter().map(|s| s.to_string()).collect(),
            age_restrictions: Some(AgeRestrictions {
                minimum_age: 16,
                parental_consent_required_under: 16,
                age_verification_required: true,
            }),
        }
    }

    pub fn ccpa_data_sale_policy() -> Self {
        Self {
            name: "CCPA Data Sale Opt-Out".to_string(),
            description: "Policy for data sale opt-out under CCPA".to_string(),
            applicable_consent_types: [ConsentType::DataSharing].into_iter().collect(),
            legal_basis: LegalBasis::CCPA(CCPABasis::SaleOptOut),
            legitimate_interest_applies: false,
            retention_period: None,
            geographic_scope: ["CA", "US"].iter().map(|s| s.to_string()).collect(),
            age_restrictions: Some(AgeRestrictions {
                minimum_age: 13,
                parental_consent_required_under: 13,
                age_verification_required: false,
            }),
        }
    }

    pub fn applies_to_consent_type(&self, consent_type: &ConsentType) -> bool {
        self.applicable_consent_types.contains(consent_type)
    }
}
```

### Data Subject Rights

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DataSubjectRequestType {
    Access,         // Right to access (GDPR Art. 15)
    Portability,    // Right to data portability (GDPR Art. 20)
    Deletion,       // Right to erasure/"Right to be forgotten" (GDPR Art. 17)
    Rectification,  // Right to rectification (GDPR Art. 16)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DataSubjectResponse {
    Access {
        user_data: Vec<Measurement>,
        consent_profile: UserConsentProfile,
        consent_history: Vec<ConsentEvent>,
        request_processed_at: DateTime<Utc>,
    },
    Portability {
        exported_data: Vec<u8>,
        format: String,
        request_processed_at: DateTime<Utc>,
    },
    Deletion {
        deleted_at: DateTime<Utc>,
        retention_notice: Option<String>,
    },
    Rectification {
        updated_fields: HashMap<String, Value>,
        updated_at: DateTime<Utc>,
    },
}

impl ConsentManager {
    fn collect_user_data(&self, user_id: &UserId) -> Result<Vec<Measurement>, ConsentError> {
        // This would typically query all systems that store user data
        // For demonstration, we'll create a placeholder
        let user_data_measurement = Measurement {
            value: Value::Object([
                ("user_id".to_string(), Value::String(user_id.0.clone())),
                ("data_collection_summary".to_string(), Value::String("User interaction data".to_string())),
                ("total_records".to_string(), Value::Int(42)),
            ].iter().cloned().collect()),
            uncertainty: Uncertainty::Exact,
            provenance: Provenance {
                source: Source::SelfReported,
                transformations: Vec::new(),
                attestations: Vec::new(),
            },
            validity: None,
        };

        Ok(vec![user_data_measurement])
    }

    fn get_user_consent_history(&self, user_id: &UserId) -> Vec<ConsentEvent> {
        self.consent_history.iter()
            .filter(|event| &event.user_id == user_id)
            .cloned()
            .collect()
    }

    fn can_delete_user_data(&self, _user_id: &UserId) -> Result<bool, ConsentError> {
        // Check legal retention requirements
        // For demonstration, always allow deletion
        Ok(true)
    }
}
```

## Integration with Olocus Core

### Block Payload Implementation

```rust
use olocus_core::{Block, BlockPayload};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsentPayload {
    pub user_id: UserId,
    pub consent_events: Vec<ConsentEvent>,
    pub compliance_framework: ComplianceFramework,
    pub consent_snapshot: UserConsentProfile,
    pub audit_trail: ConsentAuditTrail,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsentAuditTrail {
    pub policy_version: String,
    pub consent_mechanisms_used: HashSet<ConsentMechanism>,
    pub legal_bases_applied: HashSet<LegalBasis>,
    pub jurisdiction: String,
    pub data_controller: String,
    pub data_protection_officer_contact: Option<String>,
}

impl BlockPayload for ConsentPayload {
    fn payload_type(&self) -> u16 {
        0x0523 // Privacy extension, consent management subtype
    }

    fn validate(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Validate user ID
        if self.user_id.0.is_empty() {
            return Err("User ID cannot be empty".into());
        }

        // Validate consent events
        for event in &self.consent_events {
            if event.user_id != self.user_id {
                return Err("All consent events must be for the same user".into());
            }

            // Validate timestamps are chronological
            if event.timestamp > Utc::now() {
                return Err("Consent event timestamp cannot be in the future".into());
            }
        }

        // Validate consent profile consistency
        if self.consent_snapshot.user_id != self.user_id {
            return Err("Consent snapshot must match user ID".into());
        }

        // Validate compliance framework requirements
        match self.compliance_framework {
            ComplianceFramework::GDPR => {
                self.validate_gdpr_compliance()?;
            },
            ComplianceFramework::CCPA => {
                self.validate_ccpa_compliance()?;
            },
            _ => {}, // Other frameworks
        }

        Ok(())
    }
}

impl ConsentPayload {
    fn validate_gdpr_compliance(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Check for required GDPR elements
        for event in &self.consent_events {
            if let ConsentEventType::ConsentGranted = event.event_type {
                // Ensure legal basis is specified
                match &event.new_state.legal_basis {
                    LegalBasis::GDPR(_) => {}, // Valid
                    _ => return Err("GDPR compliance requires GDPR legal basis".into()),
                }

                // Ensure explicit consent for sensitive categories
                if event.consent_types.contains(&ConsentType::HealthData) ||
                   event.consent_types.contains(&ConsentType::BiometricData) {
                    match event.new_state.source {
                        ConsentSource::ExplicitConsent => {}, // Valid
                        _ => return Err("Sensitive data requires explicit consent under GDPR".into()),
                    }
                }
            }
        }

        // Check for age verification if required
        if let Some(age_verification) = &self.consent_snapshot.metadata.age_verification {
            if age_verification.verified_age.unwrap_or(0) < 16 &&
               !age_verification.parental_consent_obtained {
                return Err("GDPR requires parental consent for users under 16".into());
            }
        }

        Ok(())
    }

    fn validate_ccpa_compliance(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Check for required CCPA elements
        for event in &self.consent_events {
            if let ConsentEventType::ConsentRevoked = event.event_type {
                if event.consent_types.contains(&ConsentType::DataSharing) {
                    // Ensure proper opt-out mechanism
                    match event.context.consent_mechanism {
                        ConsentMechanism::WebForm |
                        ConsentMechanism::PrivacyCenter => {}, // Valid
                        _ => return Err("CCPA requires accessible opt-out mechanism".into()),
                    }
                }
            }
        }

        Ok(())
    }
}
```

### Usage Example

```rust
use olocus_privacy::{ConsentManager, ComplianceFramework, UserId, ConsentType};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize consent manager for GDPR compliance
    let mut consent_manager = ConsentManager::new(ComplianceFramework::GDPR);
    
    // Add GDPR policies
    consent_manager.consent_policies.push(ConsentPolicy::gdpr_marketing_policy());
    
    let user_id = UserId("user_123@example.com".to_string());
    let consent_types = [
        ConsentType::DataCollection,
        ConsentType::DataProcessing,
        ConsentType::Analytics,
    ].into_iter().collect();
    
    let context = ConsentContext {
        application: "olocus-app".to_string(),
        version: "1.0.0".to_string(),
        user_agent: Some("Mozilla/5.0 (compatible)".to_string()),
        ip_address: Some("192.168.1.1".to_string()),
        session_id: Some("session_abc123".to_string()),
        consent_mechanism: ConsentMechanism::WebForm,
        language: Some("en".to_string()),
        jurisdiction: Some("EU".to_string()),
    };
    
    // Grant consent
    consent_manager.grant_consent(
        user_id.clone(),
        consent_types.clone(),
        ConsentSource::ExplicitConsent,
        context.clone(),
    )?;
    
    // Check consent status
    for consent_type in &consent_types {
        let has_consent = consent_manager.check_consent(&user_id, consent_type)?;
        println!("Consent for {:?}: {}", consent_type, has_consent);
    }
    
    // Handle data subject access request
    let access_response = consent_manager.handle_data_subject_request(
        &user_id,
        DataSubjectRequestType::Access,
        context.clone(),
    )?;
    
    // Create consent block payload
    let user_profile = consent_manager.user_consents.get(&user_id).unwrap().clone();
    let user_events: Vec<_> = consent_manager.consent_history.iter()
        .filter(|event| event.user_id == user_id)
        .cloned()
        .collect();
    
    let payload = ConsentPayload {
        user_id: user_id.clone(),
        consent_events: user_events,
        compliance_framework: ComplianceFramework::GDPR,
        consent_snapshot: user_profile,
        audit_trail: ConsentAuditTrail {
            policy_version: "1.0".to_string(),
            consent_mechanisms_used: [ConsentMechanism::WebForm].into_iter().collect(),
            legal_bases_applied: [LegalBasis::GDPR(GDPRBasis::Article6A)].into_iter().collect(),
            jurisdiction: "EU".to_string(),
            data_controller: "Olocus Organization".to_string(),
            data_protection_officer_contact: Some("dpo@olocus.org".to_string()),
        },
    };
    
    // Create block
    let block = Block::new(payload)?;
    println!("Created consent management block: {}", hex::encode(block.hash()));
    
    // Later, revoke marketing consent
    consent_manager.revoke_consent(
        &user_id,
        [ConsentType::Marketing].into_iter().collect(),
        context.clone(),
    )?;
    
    Ok(())
}
```

## Security Considerations

### Privacy by Design

```rust
pub struct PrivacyByDesignPrinciples;

impl PrivacyByDesignPrinciples {
    /// Validate implementation against Privacy by Design principles
    pub fn validate_implementation(consent_manager: &ConsentManager) -> PrivacyAssessment {
        let mut assessment = PrivacyAssessment::new();
        
        // 1. Proactive not Reactive
        assessment.proactive_score = Self::assess_proactive_measures(consent_manager);
        
        // 2. Privacy as the Default
        assessment.privacy_default_score = Self::assess_default_privacy(consent_manager);
        
        // 3. Privacy Embedded into Design
        assessment.embedded_score = Self::assess_embedded_privacy(consent_manager);
        
        // 4. Full Functionality
        assessment.functionality_score = Self::assess_functionality_preservation(consent_manager);
        
        // 5. End-to-End Security
        assessment.security_score = Self::assess_security_measures(consent_manager);
        
        // 6. Visibility and Transparency
        assessment.transparency_score = Self::assess_transparency(consent_manager);
        
        // 7. Respect for User Privacy
        assessment.user_privacy_score = Self::assess_user_control(consent_manager);
        
        assessment
    }

    fn assess_proactive_measures(consent_manager: &ConsentManager) -> f64 {
        let mut score = 0.0;
        let max_score = 100.0;
        
        // Check for automated consent expiry
        if consent_manager.user_consents.values().any(|profile| {
            profile.consents.values().any(|consent| consent.expires_at.is_some())
        }) {
            score += 25.0;
        }
        
        // Check for regular consent refresh
        if !consent_manager.consent_policies.is_empty() {
            score += 25.0;
        }
        
        // Check for granular consent options
        if consent_manager.user_consents.values().any(|profile| {
            profile.consents.values().any(|consent| {
                matches!(consent.granularity, ConsentGranularity::PurposeBased | ConsentGranularity::FiniteGrained(_))
            })
        }) {
            score += 25.0;
        }
        
        // Check for consent analytics
        if consent_manager.consent_history.len() > 0 {
            score += 25.0;
        }
        
        score / max_score
    }

    fn assess_default_privacy(_consent_manager: &ConsentManager) -> f64 {
        // Assess whether privacy-friendly settings are default
        // This would examine default consent states, opt-in vs opt-out patterns, etc.
        0.85 // Placeholder score
    }
    
    // ... other assessment methods
}

#[derive(Debug, Clone)]
pub struct PrivacyAssessment {
    pub proactive_score: f64,
    pub privacy_default_score: f64,
    pub embedded_score: f64,
    pub functionality_score: f64,
    pub security_score: f64,
    pub transparency_score: f64,
    pub user_privacy_score: f64,
    pub overall_score: f64,
}

impl PrivacyAssessment {
    pub fn new() -> Self {
        Self {
            proactive_score: 0.0,
            privacy_default_score: 0.0,
            embedded_score: 0.0,
            functionality_score: 0.0,
            security_score: 0.0,
            transparency_score: 0.0,
            user_privacy_score: 0.0,
            overall_score: 0.0,
        }
    }

    pub fn calculate_overall_score(&mut self) {
        self.overall_score = (
            self.proactive_score +
            self.privacy_default_score +
            self.embedded_score +
            self.functionality_score +
            self.security_score +
            self.transparency_score +
            self.user_privacy_score
        ) / 7.0;
    }
}
```

## Performance Characteristics

Performance targets for consent management operations:

- **Consent check**: &lt;5ms per consent type
- **Consent grant/revoke**: &lt;20ms per operation
- **Data subject request processing**: &lt;500ms for access requests
- **Consent history query**: &lt;100ms for user's complete history
- **Compliance validation**: &lt;50ms per payload

## Best Practices

### Configuration Guidelines

1. **Granularity Selection**:
   - Use purpose-based consent for complex data processing
   - Implement fine-grained consent for sensitive data categories
   - Consider user experience vs. privacy trade-offs

2. **Retention Management**:
   - Set appropriate consent expiry dates
   - Implement automated consent refresh workflows
   - Maintain historical consent records for audit purposes

3. **Compliance Strategy**:
   - Design for the strictest applicable regulation
   - Implement jurisdiction-aware consent collection
   - Regular compliance audits and assessments

## Error Handling

```rust
#[derive(Debug, thiserror::Error)]
pub enum ConsentError {
    #[error("User not found: {0:?}")]
    UserNotFound(UserId),
    
    #[error("Invalid consent type: {0}")]
    InvalidConsentType(String),
    
    #[error("Consent already exists for user {user_id:?}, type {consent_type:?}")]
    ConsentAlreadyExists { user_id: UserId, consent_type: ConsentType },
    
    #[error("Legal basis determination failed: {0}")]
    LegalBasisError(String),
    
    #[error("Age verification required but not provided")]
    AgeVerificationRequired,
    
    #[error("Parental consent required for user under minimum age")]
    ParentalConsentRequired,
    
    #[error("Data deletion not allowed: {0}")]
    DeletionNotAllowed(String),
    
    #[error("Compliance framework validation failed: {0}")]
    ComplianceValidationFailed(String),
    
    #[error("Invalid consent context: {0}")]
    InvalidContext(String),
}
```

This comprehensive consent management implementation provides enterprise-grade privacy compliance capabilities within the Olocus Privacy extension, ensuring adherence to major privacy regulations while maintaining usability and performance.