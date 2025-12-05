---
id: device-integrity
title: Device Integrity
sidebar_position: 2
---

# Device Integrity

The Integrity extension provides comprehensive device integrity verification and fraud detection capabilities using platform-specific attestation frameworks and behavioral analysis.

## Overview

The integrity extension verifies device trustworthiness through multiple mechanisms:

- **iOS App Attest**: Hardware-backed attestation on iOS devices
- **Android Play Integrity**: Google Play Services integrity verification
- **Custom Attestation**: Hardware Security Module integration
- **Fraud Detection**: Behavioral analysis and anomaly detection
- **Anti-Tampering**: Root/jailbreak detection and runtime protection

```rust
use olocus_integrity::*;

// Configure device integrity verification
let integrity_config = IntegrityConfig {
    ios_app_attest: Some(AppAttestConfig {
        team_id: "YOUR_TEAM_ID".to_string(),
        key_id: "YOUR_KEY_ID".to_string(),
        environment: AppAttestEnvironment::Production,
    }),
    android_play_integrity: Some(PlayIntegrityConfig {
        cloud_project_number: 123456789,
        package_name: "com.yourapp.package".to_string(),
        environment: PlayIntegrityEnvironment::Production,
    }),
    fraud_detection: FraudDetectionConfig {
        enabled_strategies: vec![
            FraudDetectionStrategy::DeviceFingerprinting,
            FraudDetectionStrategy::BehavioralAnalysis,
            FraudDetectionStrategy::VelocityChecking,
        ],
        risk_threshold: 0.7,
    },
};

let integrity_verifier = DeviceIntegrityVerifier::new(integrity_config)?;
```

## iOS App Attest

Apple's App Attest provides hardware-backed device integrity verification:

### App Attest Implementation

```rust
use olocus_integrity::ios::*;

pub struct AppAttestVerifier {
    team_id: String,
    key_id: String,
    environment: AppAttestEnvironment,
    attestation_cache: LruCache<String, AttestationResult>,
}

#[derive(Debug, Clone)]
pub enum AppAttestEnvironment {
    Development,
    Production,
}

impl AppAttestVerifier {
    pub async fn verify_device(&self, device_id: &str) -> Result<IntegrityResult> {
        // Step 1: Generate key pair on device (done on client)
        // Step 2: Generate attestation object (done on client)
        // Step 3: Verify attestation on server (this method)
        
        let attestation_data = self.get_attestation_from_device(device_id).await?;
        
        // Verify attestation object
        let verification_result = self.verify_attestation_object(&attestation_data)?;
        
        // Check device integrity factors
        let integrity_checks = self.perform_integrity_checks(&verification_result)?;
        
        let result = IntegrityResult {
            device_id: device_id.to_string(),
            platform: Platform::iOS,
            attestation_valid: verification_result.is_valid,
            integrity_level: self.calculate_integrity_level(&integrity_checks),
            risk_factors: integrity_checks.risk_factors,
            timestamp: SystemTime::now(),
            expires_at: SystemTime::now() + Duration::from_hours(24),
        };
        
        // Cache result
        self.attestation_cache.insert(device_id.to_string(), result.clone());
        
        Ok(result)
    }
    
    fn verify_attestation_object(&self, attestation: &AttestationObject) -> Result<VerificationResult> {
        // Parse CBOR attestation object
        let parsed = self.parse_attestation_object(attestation)?;
        
        // Verify certificate chain
        self.verify_certificate_chain(&parsed.certificate_chain)?;
        
        // Verify attestation statement
        self.verify_attestation_statement(&parsed.auth_data, &parsed.attestation_statement)?;
        
        // Check app ID and environment
        self.verify_app_id(&parsed.auth_data)?;
        
        Ok(VerificationResult {
            is_valid: true,
            auth_data: parsed.auth_data,
            credential_id: parsed.credential_id,
            public_key: parsed.public_key,
        })
    }
    
    fn verify_certificate_chain(&self, chain: &[Certificate]) -> Result<()> {
        // Verify certificate chain up to Apple Root CA
        let apple_root_ca = self.get_apple_root_ca()?;
        
        // Check each certificate in chain
        for (i, cert) in chain.iter().enumerate() {
            if i == 0 {
                // Leaf certificate - verify it's from Apple
                self.verify_apple_leaf_certificate(cert)?;
            } else {
                // Intermediate certificates
                self.verify_intermediate_certificate(cert, &chain[i-1])?;
            }
        }
        
        // Verify root
        self.verify_root_certificate(chain.last().unwrap(), &apple_root_ca)?;
        
        Ok(())
    }
    
    fn verify_app_id(&self, auth_data: &AuthenticatorData) -> Result<()> {
        // Extract RP ID hash from auth data
        let rp_id_hash = &auth_data.rp_id_hash;
        
        // Calculate expected RP ID hash for our app
        let expected_app_id = format!("{}.{}", self.team_id, "YOUR_APP_BUNDLE_ID");
        let expected_hash = sha256(expected_app_id.as_bytes());
        
        if rp_id_hash != &expected_hash {
            return Err(IntegrityError::InvalidAppId {
                expected: hex::encode(expected_hash),
                received: hex::encode(rp_id_hash),
            });
        }
        
        Ok(())
    }
    
    fn perform_integrity_checks(&self, verification: &VerificationResult) -> Result<IntegrityChecks> {
        let mut risk_factors = Vec::new();
        let mut integrity_score = 1.0;
        
        // Check for jailbreak indicators
        if self.check_jailbreak_indicators(&verification.auth_data)? {
            risk_factors.push(RiskFactor::JailbrokenDevice);
            integrity_score *= 0.1; // Severe penalty
        }
        
        // Check device model and OS version
        let device_info = self.extract_device_info(&verification.auth_data)?;
        if self.is_unsupported_device(&device_info) {
            risk_factors.push(RiskFactor::UnsupportedDevice);
            integrity_score *= 0.5;
        }
        
        // Check for debugging/development signs
        if self.check_development_environment(&verification.auth_data)? {
            if matches!(self.environment, AppAttestEnvironment::Production) {
                risk_factors.push(RiskFactor::DevelopmentEnvironment);
                integrity_score *= 0.3;
            }
        }
        
        Ok(IntegrityChecks {
            integrity_score,
            risk_factors,
            device_info,
            checks_performed: vec![
                "jailbreak_detection".to_string(),
                "device_model_verification".to_string(),
                "environment_validation".to_string(),
            ],
        })
    }
}
```

