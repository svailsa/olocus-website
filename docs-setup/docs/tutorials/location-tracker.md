---
id: location-tracker
title: Build a Location Tracker
sidebar_position: 1
---

# Build a Location Tracker

Learn how to build a privacy-preserving location tracker using Olocus Protocol.

## What We'll Build

A location tracking application that:
- Records GPS positions with accuracy
- Detects visits to significant locations
- Preserves privacy with obfuscation
- Creates an immutable audit trail

## Prerequisites

- Rust 1.75+
- Basic understanding of GPS/location services
- Familiarity with async Rust (helpful but not required)

## Step 1: Project Setup

Create a new Rust project:

```bash
cargo new olocus-tracker
cd olocus-tracker
```

Add dependencies to `Cargo.toml`:

```toml
[dependencies]
olocus-core = "0.1"
olocus-location = "0.1"
olocus-privacy = "0.1"
olocus-storage = { version = "0.1", features = ["sqlite"] }
tokio = { version = "1.0", features = ["full"] }
chrono = "0.4"
```

## Step 2: Basic Location Tracking

Create `src/tracker.rs`:

```rust
use olocus_core::{
    Block, BlockPayload, generate_key, current_timestamp,
    Measurement, Value, Uncertainty, Provenance, Source,
    ValidityWindow, Coordinate
};
use olocus_location::{LocationPayload, LocationProvider};

pub struct LocationTracker {
    signing_key: [u8; 32],
    chain: Vec<Block<LocationPayload>>,
}

impl LocationTracker {
    pub fn new() -> Self {
        let (signing_key, _) = generate_key();
        Self {
            signing_key,
            chain: Vec::new(),
        }
    }
    
    pub fn record_location(
        &mut self,
        latitude: f64,
        longitude: f64,
        accuracy: f32,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Convert to fixed-point
        let lat_fixed = Coordinate::latitude_to_fixed(latitude);
        let lon_fixed = Coordinate::longitude_to_fixed(longitude);
        
        // Create location payload with measurement
        let location = LocationPayload {
            measurement: Measurement {
                value: Value::Point2D {
                    lat: lat_fixed,
                    lon: lon_fixed,
                },
                uncertainty: Uncertainty::Circular {
                    angle: 0.0,
                    radius: accuracy as f64,
                },
                provenance: Provenance {
                    source: Source::Sensor {
                        device_id: [0; 32], // Your device ID
                        sensor_type: 0x0001, // GPS
                        calibration_id: None,
                    },
                    transformations: vec![],
                    attestations: vec![],
                },
                validity: ValidityWindow::new(
                    current_timestamp() as i64,
                    Some((current_timestamp() + 300) as i64), // Valid for 5 minutes
                ),
            },
            provider: LocationProvider::Gps,
            metadata: Default::default(),
        };
        
        // Create block
        let block = if self.chain.is_empty() {
            Block::genesis(location, &self.signing_key, current_timestamp())
        } else {
            Block::next(
                self.chain.last().unwrap(),
                location,
                &self.signing_key,
                current_timestamp(),
            )?
        };
        
        // Verify and add to chain
        block.verify_signature()?;
        self.chain.push(block);
        
        Ok(())
    }
}
```

## Step 3: Visit Detection

Add visit detection using DBSCAN clustering:

```rust
use olocus_location::{
    VisitDetector, Visit, BuiltInClusteringAlgorithm,
    ClusteringAlgorithm,
};

impl LocationTracker {
    pub fn detect_visits(&self) -> Vec<Visit> {
        let detector = VisitDetector::new()
            .with_min_duration(300)  // 5 minutes minimum
            .with_max_radius(100.0);  // 100 meter radius
        
        // Extract locations from chain
        let locations: Vec<_> = self.chain
            .iter()
            .map(|block| &block.payload)
            .collect();
        
        // Detect visits using DBSCAN
        let visits = detector.detect_visits(&locations);
        
        // Classify visits
        for visit in &visits {
            let visit_type = self.classify_visit(visit);
            println!("Visit detected: {:?} at {}", 
                visit_type, 
                visit.start_time
            );
        }
        
        visits
    }
    
    fn classify_visit(&self, visit: &Visit) -> VisitType {
        let duration = visit.end_time - visit.start_time;
        
        if duration > 28800 { // 8 hours
            VisitType::Home
        } else if duration > 14400 { // 4 hours
            VisitType::Work
        } else if duration > 1800 { // 30 minutes
            VisitType::Shopping
        } else {
            VisitType::Transit
        }
    }
}

#[derive(Debug)]
enum VisitType {
    Home,
    Work,
    Shopping,
    Transit,
}
```

## Step 4: Privacy Protection

Add location obfuscation for privacy:

