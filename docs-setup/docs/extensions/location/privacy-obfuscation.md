---
id: privacy-obfuscation
title: Privacy & Obfuscation
sidebar_position: 4
---

# Privacy & Obfuscation

The Location extension provides comprehensive privacy protection techniques to safeguard location data while maintaining utility for legitimate applications.

## Overview

Location privacy is critical for protecting user safety, preventing tracking, and complying with privacy regulations. The system offers multiple obfuscation techniques:

- **Grid Snapping**: Reduce precision to discrete grid cells
- **Noise Addition**: Add controlled random displacement
- **k-Anonymity**: Ensure indistinguishability among k users
- **Differential Privacy**: Provide mathematical privacy guarantees
- **Cloaking**: Use generalized location regions

```rust
use olocus_location::privacy::*;
use olocus_privacy::*; // Core privacy extension integration

// Configure privacy protection
let privacy_config = LocationPrivacyConfig {
    obfuscation_method: ObfuscationMethod::AdaptiveGrid {
        base_cell_size: 100.0,     // 100m base grid
        min_k_anonymity: 5,        // At least 5 users per cell
    },
    noise_level: NoiseLevel::Medium,
    preserve_temporal_patterns: false,
    allow_home_inference: false,
};

let privacy_manager = LocationPrivacyManager::new(privacy_config);
```

## Grid Snapping

Grid snapping reduces location precision by quantizing coordinates to a discrete grid:

### Fixed Grid Snapping

```rust
use olocus_location::privacy::grid::*;

#[derive(Debug, Clone)]
pub struct GridConfig {
    pub cell_size: f64,              // Grid cell size in meters
    pub origin_lat: f64,             // Grid origin latitude
    pub origin_lon: f64,             // Grid origin longitude
    pub add_random_offset: bool,     // Add random offset within cell
}

pub struct GridSnapper {
    config: GridConfig,
}

impl GridSnapper {
    pub fn snap_location(&self, location: &LocationMeasurement) -> LocationMeasurement {
        let lat_degrees = Coordinate::fixed_to_latitude(location.measurement.value.x());
        let lon_degrees = Coordinate::fixed_to_longitude(location.measurement.value.y());
        
        // Convert to meters from origin
        let x_meters = (lon_degrees - self.config.origin_lon) * 111_320.0 * lat_degrees.cos().to_radians();
        let y_meters = (lat_degrees - self.config.origin_lat) * 111_320.0;
        
        // Snap to grid
        let grid_x = (x_meters / self.config.cell_size).floor() * self.config.cell_size;
        let grid_y = (y_meters / self.config.cell_size).floor() * self.config.cell_size;
        
        // Add random offset within cell if enabled
        let (final_x, final_y) = if self.config.add_random_offset {
            let offset_x = rand::random::<f64>() * self.config.cell_size;
            let offset_y = rand::random::<f64>() * self.config.cell_size;
            (grid_x + offset_x, grid_y + offset_y)
        } else {
            // Use cell center
            (grid_x + self.config.cell_size / 2.0, grid_y + self.config.cell_size / 2.0)
        };
        
        // Convert back to coordinates
        let snapped_lon = self.config.origin_lon + final_x / (111_320.0 * lat_degrees.cos().to_radians());
        let snapped_lat = self.config.origin_lat + final_y / 111_320.0;
        
        let mut snapped_location = location.clone();
        snapped_location.measurement.value = Value::Point2D {
            x: Coordinate::latitude_to_fixed(snapped_lat),
            y: Coordinate::longitude_to_fixed(snapped_lon),
        };
        
        // Increase uncertainty to reflect grid cell size
        snapped_location.measurement.uncertainty = Uncertainty::Circular {
            radius: self.config.cell_size / 2.0,
        };
        
        snapped_location
    }
}
```

### Adaptive Grid Snapping