### App Attest Challenge-Response

```rust
impl AppAttestVerifier {
    pub async fn create_challenge(&self, device_id: &str) -> Result<AttestationChallenge> {
        let challenge_data = self.generate_random_challenge(32)?; // 32 random bytes
        let challenge_id = Uuid::new_v4().to_string();
        
        let challenge = AttestationChallenge {
            challenge_id,
            challenge_data: challenge_data.clone(),
            device_id: device_id.to_string(),
            created_at: SystemTime::now(),
            expires_at: SystemTime::now() + Duration::from_mins(5), // Short expiry
        };
        
        // Store challenge for verification
        self.store_challenge(&challenge).await?;
        
        Ok(challenge)
    }
    
    pub async fn verify_challenge_response(
        &self,
        challenge_id: &str,
        response: &AttestationResponse
    ) -> Result<bool> {
        let challenge = self.get_stored_challenge(challenge_id).await?
            .ok_or(IntegrityError::ChallengeNotFound)?;
            
        // Check if challenge has expired
        if SystemTime::now() > challenge.expires_at {
            return Err(IntegrityError::ChallengeExpired);
        }
        
        // Verify the response signature
        let public_key = self.get_device_public_key(&challenge.device_id).await?;
        let signature_valid = public_key.verify(
            &challenge.challenge_data,
            &response.signature
        )?;
        
        if !signature_valid {
            return Err(IntegrityError::InvalidSignature);
        }
        
        // Clean up challenge
        self.remove_challenge(challenge_id).await?;
        
        Ok(true)
    }
}
```

## Android Play Integrity

Google Play Integrity API provides app and device verification:

### Play Integrity Implementation