```rust
use olocus_privacy::{
    BuiltInObfuscation, ObfuscationMethod,
    PrivacyLevel,
};

impl LocationTracker {
    pub fn record_private_location(
        &mut self,
        latitude: f64,
        longitude: f64,
        accuracy: f32,
        privacy_level: PrivacyLevel,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Apply obfuscation based on privacy level
        let obfuscator = match privacy_level {
            PrivacyLevel::Low => BuiltInObfuscation::GridSnapping {
                grid_size_meters: 10.0,
            },
            PrivacyLevel::Medium => BuiltInObfuscation::GaussianNoise {
                sigma_meters: 50.0,
            },
            PrivacyLevel::High => BuiltInObfuscation::GridSnapping {
                grid_size_meters: 100.0,
            },
        };
        
        // Obfuscate location
        let (obf_lat, obf_lon) = obfuscator.obfuscate(
            latitude, 
            longitude
        )?;
        
        // Record obfuscated location with updated uncertainty
        self.record_location_with_uncertainty(
            obf_lat,
            obf_lon,
            accuracy + obfuscator.added_uncertainty(),
        )
    }
}

#[derive(Debug)]
pub enum PrivacyLevel {
    Low,    // 10m grid snapping
    Medium, // 50m Gaussian noise
    High,   // 100m grid snapping
}
```

## Step 5: Persistent Storage

Add SQLite storage for the location chain:

```rust
use olocus_storage::{BuiltInStorageBackend, StorageBackend};
use std::path::PathBuf;

impl LocationTracker {
    pub async fn save_to_disk(&self) -> Result<(), Box<dyn std::error::Error>> {
        let storage = BuiltInStorageBackend::Sqlite {
            path: PathBuf::from("locations.db"),
        };
        
        // Initialize storage
        storage.initialize().await?;
        
        // Save each block
        for block in &self.chain {
            let hash = block.hash();
            let data = block.to_bytes()?;
            storage.put(&hash, &data).await?;
        }
        
        Ok(())
    }
    
    pub async fn load_from_disk() -> Result<Self, Box<dyn std::error::Error>> {
        let storage = BuiltInStorageBackend::Sqlite {
            path: PathBuf::from("locations.db"),
        };
        
        // Load chain from storage
        let blocks = storage.list(1000, 0).await?;
        
        let mut chain = Vec::new();
        for hash in blocks {
            if let Some(data) = storage.get(&hash).await? {
                let block = Block::<LocationPayload>::from_bytes(&data)?;
                chain.push(block);
            }
        }
        
        // Verify chain integrity
        olocus_core::verify_chain(&chain)?;
        
        Ok(Self {
            signing_key: generate_key().0,
            chain,
        })
    }
}
```

## Step 6: Real-time Tracking

Create the main application in `src/main.rs`:

```rust
use olocus_tracker::{LocationTracker, PrivacyLevel};
use tokio::time::{sleep, Duration};
use std::f64::consts::PI;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut tracker = LocationTracker::new();
    
    // Simulate GPS updates
    println!("Starting location tracking...");
    
    for i in 0..100 {
        // Simulate movement (circular path for demo)
        let angle = (i as f64) * 2.0 * PI / 100.0;
        let latitude = 37.7749 + 0.001 * angle.cos();
        let longitude = -122.4194 + 0.001 * angle.sin();
        let accuracy = 5.0 + (i as f32 % 10) as f32; // Variable accuracy
        
        // Determine privacy level based on time of day
        let privacy = if i % 24 < 8 {
            PrivacyLevel::High  // Night time - high privacy
        } else if i % 24 < 18 {
            PrivacyLevel::Low   // Day time - low privacy
        } else {
            PrivacyLevel::Medium // Evening - medium privacy
        };
        
        // Record location
        tracker.record_private_location(
            latitude,
            longitude,
            accuracy,
            privacy,
        )?;
        
        println!("Location {} recorded: {:.6}, {:.6} (±{}m)", 
            i + 1, latitude, longitude, accuracy
        );
        
        // Check for visits every 10 locations
        if i % 10 == 9 {
            let visits = tracker.detect_visits();
            println!("Found {} visits", visits.len());
        }
        
        // Simulate GPS update interval
        sleep(Duration::from_secs(1)).await;
    }
    
    // Save to disk
    tracker.save_to_disk().await?;
    println!("Location chain saved to disk");
    
    // Final visit detection
    let visits = tracker.detect_visits();
    println!("\nFinal Summary:");
    println!("Total locations: {}", tracker.chain.len());
    println!("Total visits: {}", visits.len());
    
    // Verify chain integrity
    olocus_core::verify_chain(&tracker.chain)?;
    println!("Chain integrity verified ✓");
    
    Ok(())
}
```

## Step 7: Advanced Features

### Spoofing Detection

Add velocity-based spoofing detection:

```rust
use olocus_location::{SpoofingDetector, BuiltInSpoofingDetector};

impl LocationTracker {
    pub fn check_for_spoofing(&self) -> Vec<SpoofingAlert> {
        let detector = BuiltInSpoofingDetector::VelocityCheck {
            max_speed_ms: 55.0, // ~200 km/h max realistic speed
        };
        
        let mut alerts = Vec::new();
        
        for window in self.chain.windows(2) {
            let prev = &window[0].payload;
            let curr = &window[1].payload;
            
            if detector.is_suspicious(prev, curr) {
                alerts.push(SpoofingAlert {
                    timestamp: curr.measurement.validity.start,
                    reason: "Impossible velocity detected".to_string(),
                });
            }
        }
        
        alerts
    }
}
```

### Geofencing

Add geofence monitoring:

```rust
pub struct Geofence {
    pub center_lat: f64,
    pub center_lon: f64,
    pub radius_meters: f64,
    pub name: String,
}

impl LocationTracker {
    pub fn check_geofences(
        &self,
        geofences: &[Geofence],
    ) -> Vec<GeofenceEvent> {
        let mut events = Vec::new();
        
        for block in &self.chain {
            let lat = Coordinate::fixed_to_latitude(
                block.payload.measurement.value.lat()
            );
            let lon = Coordinate::fixed_to_longitude(
                block.payload.measurement.value.lon()
            );
            
            for fence in geofences {
                let distance = Coordinate::haversine_distance(
                    Coordinate::latitude_to_fixed(fence.center_lat),
                    Coordinate::longitude_to_fixed(fence.center_lon),
                    Coordinate::latitude_to_fixed(lat),
                    Coordinate::longitude_to_fixed(lon),
                );
                
                if distance <= fence.radius_meters {
                    events.push(GeofenceEvent::Enter {
                        fence_name: fence.name.clone(),
                        timestamp: block.header.timestamp,
                    });
                }
            }
        }
        
        events
    }
}
```

## Step 8: Testing

Create tests in `src/lib.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_location_recording() {
        let mut tracker = LocationTracker::new();
        
        // Record location
        tracker.record_location(37.7749, -122.4194, 10.0).unwrap();
        
        assert_eq!(tracker.chain.len(), 1);
        
        // Verify block
        let block = &tracker.chain[0];
        assert!(block.verify_signature().is_ok());
    }
    
    #[test]
    fn test_visit_detection() {
        let mut tracker = LocationTracker::new();
        
        // Record multiple locations at same spot (visit)
        for _ in 0..10 {
            tracker.record_location(37.7749, -122.4194, 5.0).unwrap();
        }
        
        let visits = tracker.detect_visits();
        assert!(visits.len() > 0);
    }
    
    #[test]
    fn test_privacy_obfuscation() {
        let mut tracker = LocationTracker::new();
        
        // Record with high privacy
        tracker.record_private_location(
            37.7749, 
            -122.4194, 
            5.0,
            PrivacyLevel::High
        ).unwrap();
        
        // Location should be snapped to grid
        let block = &tracker.chain[0];
        let lat = Coordinate::fixed_to_latitude(
            block.payload.measurement.value.lat()
        );
        
        // Check grid snapping (100m grid)
        let grid_size = 100.0 / 111111.0; // meters to degrees
        assert!((lat % grid_size).abs() < 0.0001);
    }
}
```

## Running the Application

1. Build and run:
```bash
cargo build --release
cargo run --release
```

2. Run tests:
```bash
cargo test
```

3. Check the output:
- Watch real-time location tracking
- See visit detection results
- Verify chain integrity

## Next Steps

Congratulations! You've built a privacy-preserving location tracker. Here are some ideas to extend it:

### Add More Features
- [ ] Real GPS integration (using system APIs)
- [ ] Export to GPX/KML formats
- [ ] Web visualization with maps
- [ ] Battery optimization strategies

### Enhance Privacy
- [ ] Implement k-anonymity
- [ ] Add differential privacy
- [ ] Create privacy zones

### Scale It Up
- [ ] Multi-device synchronization
- [ ] Cloud backup
- [ ] Real-time sharing

### Integrate More Extensions
- [ ] Add `olocus-trust` for location attestations
- [ ] Use `olocus-metrics` for tracking statistics
- [ ] Implement `olocus-http` for REST API

## Complete Code

The complete code for this tutorial is available at:
- [Codeberg](https://codeberg.org/olocus/tutorials/location-tracker)
- [Codeberg](https://codeberg.org/olocus/tutorials/location-tracker)

## Resources

- [Location Extension Docs](../extensions/location/tracking)
- [Privacy Extension Docs](../extensions/privacy/techniques)
- [API Reference](../api/core)
- [Community Forum](https://codeberg.org/olocus/forum/issues)