```rust
use olocus_location::privacy::adaptive_grid::*;

pub struct AdaptiveGridSnapper {
    base_cell_size: f64,
    population_density_map: PopulationDensityMap,
    k_anonymity_threshold: usize,
}

impl AdaptiveGridSnapper {
    pub fn snap_location(&self, location: &LocationMeasurement) -> LocationMeasurement {
        // Determine appropriate cell size based on population density
        let density = self.population_density_map.get_density(
            &location.measurement.value.x(),
            &location.measurement.value.y()
        );
        
        // Higher density areas can use smaller cells while maintaining k-anonymity
        let adaptive_cell_size = self.calculate_adaptive_cell_size(density);
        
        let grid_config = GridConfig {
            cell_size: adaptive_cell_size,
            origin_lat: 0.0,
            origin_lon: 0.0,
            add_random_offset: true,
        };
        
        let snapper = GridSnapper::new(grid_config);
        snapper.snap_location(location)
    }
    
    fn calculate_adaptive_cell_size(&self, density: f64) -> f64 {
        // Ensure k-anonymity: cell_area * density >= k_anonymity_threshold
        let required_area = self.k_anonymity_threshold as f64 / density;
        let required_cell_size = required_area.sqrt();
        
        // Use larger of base size and required size
        self.base_cell_size.max(required_cell_size)
    }
}
```

## Noise Addition

Adding controlled random noise provides location privacy while preserving statistical properties:

### Laplacian Noise (Differential Privacy)

```rust
use olocus_location::privacy::noise::*;
use rand_distr::{Distribution, Laplace};

pub struct LaplacianNoiseAdder {
    epsilon: f64,              // Privacy parameter (smaller = more private)
    sensitivity: f64,          // Global sensitivity (max change from single record)
}

impl LaplacianNoiseAdder {
    pub fn new(epsilon: f64) -> Self {
        Self {
            epsilon,
            sensitivity: 1.0,    // 1 meter sensitivity for location data
        }
    }
    
    pub fn add_noise(&self, location: &LocationMeasurement) -> LocationMeasurement {
        let scale = self.sensitivity / self.epsilon;
        let laplace = Laplace::new(0.0, scale).unwrap();
        
        // Add independent noise to each coordinate
        let lat_noise = laplace.sample(&mut rand::thread_rng());
        let lon_noise = laplace.sample(&mut rand::thread_rng());
        
        let original_lat = Coordinate::fixed_to_latitude(location.measurement.value.x());
        let original_lon = Coordinate::fixed_to_longitude(location.measurement.value.y());
        
        // Convert noise from meters to degrees (approximate)
        let lat_degrees = original_lat + lat_noise / 111_320.0;
        let lon_degrees = original_lon + lon_noise / (111_320.0 * original_lat.cos().to_radians());
        
        let mut noisy_location = location.clone();
        noisy_location.measurement.value = Value::Point2D {
            x: Coordinate::latitude_to_fixed(lat_degrees),
            y: Coordinate::longitude_to_fixed(lon_degrees),
        };
        
        // Update uncertainty to reflect added noise
        let original_radius = match location.measurement.uncertainty {
            Uncertainty::Circular { radius } => radius,
            _ => 10.0, // Default uncertainty
        };
        
        // Combine original uncertainty with noise uncertainty
        let noise_std = scale * std::f64::consts::SQRT_2; // Standard deviation of Laplacian
        let combined_uncertainty = (original_radius * original_radius + noise_std * noise_std).sqrt();
        
        noisy_location.measurement.uncertainty = Uncertainty::Circular {
            radius: combined_uncertainty,
        };
        
        noisy_location
    }
}
```

### Gaussian Noise

```rust
use rand_distr::{Normal, Distribution};

pub struct GaussianNoiseAdder {
    std_dev: f64,              // Standard deviation in meters
}

impl GaussianNoiseAdder {
    pub fn add_noise(&self, location: &LocationMeasurement) -> LocationMeasurement {
        let normal = Normal::new(0.0, self.std_dev).unwrap();
        
        let lat_noise = normal.sample(&mut rand::thread_rng());
        let lon_noise = normal.sample(&mut rand::thread_rng());
        
        let original_lat = Coordinate::fixed_to_latitude(location.measurement.value.x());
        let original_lon = Coordinate::fixed_to_longitude(location.measurement.value.y());
        
        let lat_degrees = original_lat + lat_noise / 111_320.0;
        let lon_degrees = original_lon + lon_noise / (111_320.0 * original_lat.cos().to_radians());
        
        let mut noisy_location = location.clone();
        noisy_location.measurement.value = Value::Point2D {
            x: Coordinate::latitude_to_fixed(lat_degrees),
            y: Coordinate::longitude_to_fixed(lon_degrees),
        };
        
        // Gaussian noise adds to uncertainty
        noisy_location.measurement.uncertainty = Uncertainty::Gaussian {
            std_dev_x: self.std_dev,
            std_dev_y: self.std_dev,
            correlation: 0.0,
        };
        
        noisy_location
    }
}
```