```rust
use olocus_integrity::android::*;

pub struct PlayIntegrityVerifier {
    project_number: i64,
    package_name: String,
    service_account_key: ServiceAccountKey,
    environment: PlayIntegrityEnvironment,
}

#[derive(Debug, Clone)]
pub enum PlayIntegrityEnvironment {
    Development,
    Production,
}

impl PlayIntegrityVerifier {
    pub async fn verify_device(&self, integrity_token: &str) -> Result<IntegrityResult> {
        // Decrypt and verify the integrity token
        let token_payload = self.decrypt_integrity_token(integrity_token).await?;
        
        // Extract integrity verdicts
        let app_integrity = self.verify_app_integrity(&token_payload)?;
        let device_integrity = self.verify_device_integrity(&token_payload)?;
        let account_details = self.extract_account_details(&token_payload)?;
        
        // Assess overall integrity
        let integrity_level = self.calculate_overall_integrity(
            &app_integrity,
            &device_integrity,
            &account_details
        )?;
        
        Ok(IntegrityResult {
            device_id: token_payload.device_id,
            platform: Platform::Android,
            attestation_valid: true,
            integrity_level,
            risk_factors: self.identify_risk_factors(&token_payload),
            timestamp: SystemTime::now(),
            expires_at: SystemTime::now() + Duration::from_hours(24),
        })
    }
    
    async fn decrypt_integrity_token(&self, token: &str) -> Result<IntegrityTokenPayload> {
        // The token is a JWS (JSON Web Signature)
        let jws = JsonWebSignature::from_str(token)?;
        
        // Get Google's public keys for verification
        let google_keys = self.fetch_google_public_keys().await?;
        
        // Verify signature
        let key_id = jws.header().key_id()
            .ok_or(IntegrityError::MissingKeyId)?;
            
        let public_key = google_keys.get(key_id)
            .ok_or(IntegrityError::UnknownKeyId)?;
            
        if !jws.verify(public_key)? {
            return Err(IntegrityError::InvalidSignature);
        }
        
        // Parse payload
        let payload: IntegrityTokenPayload = serde_json::from_slice(jws.payload())?;
        
        // Verify token is for our app
        if payload.app_integrity.package_name != self.package_name {
            return Err(IntegrityError::WrongPackageName {
                expected: self.package_name.clone(),
                received: payload.app_integrity.package_name,
            });
        }
        
        Ok(payload)
    }
    
    fn verify_app_integrity(&self, payload: &IntegrityTokenPayload) -> Result<AppIntegrityAssessment> {
        let app_integrity = &payload.app_integrity;
        
        let mut assessment = AppIntegrityAssessment {
            app_recognition_verdict: app_integrity.app_recognition_verdict.clone(),
            package_name_matches: app_integrity.package_name == self.package_name,
            certificate_sha256_digest_matches: self.verify_certificate_digest(&app_integrity.certificate_sha256_digest)?,
            version_code_matches: self.verify_version_code(app_integrity.version_code)?,
            installed_from_play: app_integrity.app_recognition_verdict == AppRecognitionVerdict::PlayRecognized,
        };
        
        Ok(assessment)
    }
    
    fn verify_device_integrity(&self, payload: &IntegrityTokenPayload) -> Result<DeviceIntegrityAssessment> {
        let device_integrity = &payload.device_integrity;
        
        let mut risk_score = 0.0;
        let mut verdicts = Vec::new();
        
        // Check each verdict
        for verdict in &device_integrity.device_recognition_verdict {
            match verdict {
                DeviceRecognitionVerdict::MeetsDeviceIntegrity => {
                    verdicts.push("meets_basic_integrity".to_string());
                },
                DeviceRecognitionVerdict::MeetsStrongIntegrity => {
                    verdicts.push("meets_strong_integrity".to_string());
                },
                DeviceRecognitionVerdict::MeetsVirtualIntegrity => {
                    verdicts.push("virtual_device".to_string());
                    risk_score += 0.3; // Emulators are riskier
                },
                DeviceRecognitionVerdict::Unknown => {
                    verdicts.push("unknown".to_string());
                    risk_score += 0.5; // Unknown devices are risky
                }
            }
        }
        
        // Check for rooted device
        if !device_integrity.device_recognition_verdict.contains(&DeviceRecognitionVerdict::MeetsDeviceIntegrity) {
            risk_score += 0.6; // Likely rooted
        }
        
        Ok(DeviceIntegrityAssessment {
            verdicts,
            risk_score,
            meets_basic_integrity: device_integrity.device_recognition_verdict.contains(&DeviceRecognitionVerdict::MeetsDeviceIntegrity),
            meets_strong_integrity: device_integrity.device_recognition_verdict.contains(&DeviceRecognitionVerdict::MeetsStrongIntegrity),
            is_emulator: device_integrity.device_recognition_verdict.contains(&DeviceRecognitionVerdict::MeetsVirtualIntegrity),
        })
    }
}
```

