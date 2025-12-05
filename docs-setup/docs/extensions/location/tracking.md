---
id: tracking
title: GPS Tracking & Coordinates
sidebar_position: 1
---

# GPS Tracking & Coordinates

The Location extension provides robust GPS tracking capabilities with fixed-point coordinate systems for cross-platform determinism and accuracy handling.

## Overview

The tracking system uses the Universal Measurement Foundation from `olocus-core` to represent location data with comprehensive uncertainty and provenance tracking.

```rust
use olocus_location::*;
use olocus_core::measure::*;

// Create a GPS measurement with uncertainty
let location = LocationPayload::new(
    Measurement::new(
        Value::Point2D { 
            x: Coordinate::latitude_to_fixed(37.7749),  // San Francisco
            y: Coordinate::longitude_to_fixed(-122.4194),
        },
        Uncertainty::Circular { radius: 5.0 }, // 5m accuracy
        Provenance::new(Source::Sensor {
            device_id: "gps-001".to_string(),
            sensor_type: "GPS".to_string(),
        }),
    ),
    LocationInfo {
        altitude: Some(100.0), // meters
        accuracy: Some(5.0),
        heading: Some(45.0),
        speed: Some(2.5),
        timestamp: SystemTime::now(),
    }
);
```

## Fixed-Point Coordinate System

All coordinates use fixed-point arithmetic for deterministic cross-platform behavior:

### Coordinate Conversion

```rust
use olocus_core::measure::Coordinate;

// Convert decimal degrees to fixed-point
let lat_fixed = Coordinate::latitude_to_fixed(37.7749);  // → 377749000
let lon_fixed = Coordinate::longitude_to_fixed(-122.4194); // → -1224194000

// Convert back to decimal degrees
let lat_decimal = Coordinate::fixed_to_latitude(377749000);  // → 37.7749
let lon_decimal = Coordinate::fixed_to_longitude(-1224194000); // → -122.4194

// Precision: ~1cm at the equator
assert_eq!(lat_fixed, 377749000);
```

### Distance Calculations

```rust
// Haversine distance between two points (returns meters)
let distance = Coordinate::haversine_distance(
    377749000,  // SF latitude (fixed-point)
    -1224194000, // SF longitude (fixed-point)
    407128000,   // NYC latitude (fixed-point)
    -740059000   // NYC longitude (fixed-point)
);
// Result: ~4100000 meters (4100km)

// Bearing calculation
let bearing = Coordinate::bearing(
    lat1_fixed, lon1_fixed,
    lat2_fixed, lon2_fixed
);
// Result: degrees from north (0-360)
```

## Accuracy Handling

The system provides multiple accuracy representation methods:

### GPS Accuracy Models

```rust
// Horizontal accuracy only
let basic_accuracy = Uncertainty::Circular { radius: 10.0 };

// Elliptical accuracy (different precision in x/y)
let elliptical = Uncertainty::Elliptical {
    semi_major: 15.0,
    semi_minor: 8.0,
    angle: 45.0, // degrees
};

// Confidence-based accuracy
let confidence = Uncertainty::Confidence {
    value: 5.0,
    confidence: 0.95, // 95% confidence within 5m
};

// No accuracy information
let unknown = Uncertainty::Unknown;
```

### Real-World Accuracy Scenarios

```rust
use olocus_location::accuracy::*;

// Indoor GPS (poor accuracy)
let indoor_location = LocationMeasurement::new(
    point_2d,
    Uncertainty::Circular { radius: 50.0 },
    Provenance::new(Source::Sensor {
        device_id: "phone-gps".to_string(),
        sensor_type: "GPS-Indoor".to_string(),
    })
);

// High-precision survey GPS
let survey_location = LocationMeasurement::new(
    point_2d,
    Uncertainty::Circular { radius: 0.1 },
    Provenance::new(Source::Sensor {
        device_id: "survey-001".to_string(),
        sensor_type: "RTK-GPS".to_string(),
    })
);

// Cellular tower triangulation
let cellular_location = LocationMeasurement::new(
    point_2d,
    Uncertainty::Circular { radius: 500.0 },
    Provenance::new(Source::Sensor {
        device_id: "cellular-tower".to_string(),
        sensor_type: "Cellular".to_string(),
    })
);
```

## Data Structures

### LocationPayload

```rust
#[derive(Debug, Clone)]
pub struct LocationPayload {
    pub measurement: Measurement,
    pub info: LocationInfo,
}

#[derive(Debug, Clone)]
pub struct LocationInfo {
    pub altitude: Option<f64>,        // meters above sea level
    pub accuracy: Option<f64>,        // horizontal accuracy (meters)
    pub vertical_accuracy: Option<f64>, // altitude accuracy (meters)
    pub heading: Option<f64>,         // degrees from north (0-360)
    pub speed: Option<f64>,          // meters per second
    pub timestamp: SystemTime,
}
```

### Coordinate System Details

```rust
// Internal representation
pub struct Coordinate {
    pub latitude: i64,   // degrees × 10^7 (-90° to 90°)
    pub longitude: i64,  // degrees × 10^7 (-180° to 180°)
}

// Bounds checking
impl Coordinate {
    pub const MIN_LATITUDE: i64 = -900_000_000;   // -90°
    pub const MAX_LATITUDE: i64 = 900_000_000;    // 90°
    pub const MIN_LONGITUDE: i64 = -1_800_000_000; // -180°
    pub const MAX_LONGITUDE: i64 = 1_800_000_000;  // 180°
    
    pub fn is_valid(&self) -> bool {
        self.latitude >= Self::MIN_LATITUDE && 
        self.latitude <= Self::MAX_LATITUDE &&
        self.longitude >= Self::MIN_LONGITUDE && 
        self.longitude <= Self::MAX_LONGITUDE
    }
}
```