## k-Anonymity

k-Anonymity ensures each location is indistinguishable from at least k-1 other locations:

### Spatial k-Anonymity

```rust
use olocus_location::privacy::k_anonymity::*;

pub struct SpatialKAnonymizer {
    k: usize,                  // Minimum group size
    spatial_index: SpatialIndex,
    user_locations: HashMap<UserId, Vec<LocationMeasurement>>,
}

impl SpatialKAnonymizer {
    pub fn anonymize_location(
        &self,
        user_id: UserId,
        location: &LocationMeasurement
    ) -> Result<AnonymizedLocation> {
        // Find nearby users within time window
        let nearby_users = self.find_nearby_users(location, Duration::from_mins(10))?;
        
        if nearby_users.len() < self.k - 1 {
            // Not enough users for k-anonymity
            return Err(PrivacyError::InsufficientKAnonymity {
                required: self.k,
                available: nearby_users.len() + 1,
            });
        }
        
        // Select k users (including current user)
        let mut selected_users = nearby_users;
        selected_users.truncate(self.k - 1);
        selected_users.push(user_id);
        
        // Calculate anonymization region (minimum bounding rectangle)
        let anonymization_region = self.calculate_mbr(&selected_users, location)?;
        
        Ok(AnonymizedLocation {
            region: anonymization_region,
            k_value: self.k,
            user_count: selected_users.len(),
            confidence: self.calculate_confidence(&anonymization_region),
        })
    }
    
    fn find_nearby_users(
        &self,
        location: &LocationMeasurement,
        time_window: Duration
    ) -> Result<Vec<UserId>> {
        let current_time = SystemTime::now();
        let mut nearby_users = Vec::new();
        
        for (user_id, locations) in &self.user_locations {
            // Check if user has recent location data
            if let Some(recent_location) = locations.iter()
                .filter(|loc| current_time.duration_since(loc.timestamp).unwrap_or_default() <= time_window)
                .last() 
            {
                // Check if within anonymization radius
                let distance = Coordinate::haversine_distance(
                    location.measurement.value.x(), location.measurement.value.y(),
                    recent_location.measurement.value.x(), recent_location.measurement.value.y()
                );
                
                if distance <= self.max_anonymization_radius {
                    nearby_users.push(*user_id);
                }
            }
        }
        
        Ok(nearby_users)
    }
    
    fn calculate_mbr(&self, users: &[UserId], location: &LocationMeasurement) -> Result<BoundingBox> {
        let mut min_lat = f64::INFINITY;
        let mut max_lat = f64::NEG_INFINITY;
        let mut min_lon = f64::INFINITY;
        let mut max_lon = f64::NEG_INFINITY;
        
        // Include all user locations
        for &user_id in users {
            if let Some(user_locations) = self.user_locations.get(&user_id) {
                if let Some(latest_location) = user_locations.last() {
                    let lat = Coordinate::fixed_to_latitude(latest_location.measurement.value.x());
                    let lon = Coordinate::fixed_to_longitude(latest_location.measurement.value.y());
                    
                    min_lat = min_lat.min(lat);
                    max_lat = max_lat.max(lat);
                    min_lon = min_lon.min(lon);
                    max_lon = max_lon.max(lon);
                }
            }
        }
        
        Ok(BoundingBox {
            min_lat: Coordinate::latitude_to_fixed(min_lat),
            max_lat: Coordinate::latitude_to_fixed(max_lat),
            min_lon: Coordinate::longitude_to_fixed(min_lon),
            max_lon: Coordinate::longitude_to_fixed(max_lon),
        })
    }
}
```

### Temporal k-Anonymity