### Play Integrity Token Request

```rust
impl PlayIntegrityVerifier {
    pub async fn create_integrity_challenge(&self) -> Result<IntegrityChallenge> {
        // Generate nonce for this verification request
        let nonce = self.generate_nonce()?;
        let challenge_id = Uuid::new_v4().to_string();
        
        let challenge = IntegrityChallenge {
            challenge_id,
            nonce: nonce.clone(),
            cloud_project_number: self.project_number,
            created_at: SystemTime::now(),
            expires_at: SystemTime::now() + Duration::from_mins(10),
        };
        
        // Store challenge for later verification
        self.store_challenge(&challenge).await?;
        
        Ok(challenge)
    }
    
    pub async fn verify_integrity_response(
        &self,
        challenge_id: &str,
        integrity_token: &str
    ) -> Result<IntegrityResult> {
        // Get stored challenge
        let challenge = self.get_stored_challenge(challenge_id).await?
            .ok_or(IntegrityError::ChallengeNotFound)?;
            
        // Verify token
        let token_payload = self.decrypt_integrity_token(integrity_token).await?;
        
        // Verify nonce matches
        if token_payload.request_details.nonce != challenge.nonce {
            return Err(IntegrityError::NonceMismatch);
        }
        
        // Verify timestamp freshness
        let token_time = SystemTime::UNIX_EPOCH + Duration::from_millis(token_payload.request_details.timestamp_millis);
        let age = SystemTime::now().duration_since(token_time).unwrap_or_default();
        
        if age > Duration::from_mins(5) {
            return Err(IntegrityError::StaleToken);
        }
        
        // Perform full verification
        let result = self.verify_device(integrity_token).await?;
        
        // Clean up challenge
        self.remove_challenge(challenge_id).await?;
        
        Ok(result)
    }
}
```

## Fraud Detection

Behavioral analysis and anomaly detection for fraud prevention:

### Device Fingerprinting

