---
id: measurements
title: Universal Measurement Foundation
sidebar_position: 4
---

# Universal Measurement Foundation

The Olocus Protocol includes a comprehensive system for representing any measured data with uncertainty, provenance, and validity.

## Core Concept

Every piece of data in the real world has:
- **Value**: The actual measurement
- **Uncertainty**: How accurate is it?
- **Provenance**: Where did it come from?
- **Validity**: When is it valid?

## The Measurement Type

```rust
pub struct Measurement {
    pub value: Value,
    pub uncertainty: Uncertainty,
    pub provenance: Provenance,
    pub validity: ValidityWindow,
}
```

## Value Types

The `Value` enum supports ~40 different types:

### Primitives
```rust
Value::Bool(true)
Value::Int(42)
Value::Float(3.14159)
Value::String("Hello".to_string())
```

### Temporal
```rust
Value::Timestamp(1701234567)  // Unix seconds
Value::Duration(3600)          // Nanoseconds
Value::Date { year: 2024, month: 12, day: 25 }
```

### Spatial (Fixed-Point)
```rust
// San Francisco coordinates (degrees × 10^7)
Value::Point2D { 
    lat: 377749000,  // 37.7749°
    lon: -1224194000 // -122.4194°
}

// With altitude (millimeters)
Value::Point3D {
    lat: 377749000,
    lon: -1224194000,
    alt: 52000  // 52 meters
}
```

### Collections
```rust
Value::Array(vec![Value::Int(1), Value::Int(2), Value::Int(3)])
Value::Object(BTreeMap::from([
    ("name".to_string(), Value::String("Alice".to_string())),
    ("age".to_string(), Value::Int(30))
]))
```

## Uncertainty Types

Quantify how certain you are about a measurement:

### Gaussian (Normal Distribution)
```rust
Uncertainty::Gaussian { std_dev: 2.0 }
```

### Interval
```rust
Uncertainty::Interval {
    lower: 10.0,
    upper: 20.0,
    confidence: 0.95  // 95% confidence interval
}
```

### Circular (Directional)
```rust
Uncertainty::Circular {
    angle: 45.0,   // degrees
    radius: 5.0    // uncertainty radius
}
```

### Exact or Unknown
```rust
Uncertainty::Exact        // No uncertainty
Uncertainty::Unknown      // Uncertainty not quantified
```

## Provenance Tracking

Track where data comes from and how it's been transformed:

### Source Types
```rust
Source::Sensor {
    device_id: [0u8; 32],
    sensor_type: 0x0001,  // GPS
    calibration_id: Some([1u8; 32])
}

Source::Derived {
    algorithm_id: 0x1000,
    input_hashes: vec![previous_hash]
}

Source::SelfReported {
    reporter_id: [0u8; 32],
    method: 0x0001  // Manual entry
}
```

### Transformations
```rust
Transformation {
    operation: TransformationOp::Filter {
        algorithm: 0x0001,  // Kalman filter
        parameters: vec![]
    },
    timestamp: current_timestamp(),
    actor: actor_id,
    input_hash: input_data_hash
}
```

### Attestations
```rust
Attestation {
    attestor: attestor_id,
    claim: AttestationClaim::Witnessed,
    signature: signature_bytes,
    timestamp: current_timestamp()
}
```

## Validity Windows

Define when measurements are valid:

```rust
// Valid forever
ValidityWindow::perpetual()

// Valid for 1 hour
ValidityWindow::new(
    start_timestamp as i64,
    Some((start_timestamp + 3600) as i64)
)

// With decay function
ValidityWindow {
    start: now,
    end: Some(now + 86400),
    decay: Some(DecayFunction::Exponential {
        half_life: 3600  // Value decays by half every hour
    })
}
```

## Practical Examples

### GPS Location
```rust
let gps_measurement = Measurement {
    value: Value::Point2D {
        lat: Coordinate::latitude_to_fixed(37.7749),
        lon: Coordinate::longitude_to_fixed(-122.4194),
    },
    uncertainty: Uncertainty::Circular {
        angle: 0.0,
        radius: 10.0,  // 10 meter accuracy
    },
    provenance: Provenance {
        source: Source::Sensor {
            device_id: device_id,
            sensor_type: 0x0001,  // GPS
            calibration_id: None,
        },
        transformations: vec![],
        attestations: vec![],
    },
    validity: ValidityWindow::new(
        current_timestamp() as i64,
        Some((current_timestamp() + 300) as i64)  // Valid for 5 minutes
    ),
};
```

### Temperature Reading
```rust
let temperature = Measurement {
    value: Value::Float(22.5),  // 22.5°C
    uncertainty: Uncertainty::Gaussian {
        std_dev: 0.1  // ±0.1°C standard deviation
    },
    provenance: Provenance {
        source: Source::Sensor {
            device_id: sensor_id,
            sensor_type: 0x0002,  // Temperature sensor
            calibration_id: Some(calibration_id),
        },
        transformations: vec![
            Transformation {
                operation: TransformationOp::UnitConversion {
                    from_unit: 0x0001,  // Fahrenheit
                    to_unit: 0x0002,    // Celsius
                },
                timestamp: current_timestamp(),
                actor: converter_id,
                input_hash: raw_reading_hash,
            }
        ],
        attestations: vec![],
    },
    validity: ValidityWindow::perpetual(),
};
```

### Machine Learning Prediction
```rust
let ml_prediction = Measurement {
    value: Value::Float(0.87),  // 87% probability
    uncertainty: Uncertainty::Confidence {
        level: 0.95  // Model confidence
    },
    provenance: Provenance {
        source: Source::Derived {
            algorithm_id: 0x2000,  // Neural network
            input_hashes: vec![input_data_hash],
        },
        transformations: vec![],
        attestations: vec![
            Attestation {
                attestor: model_validator_id,
                claim: AttestationClaim::Verified {
                    reference_id: validation_hash,
                },
                signature: validator_signature,
                timestamp: validation_timestamp,
            }
        ],
    },
    validity: ValidityWindow::new(
        current_timestamp() as i64,
        Some((current_timestamp() + 3600) as i64)  // Valid for 1 hour
    ),
};
```

## Coordinate Utilities

Helper functions for working with geographic coordinates:

```rust
// Convert degrees to fixed-point
let lat_fixed = Coordinate::latitude_to_fixed(37.7749);
let lon_fixed = Coordinate::longitude_to_fixed(-122.4194);

// Convert back to degrees
let lat_degrees = Coordinate::fixed_to_latitude(lat_fixed);
let lon_degrees = Coordinate::fixed_to_longitude(lon_fixed);

// Calculate distance (meters)
let distance = Coordinate::haversine_distance(
    lat1_fixed, lon1_fixed,
    lat2_fixed, lon2_fixed
);

// Calculate bearing (degrees)
let bearing = Coordinate::bearing(
    lat1_fixed, lon1_fixed,
    lat2_fixed, lon2_fixed
);
```

## Best Practices

1. **Always include uncertainty** - Even if it's `Uncertainty::Unknown`
2. **Track provenance** - Know where your data comes from
3. **Set appropriate validity** - Data gets stale
4. **Use fixed-point for coordinates** - Ensures cross-platform consistency
5. **Include attestations** - When third-party verification is available

## Next Steps

- [Browse Extensions](../extensions/overview) - Available extensions
- [Creating Extensions](../extensions/creating-extensions) - Build custom extensions  
- [API Reference](../api/core) - Core API documentation