```rust
pub struct TemporalKAnonymizer {
    k: usize,
    time_window: Duration,
    location_buffer: HashMap<UserId, VecDeque<LocationMeasurement>>,
}

impl TemporalKAnonymizer {
    pub fn anonymize_trajectory(
        &mut self,
        user_id: UserId,
        locations: &[LocationMeasurement]
    ) -> Result<Vec<AnonymizedLocation>> {
        let mut anonymized_trajectory = Vec::new();
        
        for location in locations {
            // Add to buffer
            self.location_buffer.entry(user_id)
                .or_default()
                .push_back(location.clone());
            
            // Clean old locations
            self.cleanup_old_locations();
            
            // Try to anonymize current location
            if let Ok(anon_location) = self.try_anonymize_current_location(user_id, location) {
                anonymized_trajectory.push(anon_location);
            }
        }
        
        Ok(anonymized_trajectory)
    }
    
    fn try_anonymize_current_location(
        &self,
        user_id: UserId,
        location: &LocationMeasurement
    ) -> Result<AnonymizedLocation> {
        let current_time = location.timestamp;
        let time_start = current_time - self.time_window;
        
        let mut temporal_users = Vec::new();
        
        // Find users active in time window
        for (&uid, user_locations) in &self.location_buffer {
            let locations_in_window: Vec<&LocationMeasurement> = user_locations
                .iter()
                .filter(|loc| loc.timestamp >= time_start && loc.timestamp <= current_time)
                .collect();
                
            if !locations_in_window.is_empty() {
                temporal_users.push(uid);
            }
        }
        
        if temporal_users.len() < self.k {
            return Err(PrivacyError::InsufficientTemporalKAnonymity {
                required: self.k,
                available: temporal_users.len(),
                time_window: self.time_window,
            });
        }
        
        // Calculate temporal-spatial anonymization region
        self.calculate_temporal_anonymization_region(&temporal_users, time_start, current_time)
    }
}
```

## Location Cloaking

Cloaking replaces exact locations with generalized regions:

### Hierarchical Cloaking

```rust
use olocus_location::privacy::cloaking::*;

pub struct HierarchicalCloaker {
    quad_tree: QuadTree,
    min_region_size: f64,      // Minimum cloaking region size (meters)
    max_region_size: f64,      // Maximum cloaking region size (meters)
}

impl HierarchicalCloaker {
    pub fn cloak_location(
        &self,
        location: &LocationMeasurement,
        privacy_level: PrivacyLevel
    ) -> CloakedLocation {
        let target_region_size = match privacy_level {
            PrivacyLevel::Low => self.min_region_size,
            PrivacyLevel::Medium => (self.min_region_size + self.max_region_size) / 2.0,
            PrivacyLevel::High => self.max_region_size,
        };
        
        // Find appropriate quad tree node
        let node = self.quad_tree.find_containing_region(
            location,
            target_region_size
        );
        
        CloakedLocation {
            region: node.bounding_box,
            center: node.center,
            radius: node.radius,
            privacy_level,
            cloaking_method: CloakingMethod::Hierarchical,
        }
    }
}
```

### Semantic Cloaking

```rust
pub struct SemanticCloaker {
    poi_database: POIDatabase,
    semantic_regions: Vec<SemanticRegion>,
}

impl SemanticCloaker {
    pub fn cloak_semantically(
        &self,
        location: &LocationMeasurement,
        semantic_level: SemanticLevel
    ) -> SemanticallyCloakedLocation {
        match semantic_level {
            SemanticLevel::Building => {
                // Return building-level region
                let building = self.poi_database.find_building(location)?;
                SemanticallyCloakedLocation::Building {
                    name: building.name,
                    address: building.address,
                    region: building.footprint,
                }
            },
            SemanticLevel::Block => {
                // Return city block
                let block = self.find_city_block(location)?;
                SemanticallyCloakedLocation::Block {
                    bounds: block.bounds,
                    approximate_address: block.representative_address,
                }
            },
            SemanticLevel::Neighborhood => {
                // Return neighborhood region
                let neighborhood = self.find_neighborhood(location)?;
                SemanticallyCloakedLocation::Neighborhood {
                    name: neighborhood.name,
                    bounds: neighborhood.bounds,
                }
            },
            SemanticLevel::City => {
                // Return city-level region
                let city = self.find_city(location)?;
                SemanticallyCloakedLocation::City {
                    name: city.name,
                    bounds: city.bounds,
                }
            }
        }
    }
}
```

## Privacy Metrics

### Privacy Assessment