```rust
use olocus_integrity::fraud::*;

pub struct DeviceFingerprinter {
    fingerprint_cache: LruCache<String, DeviceFingerprint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceFingerprint {
    pub device_id: String,
    pub hardware_fingerprint: HardwareFingerprint,
    pub software_fingerprint: SoftwareFingerprint,
    pub behavioral_fingerprint: BehavioralFingerprint,
    pub network_fingerprint: NetworkFingerprint,
    pub risk_score: f64,
    pub created_at: SystemTime,
    pub last_seen: SystemTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareFingerprint {
    pub device_model: String,
    pub screen_resolution: String,
    pub cpu_architecture: String,
    pub memory_size: Option<u64>,
    pub storage_size: Option<u64>,
    pub sensors: Vec<String>,              // Available sensors
    pub camera_info: Option<CameraInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoftwareFingerprint {
    pub os_version: String,
    pub app_version: String,
    pub installed_apps: Vec<String>,       // App package names
    pub system_settings: HashMap<String, String>,
    pub fonts: Vec<String>,               // Available fonts
    pub languages: Vec<String>,           // System languages
}

impl DeviceFingerprinter {
    pub fn generate_fingerprint(&self, device_info: &DeviceInfo) -> Result<DeviceFingerprint> {
        let hardware_fp = self.generate_hardware_fingerprint(device_info)?;
        let software_fp = self.generate_software_fingerprint(device_info)?;
        let behavioral_fp = self.generate_behavioral_fingerprint(device_info)?;
        let network_fp = self.generate_network_fingerprint(device_info)?;
        
        // Calculate composite risk score
        let risk_score = self.calculate_risk_score(
            &hardware_fp,
            &software_fp,
            &behavioral_fp,
            &network_fp
        );
        
        Ok(DeviceFingerprint {
            device_id: device_info.device_id.clone(),
            hardware_fingerprint: hardware_fp,
            software_fingerprint: software_fp,
            behavioral_fingerprint: behavioral_fp,
            network_fingerprint: network_fp,
            risk_score,
            created_at: SystemTime::now(),
            last_seen: SystemTime::now(),
        })
    }
    
    fn calculate_risk_score(
        &self,
        hardware: &HardwareFingerprint,
        software: &SoftwareFingerprint,
        behavioral: &BehavioralFingerprint,
        network: &NetworkFingerprint
    ) -> f64 {
        let mut risk = 0.0;
        
        // Hardware risk factors
        if hardware.device_model.contains("emulator") || hardware.device_model.contains("simulator") {
            risk += 0.4; // Emulators are riskier
        }
        
        if hardware.sensors.is_empty() {
            risk += 0.2; // Missing sensors unusual for real devices
        }
        
        // Software risk factors  
        if software.installed_apps.iter().any(|app| app.contains("root") || app.contains("superuser")) {
            risk += 0.5; // Root detection apps
        }
        
        if software.installed_apps.len() < 10 {
            risk += 0.1; // Too few apps for normal device
        }
        
        // Behavioral risk factors
        if behavioral.typing_speed > 200.0 {
            risk += 0.3; // Unusually fast typing (bot behavior)
        }
        
        if behavioral.click_precision > 0.95 {
            risk += 0.2; // Too precise clicking
        }
        
        // Network risk factors
        if network.is_vpn {
            risk += 0.1; // VPN usage slightly increases risk
        }
        
        if network.is_tor {
            risk += 0.3; // Tor usage significantly increases risk
        }
        
        risk.min(1.0) // Cap at 1.0
    }
    
    pub fn compare_fingerprints(&self, fp1: &DeviceFingerprint, fp2: &DeviceFingerprint) -> FingerprintSimilarity {
        let hardware_sim = self.compare_hardware_fingerprints(&fp1.hardware_fingerprint, &fp2.hardware_fingerprint);
        let software_sim = self.compare_software_fingerprints(&fp1.software_fingerprint, &fp2.software_fingerprint);
        let behavioral_sim = self.compare_behavioral_fingerprints(&fp1.behavioral_fingerprint, &fp2.behavioral_fingerprint);
        let network_sim = self.compare_network_fingerprints(&fp1.network_fingerprint, &fp2.network_fingerprint);
        
        let overall_similarity = (hardware_sim + software_sim + behavioral_sim + network_sim) / 4.0;
        
        FingerprintSimilarity {
            overall_similarity,
            hardware_similarity: hardware_sim,
            software_similarity: software_sim,
            behavioral_similarity: behavioral_sim,
            network_similarity: network_sim,
            is_likely_same_device: overall_similarity > 0.8,
            is_suspicious_similarity: overall_similarity > 0.95 && fp1.device_id != fp2.device_id,
        }
    }
}
```

### Behavioral Analysis