## Tracking Configuration

### Tracking Parameters

```rust
use olocus_location::tracking::*;

let config = TrackingConfig {
    min_distance: 10.0,        // minimum movement (meters)
    min_time_interval: 30,     // minimum time between points (seconds)
    max_accuracy: 100.0,       // ignore points worse than 100m
    filter_stationary: true,   // filter out stationary points
    use_kalman_filter: true,   // smooth tracking data
};

let tracker = LocationTracker::new(config);
```

### Kalman Filtering

```rust
// Enable smoothing for noisy GPS data
let smoothed_location = tracker.add_measurement(raw_location)?;

// The tracker maintains internal state:
// - Position estimates
// - Velocity estimates  
// - Acceleration estimates
// - Uncertainty covariance matrices
```

## Integration Examples

### Basic Location Tracking

```rust
use olocus_core::*;
use olocus_location::*;

// Create location payload
let location_data = LocationPayload::new(
    Measurement::new(
        Value::Point2D {
            x: Coordinate::latitude_to_fixed(37.7749),
            y: Coordinate::longitude_to_fixed(-122.4194),
        },
        Uncertainty::Circular { radius: 10.0 },
        Provenance::new(Source::Sensor {
            device_id: "gps-tracker-001".to_string(),
            sensor_type: "GPS".to_string(),
        })
    ),
    LocationInfo {
        altitude: Some(150.0),
        accuracy: Some(10.0),
        heading: Some(90.0),  // heading east
        speed: Some(1.5),     // walking speed
        timestamp: SystemTime::now(),
    }
);

// Create block with location data
let mut block = Block::new(
    location_data,
    CryptoSuite::Ed25519,
    &previous_hash
)?;

// Sign and create chain
let chain = block.sign(&private_key)?;
```

### Real-Time Tracking

```rust
use std::time::Duration;
use tokio::time::interval;

async fn start_tracking() -> Result<()> {
    let mut tracker = LocationTracker::new(TrackingConfig::default());
    let mut interval = interval(Duration::from_secs(30));
    
    loop {
        interval.tick().await;
        
        // Get GPS reading
        if let Ok(gps_reading) = get_gps_location().await {
            // Process through tracker (Kalman filtering)
            let filtered_location = tracker.add_measurement(gps_reading)?;
            
            // Create block if significant movement
            if tracker.should_record(&filtered_location) {
                let block = create_location_block(filtered_location)?;
                store_block(block).await?;
            }
        }
    }
}
```

## Performance Considerations

### Memory Usage

- Fixed-point coordinates: 16 bytes per point (2 × i64)
- Measurement overhead: ~200 bytes per location
- Kalman filter state: ~500 bytes per tracker

### Processing Performance

- Coordinate conversion: &lt;1μs
- Haversine distance: ~10μs  
- Kalman filter update: ~50μs
- Block creation: &lt;1ms

### Optimization Tips

```rust
// Pre-compute fixed-point coordinates for static locations
const OFFICE_LAT: i64 = 377749000;  // Pre-computed
const OFFICE_LON: i64 = -1224194000;

// Batch distance calculations
let distances: Vec<f64> = locations
    .iter()
    .map(|loc| Coordinate::haversine_distance(
        reference_lat, reference_lon,
        loc.latitude, loc.longitude
    ))
    .collect();

// Use appropriate accuracy thresholds
let config = TrackingConfig {
    max_accuracy: 50.0,  // Ignore very inaccurate readings
    min_distance: 5.0,   // Reduce noise in stationary scenarios
    ..Default::default()
};
```

## Error Handling

```rust
use olocus_location::error::LocationError;

match location_result {
    Ok(location) => {
        // Process valid location
    },
    Err(LocationError::InvalidCoordinates(lat, lon)) => {
        // Handle out-of-bounds coordinates
    },
    Err(LocationError::InsufficientAccuracy(accuracy)) => {
        // Handle low-accuracy readings
    },
    Err(LocationError::StaleMeasurement(age)) => {
        // Handle old GPS data
    },
    Err(LocationError::KalmanFilterError(msg)) => {
        // Handle filter convergence issues
    }
}
```

## Testing & Validation

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_coordinate_precision() {
        let lat = 37.7749123456789;
        let fixed = Coordinate::latitude_to_fixed(lat);
        let restored = Coordinate::fixed_to_latitude(fixed);
        
        // Should preserve ~1cm precision
        assert!((lat - restored).abs() < 0.00000001);
    }
    
    #[test]
    fn test_haversine_accuracy() {
        // Known distance between SF and NYC: ~4,139 km
        let distance = Coordinate::haversine_distance(
            377749000, -1224194000,  // SF
            407128000, -740059000    // NYC
        );
        
        assert!((distance - 4_139_000.0).abs() < 1000.0); // Within 1km
    }
}
```

## Related Documentation

- [Visit Detection](./visit-detection.md) - Detecting stays and visits
- [Clustering](./clustering.md) - Location clustering algorithms  
- [Privacy & Obfuscation](./privacy-obfuscation.md) - Location privacy techniques
- [Universal Measurement Foundation](/concepts/measurements.md) - Core measurement types