```rust
use olocus_location::privacy::metrics::*;

pub struct PrivacyMetrics;

impl PrivacyMetrics {
    pub fn calculate_anonymity_level(
        original: &LocationMeasurement,
        anonymized: &AnonymizedLocation
    ) -> AnonymityMetrics {
        let area = anonymized.region.area_square_meters();
        let perimeter = anonymized.region.perimeter_meters();
        
        // Geometric privacy metrics
        let geometric_privacy = area.log10(); // Log-scale for interpretability
        let shape_privacy = (4.0 * std::f64::consts::PI * area) / (perimeter * perimeter);
        
        // Information loss
        let information_loss = Self::calculate_information_loss(original, anonymized);
        
        AnonymityMetrics {
            k_value: anonymized.k_value,
            geometric_privacy,
            shape_privacy,
            area_square_meters: area,
            information_loss,
            privacy_score: Self::calculate_overall_privacy_score(
                anonymized.k_value,
                geometric_privacy,
                information_loss
            ),
        }
    }
    
    fn calculate_information_loss(
        original: &LocationMeasurement,
        anonymized: &AnonymizedLocation
    ) -> f64 {
        let original_point = Point2D {
            x: Coordinate::fixed_to_latitude(original.measurement.value.x()),
            y: Coordinate::fixed_to_longitude(original.measurement.value.y()),
        };
        
        let region_center = anonymized.region.center();
        let displacement = original_point.distance_to(&region_center);
        let region_radius = anonymized.region.max_radius();
        
        // Normalized information loss [0, 1]
        (displacement / region_radius).min(1.0)
    }
    
    fn calculate_overall_privacy_score(
        k_value: usize,
        geometric_privacy: f64,
        information_loss: f64
    ) -> f64 {
        // Weighted combination of privacy factors
        let k_score = (k_value as f64).log10() / 3.0; // Normalize to ~[0, 1]
        let geo_score = geometric_privacy / 10.0;     // Normalize area score
        let utility_score = 1.0 - information_loss;   // Higher utility = lower info loss
        
        // Balanced privacy-utility score
        (k_score * 0.4 + geo_score * 0.3 + utility_score * 0.3).min(1.0)
    }
}
```

### Attack Resistance Analysis

```rust
pub struct AttackResistanceAnalyzer {
    background_knowledge: BackgroundKnowledge,
    attack_models: Vec<AttackModel>,
}

impl AttackResistanceAnalyzer {
    pub fn assess_resistance(
        &self,
        trajectory: &[AnonymizedLocation],
        user_profile: &UserProfile
    ) -> ResistanceAssessment {
        let mut resistances = Vec::new();
        
        for attack_model in &self.attack_models {
            let resistance = match attack_model {
                AttackModel::HomogeneityAttack => {
                    self.assess_homogeneity_resistance(trajectory)
                },
                AttackModel::BackgroundKnowledgeAttack => {
                    self.assess_background_knowledge_resistance(trajectory, user_profile)
                },
                AttackModel::InferenceAttack => {
                    self.assess_inference_resistance(trajectory)
                },
                AttackModel::LinkageAttack => {
                    self.assess_linkage_resistance(trajectory, user_profile)
                }
            };
            
            resistances.push(resistance);
        }
        
        ResistanceAssessment {
            overall_resistance: resistances.iter().min_by(|a, b| a.partial_cmp(b).unwrap()).unwrap().clone(),
            individual_resistances: resistances,
            vulnerability_score: self.calculate_vulnerability_score(&resistances),
            recommendations: self.generate_recommendations(&resistances),
        }
    }
}
```

## Integration with Core Privacy Extension

### Privacy Policy Integration

```rust
use olocus_privacy::*;

pub struct LocationPrivacyEngine {
    privacy_techniques: HashMap<TechniqueName, Box<dyn PrivacyTechnique>>,
    data_minimization: DataMinimizationStrategy,
    consent_manager: ConsentManager,
}

impl LocationPrivacyEngine {
    pub fn apply_privacy_policy(
        &self,
        location: &LocationMeasurement,
        user_id: UserId,
        context: &ProcessingContext
    ) -> Result<PrivacyProcessedLocation> {
        // Check consent
        let consent = self.consent_manager.get_consent(user_id, ConsentType::LocationProcessing)?;
        if !consent.is_valid() {
            return Err(PrivacyError::NoConsent);
        }
        
        // Apply data minimization
        let minimized_location = self.data_minimization.minimize(location, context)?;
        
        // Determine required privacy techniques based on policy
        let required_techniques = self.determine_required_techniques(&minimized_location, context)?;
        
        let mut processed_location = minimized_location;
        for technique_name in required_techniques {
            if let Some(technique) = self.privacy_techniques.get(&technique_name) {
                processed_location = technique.apply(&processed_location, context)?;
            }
        }
        
        Ok(PrivacyProcessedLocation {
            location: processed_location,
            applied_techniques: required_techniques,
            privacy_level: self.calculate_privacy_level(&processed_location),
            compliance_status: self.check_compliance(&processed_location, context)?,
        })
    }
}
```