```rust
pub struct BehavioralAnalyzer {
    user_patterns: HashMap<String, UserBehaviorProfile>,
    anomaly_detector: AnomalyDetector,
}

#[derive(Debug, Clone)]
pub struct UserBehaviorProfile {
    pub user_id: String,
    pub typical_usage_patterns: UsagePatterns,
    pub location_patterns: LocationPatterns,
    pub temporal_patterns: TemporalPatterns,
    pub interaction_patterns: InteractionPatterns,
    pub baseline_established: bool,
    pub last_updated: SystemTime,
}

#[derive(Debug, Clone)]
pub struct UsagePatterns {
    pub session_durations: StatisticalDistribution,
    pub actions_per_session: StatisticalDistribution,
    pub navigation_patterns: Vec<String>,      // Common navigation paths
    pub feature_usage: HashMap<String, f64>,  // Feature -> usage frequency
}

impl BehavioralAnalyzer {
    pub fn analyze_behavior(&mut self, user_id: &str, session: &UserSession) -> BehavioralAnalysis {
        let profile = self.user_patterns.entry(user_id.to_string())
            .or_insert_with(|| UserBehaviorProfile::new(user_id));
            
        if !profile.baseline_established {
            // Still building baseline - collect data
            profile.update_with_session(session);
            
            if profile.has_sufficient_data() {
                profile.baseline_established = true;
            }
            
            return BehavioralAnalysis {
                risk_score: 0.1, // Low risk during baseline
                anomalies: vec![],
                confidence: 0.3,  // Low confidence without baseline
                recommendation: "Building behavioral baseline".to_string(),
            };
        }
        
        // Analyze against established baseline
        let anomalies = self.detect_anomalies(profile, session);
        let risk_score = self.calculate_behavioral_risk(&anomalies);
        
        // Update profile with new data
        profile.update_with_session(session);
        
        BehavioralAnalysis {
            risk_score,
            anomalies,
            confidence: 0.8, // High confidence with established baseline
            recommendation: self.generate_recommendation(risk_score, &anomalies),
        }
    }
    
    fn detect_anomalies(&self, profile: &UserBehaviorProfile, session: &UserSession) -> Vec<BehavioralAnomaly> {
        let mut anomalies = Vec::new();
        
        // Session duration anomaly
        let duration_zscore = profile.typical_usage_patterns.session_durations
            .z_score(session.duration.as_secs() as f64);
        if duration_zscore.abs() > 3.0 {
            anomalies.push(BehavioralAnomaly {
                anomaly_type: AnomalyType::UnusualSessionDuration,
                severity: if duration_zscore.abs() > 4.0 { AnomalySeverity::High } else { AnomalySeverity::Medium },
                description: format!("Session duration {} standard deviations from normal", duration_zscore.abs()),
                confidence: self.zscore_to_confidence(duration_zscore.abs()),
            });
        }
        
        // Location anomaly
        if let Some(location) = &session.location {
            if let Some(usual_location) = profile.location_patterns.most_common_location() {
                let distance = location.distance_to(&usual_location);
                if distance > profile.location_patterns.typical_radius * 3.0 {
                    anomalies.push(BehavioralAnomaly {
                        anomaly_type: AnomalyType::UnusualLocation,
                        severity: AnomalySeverity::Medium,
                        description: format!("Location {} km from typical area", distance / 1000.0),
                        confidence: 0.7,
                    });
                }
            }
        }
        
        // Temporal pattern anomaly
        let session_hour = session.start_time.hour();
        if !profile.temporal_patterns.is_typical_hour(session_hour) {
            anomalies.push(BehavioralAnomaly {
                anomaly_type: AnomalyType::UnusualTime,
                severity: AnomalySeverity::Low,
                description: format!("Activity at unusual hour: {}", session_hour),
                confidence: 0.6,
            });
        }
        
        // Interaction pattern anomalies
        let typing_speed = session.calculate_average_typing_speed();
        let baseline_typing = profile.interaction_patterns.average_typing_speed;
        
        if (typing_speed - baseline_typing).abs() > baseline_typing * 0.5 {
            anomalies.push(BehavioralAnomaly {
                anomaly_type: AnomalyType::UnusualTypingSpeed,
                severity: AnomalySeverity::Medium,
                description: format!("Typing speed deviation: {} vs {} WPM", typing_speed, baseline_typing),
                confidence: 0.7,
            });
        }
        
        anomalies
    }
}
```

### Velocity Checking

