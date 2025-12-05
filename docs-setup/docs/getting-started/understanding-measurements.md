---
id: understanding-measurements
title: Understanding Measurements
sidebar_position: 4
---

# Understanding Measurements

The Universal Measurement Foundation is what makes Olocus Protocol unique. Every piece of data can be represented with uncertainty, provenance, and validity.

## Why Measurements Matter

In the real world, data is never perfect:
- GPS coordinates have accuracy limitations
- Sensor readings have noise
- Predictions have confidence levels
- Data gets stale over time

The Olocus Protocol embraces this reality with its measurement system.

## Quick Example

Here's a GPS reading with all its real-world context:

```rust
use olocus_core::{Measurement, Value, Uncertainty, Provenance, Source};

let gps_reading = Measurement {
    // The actual location (San Francisco)
    value: Value::Point2D {
        lat: 377749000,  // 37.7749° × 10^7
        lon: -1224194000, // -122.4194° × 10^7
    },
    
    // How accurate? (10 meter radius)
    uncertainty: Uncertainty::Circular {
        angle: 0.0,
        radius: 10.0,
    },
    
    // Where did it come from?
    provenance: Provenance {
        source: Source::Sensor {
            device_id: [0; 32],
            sensor_type: 0x0001, // GPS
            calibration_id: None,
        },
        transformations: vec![],
        attestations: vec![],
    },
    
    // How long is it valid?
    validity: ValidityWindow::new(
        now,
        Some(now + 300) // Valid for 5 minutes
    ),
};
```

## Core Components

### 1. Value - The What

The actual data, supporting ~40 types:

```rust
// Primitives
Value::Float(22.5)              // Temperature
Value::Int(42)                   // Count
Value::String("Hello".to_string()) // Text

// Spatial (fixed-point for precision)
Value::Point2D { lat, lon }     // Location
Value::Point3D { lat, lon, alt } // With altitude

// Temporal
Value::Timestamp(1234567890)    // Unix time
Value::Duration(3600)            // 1 hour

// Collections
Value::Array(vec![...])         // Lists
Value::Object(map)               // Key-value pairs
```

### 2. Uncertainty - The How Sure

Quantify confidence in the measurement:

```rust
// GPS accuracy (circular error)
Uncertainty::Circular {
    angle: 0.0,
    radius: 10.0  // 10 meters
}

// Temperature sensor (normal distribution)
Uncertainty::Gaussian {
    std_dev: 0.1  // ±0.1°C
}

// Prediction confidence
Uncertainty::Confidence {
    level: 0.95  // 95% confident
}

// When you don't know
Uncertainty::Unknown
```

### 3. Provenance - The Where From

Track the data's journey:

```rust
Provenance {
    // Original source
    source: Source::Sensor {
        device_id: device_id,
        sensor_type: 0x0001,
        calibration_id: Some(cal_id),
    },
    
    // What happened to it
    transformations: vec![
        Transformation {
            operation: TransformationOp::Filter {
                algorithm: 0x0001, // Kalman
                parameters: vec![],
            },
            timestamp: timestamp,
            actor: processor_id,
            input_hash: original_hash,
        }
    ],
    
    // Who verified it
    attestations: vec![
        Attestation {
            attestor: witness_id,
            claim: AttestationClaim::Witnessed,
            signature: signature,
            timestamp: witness_time,
        }
    ],
}
```

### 4. Validity - The When

Define temporal validity:

```rust
// Valid forever (e.g., historical fact)
ValidityWindow::perpetual()

// Valid for a period
ValidityWindow::new(
    start_time,
    Some(end_time)
)

// Decaying value (e.g., prediction)
ValidityWindow {
    start: now,
    end: Some(now + 86400),
    decay: Some(DecayFunction::Exponential {
        half_life: 3600  // Loses half value per hour
    })
}
```

## Practical Examples

### Weather Sensor

```rust
let temperature = Measurement {
    value: Value::Float(22.5),
    uncertainty: Uncertainty::Gaussian { std_dev: 0.1 },
    provenance: Provenance {
        source: Source::Sensor {
            device_id: sensor_id,
            sensor_type: 0x0002,
            calibration_id: Some(cal_id),
        },
        transformations: vec![],
        attestations: vec![],
    },
    validity: ValidityWindow::new(now, Some(now + 3600)),
};
```

### ML Prediction

```rust
let prediction = Measurement {
    value: Value::Float(0.87), // 87% probability
    uncertainty: Uncertainty::Confidence { level: 0.95 },
    provenance: Provenance {
        source: Source::Derived {
            algorithm_id: 0x2000,
            input_hashes: vec![data_hash],
        },
        transformations: vec![],
        attestations: vec![validator_attestation],
    },
    validity: ValidityWindow::new(now, Some(now + 600)),
};
```

### User-Reported Data

```rust
let user_report = Measurement {
    value: Value::String("Road closed".to_string()),
    uncertainty: Uncertainty::Unknown,
    provenance: Provenance {
        source: Source::SelfReported {
            reporter_id: user_id,
            method: 0x0001, // Manual entry
        },
        transformations: vec![],
        attestations: vec![], // Could add witness attestations
    },
    validity: ValidityWindow::new(now, Some(now + 7200)),
};
```

## Fixed-Point Coordinates

For cross-platform consistency, spatial coordinates use fixed-point arithmetic:

```rust
// Degrees to fixed-point (× 10^7)
let lat_fixed = Coordinate::latitude_to_fixed(37.7749);
// Result: 377749000

// Back to degrees
let lat_degrees = Coordinate::fixed_to_latitude(377749000);
// Result: 37.7749

// Calculate distance
let distance = Coordinate::haversine_distance(
    lat1, lon1,
    lat2, lon2
); // Returns meters
```

## Best Practices

### 1. Always Include Uncertainty
Even if unknown, explicitly state it:
```rust
uncertainty: Uncertainty::Unknown
```

### 2. Track Provenance
Know where your data comes from:
```rust
source: Source::Sensor { ... }
```

### 3. Set Appropriate Validity
Data gets stale:
```rust
validity: ValidityWindow::new(now, Some(now + 300))
```

### 4. Use Fixed-Point for Geography
Ensures consistency across platforms:
```rust
lat: Coordinate::latitude_to_fixed(degrees)
```

### 5. Add Attestations When Available
Third-party verification adds trust:
```rust
attestations: vec![witness_attestation]
```

## Common Patterns

### Sensor Fusion
Combine multiple measurements:
```rust
let fused = Measurement {
    value: weighted_average(&measurements),
    uncertainty: combined_uncertainty(&measurements),
    provenance: Provenance {
        source: Source::Derived {
            algorithm_id: 0x3000, // Sensor fusion
            input_hashes: measurement_hashes,
        },
        ...
    },
    ...
};
```

### Privacy Obfuscation
Add controlled noise:
```rust
let obfuscated = Measurement {
    value: add_noise(original_value, epsilon),
    uncertainty: Uncertainty::Interval {
        lower: value - radius,
        upper: value + radius,
        confidence: 0.95,
    },
    provenance: Provenance {
        transformations: vec![
            Transformation {
                operation: TransformationOp::Obfuscate {
                    method: 0x0001, // Differential privacy
                    level: 2,
                },
                ...
            }
        ],
        ...
    },
    ...
};
```

## Next Steps

Now that you understand measurements:
- [Choose your extensions](./choosing-extensions)
- [Explore the Measurement API](../api/measurement-api)
- [Learn about privacy techniques](../extensions/privacy/techniques)
- [Build a location tracker](../tutorials/location-tracker)