## Real-World Examples

### GDPR Compliance

```rust
use olocus_location::privacy::gdpr::*;

pub struct GDPRLocationProcessor {
    privacy_engine: LocationPrivacyEngine,
    purpose_limitation: PurposeLimitation,
    retention_policy: RetentionPolicy,
}

impl GDPRLocationProcessor {
    pub fn process_for_gdpr(
        &self,
        location: &LocationMeasurement,
        processing_purpose: ProcessingPurpose,
        user_consent: &ConsentRecord
    ) -> Result<GDPRCompliantLocation> {
        // Verify lawful basis
        self.verify_lawful_basis(&processing_purpose, user_consent)?;
        
        // Apply purpose limitation
        let purpose_limited = self.purpose_limitation.apply(location, &processing_purpose)?;
        
        // Apply appropriate privacy techniques
        let privacy_config = match processing_purpose {
            ProcessingPurpose::Navigation => LocationPrivacyConfig {
                obfuscation_method: ObfuscationMethod::LowNoise,
                preserve_temporal_patterns: true,
                allow_home_inference: false,
            },
            ProcessingPurpose::Analytics => LocationPrivacyConfig {
                obfuscation_method: ObfuscationMethod::AdaptiveGrid {
                    base_cell_size: 200.0,
                    min_k_anonymity: 10,
                },
                preserve_temporal_patterns: false,
                allow_home_inference: false,
            },
            ProcessingPurpose::EmergencyServices => LocationPrivacyConfig {
                obfuscation_method: ObfuscationMethod::None, // Emergency exception
                preserve_temporal_patterns: true,
                allow_home_inference: true,
            }
        };
        
        let processed = self.privacy_engine.apply_privacy_config(&purpose_limited, privacy_config)?;
        
        Ok(GDPRCompliantLocation {
            location: processed,
            processing_purpose,
            lawful_basis: user_consent.lawful_basis.clone(),
            retention_until: self.retention_policy.calculate_retention_date(&processing_purpose),
            data_subject_rights: self.calculate_applicable_rights(&processing_purpose),
        })
    }
}
```

### Location Sharing with Trusted Contacts

```rust
pub struct TrustedContactSharing {
    trust_manager: TrustManager,
    privacy_levels: HashMap<ContactId, PrivacyLevel>,
}

impl TrustedContactSharing {
    pub fn share_location_with_contact(
        &self,
        user_location: &LocationMeasurement,
        contact_id: ContactId,
        sharing_context: SharingContext
    ) -> Result<SharedLocation> {
        // Get trust level for contact
        let trust_level = self.trust_manager.get_trust_level(contact_id)?;
        let privacy_level = self.privacy_levels.get(&contact_id)
            .unwrap_or(&PrivacyLevel::Medium);
        
        let shared_location = match (trust_level, privacy_level, sharing_context) {
            (TrustLevel::High, PrivacyLevel::Low, _) => {
                // High trust, low privacy: share exact location
                user_location.clone()
            },
            (TrustLevel::Medium, PrivacyLevel::Medium, SharingContext::Emergency) => {
                // Medium trust, emergency: moderate obfuscation
                self.apply_moderate_obfuscation(user_location)?
            },
            (TrustLevel::Low, _, _) | (_, PrivacyLevel::High, _) => {
                // Low trust or high privacy: strong obfuscation
                self.apply_strong_obfuscation(user_location)?
            }
            _ => {
                // Default: adaptive grid based on context
                self.apply_adaptive_obfuscation(user_location, &sharing_context)?
            }
        };
        
        Ok(SharedLocation {
            location: shared_location,
            contact_id,
            sharing_timestamp: SystemTime::now(),
            privacy_applied: self.get_applied_privacy_level(&shared_location, user_location),
            expires_at: self.calculate_expiry(&sharing_context),
        })
    }
    
    fn apply_adaptive_obfuscation(
        &self,
        location: &LocationMeasurement,
        context: &SharingContext
    ) -> Result<LocationMeasurement> {
        let obfuscation_method = match context {
            SharingContext::SocialMeetup => ObfuscationMethod::GridSnap { cell_size: 50.0 },
            SharingContext::WorkCollaboration => ObfuscationMethod::BuildingLevel,
            SharingContext::FamilyTracking => ObfuscationMethod::LowNoise,
            SharingContext::Emergency => ObfuscationMethod::None,
            SharingContext::General => ObfuscationMethod::AdaptiveGrid {
                base_cell_size: 100.0,
                min_k_anonymity: 3,
            },
        };
        
        let privacy_manager = LocationPrivacyManager::new(LocationPrivacyConfig {
            obfuscation_method,
            noise_level: NoiseLevel::Low,
            preserve_temporal_patterns: true,
            allow_home_inference: false,
        });
        
        privacy_manager.apply_obfuscation(location)
    }
}
```