```rust
pub struct VelocityChecker {
    action_history: HashMap<String, VecDeque<ActionRecord>>,
    velocity_limits: VelocityLimits,
}

#[derive(Debug, Clone)]
pub struct VelocityLimits {
    pub max_requests_per_minute: u32,
    pub max_requests_per_hour: u32,
    pub max_requests_per_day: u32,
    pub max_failed_attempts_per_hour: u32,
    pub suspicious_velocity_threshold: f64,
}

impl VelocityChecker {
    pub fn check_velocity(&mut self, user_id: &str, action: &UserAction) -> VelocityCheckResult {
        let now = SystemTime::now();
        
        // Get or create action history for user
        let history = self.action_history.entry(user_id.to_string())
            .or_insert_with(VecDeque::new);
            
        // Clean old entries
        self.clean_old_entries(history, now);
        
        // Add current action
        history.push_back(ActionRecord {
            action_type: action.action_type.clone(),
            timestamp: now,
            success: action.success,
            metadata: action.metadata.clone(),
        });
        
        // Check velocity limits
        let velocity_stats = self.calculate_velocity_stats(history, now);
        let violations = self.check_velocity_violations(&velocity_stats);
        
        VelocityCheckResult {
            allowed: violations.is_empty(),
            violations,
            velocity_stats,
            risk_score: self.calculate_velocity_risk(&velocity_stats),
        }
    }
    
    fn calculate_velocity_stats(&self, history: &VecDeque<ActionRecord>, now: SystemTime) -> VelocityStats {
        let one_minute_ago = now - Duration::from_secs(60);
        let one_hour_ago = now - Duration::from_secs(3600);
        let one_day_ago = now - Duration::from_secs(86400);
        
        let mut stats = VelocityStats::default();
        
        for record in history {
            if record.timestamp >= one_minute_ago {
                stats.requests_last_minute += 1;
                if !record.success {
                    stats.failed_requests_last_minute += 1;
                }
            }
            
            if record.timestamp >= one_hour_ago {
                stats.requests_last_hour += 1;
                if !record.success {
                    stats.failed_requests_last_hour += 1;
                }
            }
            
            if record.timestamp >= one_day_ago {
                stats.requests_last_day += 1;
                if !record.success {
                    stats.failed_requests_last_day += 1;
                }
            }
        }
        
        // Calculate velocity (requests per second over different windows)
        stats.velocity_per_second_1min = stats.requests_last_minute as f64 / 60.0;
        stats.velocity_per_second_1hour = stats.requests_last_hour as f64 / 3600.0;
        
        stats
    }
    
    fn check_velocity_violations(&self, stats: &VelocityStats) -> Vec<VelocityViolation> {
        let mut violations = Vec::new();
        
        if stats.requests_last_minute > self.velocity_limits.max_requests_per_minute {
            violations.push(VelocityViolation {
                violation_type: VelocityViolationType::ExcessiveRequestsPerMinute,
                limit: self.velocity_limits.max_requests_per_minute as f64,
                actual: stats.requests_last_minute as f64,
                severity: ViolationSeverity::High,
            });
        }
        
        if stats.requests_last_hour > self.velocity_limits.max_requests_per_hour {
            violations.push(VelocityViolation {
                violation_type: VelocityViolationType::ExcessiveRequestsPerHour,
                limit: self.velocity_limits.max_requests_per_hour as f64,
                actual: stats.requests_last_hour as f64,
                severity: ViolationSeverity::Medium,
            });
        }
        
        if stats.failed_requests_last_hour > self.velocity_limits.max_failed_attempts_per_hour {
            violations.push(VelocityViolation {
                violation_type: VelocityViolationType::ExcessiveFailedAttempts,
                limit: self.velocity_limits.max_failed_attempts_per_hour as f64,
                actual: stats.failed_requests_last_hour as f64,
                severity: ViolationSeverity::High,
            });
        }
        
        violations
    }
}
```

## Integration Examples

### Complete Integrity Verification Flow