## Testing & Validation

```rust
#[cfg(test)]
mod privacy_tests {
    use super::*;
    
    #[test]
    fn test_grid_snapping_preserves_general_area() {
        let original_location = create_test_location(37.7749, -122.4194); // SF
        
        let config = GridConfig {
            cell_size: 100.0,
            origin_lat: 0.0,
            origin_lon: 0.0,
            add_random_offset: false,
        };
        
        let snapper = GridSnapper::new(config);
        let snapped = snapper.snap_location(&original_location);
        
        // Should be within reasonable distance
        let distance = Coordinate::haversine_distance(
            original_location.measurement.value.x(), original_location.measurement.value.y(),
            snapped.measurement.value.x(), snapped.measurement.value.y()
        );
        
        assert!(distance <= 100.0 * std::f64::consts::SQRT_2); // Maximum diagonal distance
    }
    
    #[test]
    fn test_differential_privacy_bounds() {
        let location = create_test_location(37.7749, -122.4194);
        let noise_adder = LaplacianNoiseAdder::new(0.1); // Strong privacy
        
        let mut distances = Vec::new();
        
        // Test multiple noise additions
        for _ in 0..1000 {
            let noisy = noise_adder.add_noise(&location);
            let distance = Coordinate::haversine_distance(
                location.measurement.value.x(), location.measurement.value.y(),
                noisy.measurement.value.x(), noisy.measurement.value.y()
            );
            distances.push(distance);
        }
        
        // Most points should be within reasonable bounds for epsilon=0.1
        let median_distance = {
            distances.sort_by(|a, b| a.partial_cmp(b).unwrap());
            distances[distances.len() / 2]
        };
        
        assert!(median_distance > 1.0);   // Should add meaningful noise
        assert!(median_distance < 50.0);  // But not too much for epsilon=0.1
    }
    
    #[test] 
    fn test_k_anonymity_enforcement() {
        let mut anonymizer = SpatialKAnonymizer::new(5); // k=5
        
        // Add insufficient users
        for i in 0..3 {
            let location = create_test_location(37.7749 + i as f64 * 0.0001, -122.4194);
            anonymizer.add_user_location(UserId(i), location);
        }
        
        let test_location = create_test_location(37.7749, -122.4194);
        let result = anonymizer.anonymize_location(UserId(999), &test_location);
        
        // Should fail due to insufficient k-anonymity
        assert!(matches!(result, Err(PrivacyError::InsufficientKAnonymity { .. })));
    }
}
```

## Configuration Guidelines

### Privacy Level Recommendations

```rust
// Public spaces (low privacy concerns)
let public_config = LocationPrivacyConfig {
    obfuscation_method: ObfuscationMethod::GridSnap { cell_size: 25.0 },
    noise_level: NoiseLevel::Low,
    preserve_temporal_patterns: true,
    allow_home_inference: false,
};

// Residential areas (medium privacy concerns)
let residential_config = LocationPrivacyConfig {
    obfuscation_method: ObfuscationMethod::AdaptiveGrid {
        base_cell_size: 100.0,
        min_k_anonymity: 5,
    },
    noise_level: NoiseLevel::Medium,
    preserve_temporal_patterns: false,
    allow_home_inference: false,
};

// Sensitive locations (high privacy concerns)
let sensitive_config = LocationPrivacyConfig {
    obfuscation_method: ObfuscationMethod::SemanticCloaking {
        level: SemanticLevel::Neighborhood,
    },
    noise_level: NoiseLevel::High,
    preserve_temporal_patterns: false,
    allow_home_inference: false,
};
```

## Related Documentation

- [GPS Tracking](./tracking.md) - Core location tracking capabilities
- [Visit Detection](./visit-detection.md) - Visit detection algorithms
- [Privacy Extension](/extensions/privacy/) - Core privacy techniques and compliance
- [Universal Measurement Foundation](/concepts/measurements.md) - Uncertainty and provenance tracking