```rust
use olocus_integrity::*;

pub struct IntegrityManager {
    ios_verifier: Option<AppAttestVerifier>,
    android_verifier: Option<PlayIntegrityVerifier>,
    fraud_detector: FraudDetectionEngine,
    verification_cache: LruCache<String, IntegrityResult>,
}

impl IntegrityManager {
    pub async fn verify_device_integrity(
        &mut self,
        request: &IntegrityVerificationRequest
    ) -> Result<IntegrityVerificationResponse> {
        
        // Check cache first
        if let Some(cached_result) = self.verification_cache.get(&request.device_id) {
            if !self.is_result_expired(cached_result) {
                return Ok(IntegrityVerificationResponse::from_result(cached_result.clone()));
            }
        }
        
        // Perform platform-specific verification
        let platform_result = match request.platform {
            Platform::iOS => {
                if let Some(ref verifier) = self.ios_verifier {
                    verifier.verify_device(&request.device_id).await?
                } else {
                    return Err(IntegrityError::PlatformNotSupported(Platform::iOS));
                }
            },
            Platform::Android => {
                if let Some(ref verifier) = self.android_verifier {
                    verifier.verify_device(&request.integrity_token).await?
                } else {
                    return Err(IntegrityError::PlatformNotSupported(Platform::Android));
                }
            },
            Platform::Web => {
                // Web-based verification (WebAuthn, etc.)
                self.verify_web_device(&request).await?
            }
        };
        
        // Perform fraud detection
        let fraud_result = self.fraud_detector.analyze_device(&request.device_info).await?;
        
        // Combine results
        let combined_result = self.combine_verification_results(
            platform_result,
            fraud_result
        )?;
        
        // Cache result
        self.verification_cache.insert(
            request.device_id.clone(),
            combined_result.clone()
        );
        
        // Create response with recommendations
        let response = IntegrityVerificationResponse {
            device_id: request.device_id.clone(),
            verification_successful: combined_result.integrity_level >= IntegrityLevel::Medium,
            integrity_level: combined_result.integrity_level,
            risk_factors: combined_result.risk_factors,
            recommendations: self.generate_recommendations(&combined_result),
            expires_at: combined_result.expires_at,
            metadata: self.create_verification_metadata(&request, &combined_result),
        };
        
        Ok(response)
    }
    
    fn combine_verification_results(
        &self,
        platform: IntegrityResult,
        fraud: FraudAnalysisResult
    ) -> Result<IntegrityResult> {
        
        let mut combined_risk_factors = platform.risk_factors;
        combined_risk_factors.extend(fraud.risk_factors);
        
        // Calculate combined integrity level
        let platform_score = match platform.integrity_level {
            IntegrityLevel::High => 0.9,
            IntegrityLevel::Medium => 0.7,
            IntegrityLevel::Low => 0.4,
            IntegrityLevel::Critical => 0.1,
        };
        
        let fraud_penalty = fraud.risk_score;
        let combined_score = platform_score * (1.0 - fraud_penalty);
        
        let combined_level = match combined_score {
            s if s >= 0.8 => IntegrityLevel::High,
            s if s >= 0.6 => IntegrityLevel::Medium,
            s if s >= 0.3 => IntegrityLevel::Low,
            _ => IntegrityLevel::Critical,
        };
        
        Ok(IntegrityResult {
            device_id: platform.device_id,
            platform: platform.platform,
            attestation_valid: platform.attestation_valid,
            integrity_level: combined_level,
            risk_factors: combined_risk_factors,
            timestamp: SystemTime::now(),
            expires_at: platform.expires_at,
        })
    }
}
```

## Testing & Validation

```rust
#[cfg(test)]
mod integrity_tests {
    use super::*;
    
    #[test]
    fn test_device_fingerprint_similarity() {
        let fingerprinter = DeviceFingerprinter::new();
        
        // Create two similar device fingerprints
        let device1 = create_test_device_info("iPhone13,4", "iOS 15.0");
        let device2 = create_test_device_info("iPhone13,4", "iOS 15.1"); // Same device, different OS
        
        let fp1 = fingerprinter.generate_fingerprint(&device1).unwrap();
        let fp2 = fingerprinter.generate_fingerprint(&device2).unwrap();
        
        let similarity = fingerprinter.compare_fingerprints(&fp1, &fp2);
        
        assert!(similarity.is_likely_same_device);
        assert!(!similarity.is_suspicious_similarity); // Same device ID
        assert!(similarity.overall_similarity > 0.8);
    }
    
    #[tokio::test]
    async fn test_velocity_checking() {
        let mut checker = VelocityChecker::new(VelocityLimits {
            max_requests_per_minute: 10,
            max_requests_per_hour: 100,
            max_requests_per_day: 1000,
            max_failed_attempts_per_hour: 5,
            suspicious_velocity_threshold: 0.5,
        });
        
        let user_id = "test_user";
        
        // Send normal requests
        for _ in 0..5 {
            let action = UserAction {
                action_type: "login".to_string(),
                success: true,
                metadata: HashMap::new(),
            };
            
            let result = checker.check_velocity(user_id, &action);
            assert!(result.allowed);
        }
        
        // Send excessive requests
        for _ in 0..20 {
            let action = UserAction {
                action_type: "api_call".to_string(),
                success: true,
                metadata: HashMap::new(),
            };
            
            let result = checker.check_velocity(user_id, &action);
            // Should be blocked after exceeding limit
        }
        
        let final_check = checker.check_velocity(user_id, &UserAction {
            action_type: "test".to_string(),
            success: true,
            metadata: HashMap::new(),
        });
        
        assert!(!final_check.allowed);
        assert!(!final_check.violations.is_empty());
    }
}
```

## Related Documentation

- [Trust Networks](./trust-networks.md) - Device trust integration
- [HSM Integration](./hsm-integration.md) - Hardware attestation
- [Keystore](./keystore.md) - Secure key management
- [Privacy Extension](/extensions/privacy/) - Privacy-preserving attestation