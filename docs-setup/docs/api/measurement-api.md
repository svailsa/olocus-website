---
id: measurement-api
title: Measurement API
sidebar_position: 1
---

# Measurement API

The Universal Measurement Foundation provides the core primitives for representing any measured data in the Olocus Protocol. It follows a three-layer architecture: Core defines structural types, Schema defines validity constraints, and Domain defines semantic meaning.

## Core Types

### Value Enum

The `Value` enum represents the structural types supported by the protocol. It contains ~25 variants covering all fundamental data types:

```rust
use olocus_core::measure::Value;

// Primitives
let none_val = Value::None;
let bool_val = Value::Bool(true);
let int_val = Value::Int(42);
let uint_val = Value::UInt(100);
let float_val = Value::Float(3.14159);

// Decimal for exact precision
let price = Value::Decimal {
    value: 1999,    // $19.99 stored as 1999 cents
    scale: 2,       // 2 decimal places
};
```

### Temporal Types

```rust
// Timestamps
let unix_timestamp = Value::Timestamp(1609459200); // 2021-01-01 00:00:00 UTC
let precise_time = Value::TimestampNanos {
    seconds: 1609459200,
    nanos: 123456789,
};

// Duration
let duration = Value::Duration(3600_000_000_000); // 1 hour in nanoseconds

// Structured time
let date = Value::Date {
    year: 2023,
    month: 12,
    day: 25,
};

let time = Value::Time {
    hour: 14,
    minute: 30,
    second: 0,
    nanos: 0,
};

let datetime = Value::DateTime {
    year: 2023,
    month: 12,
    day: 25,
    hour: 14,
    minute: 30,
    second: 0,
    nanos: 0,
    tz_offset_minutes: -480, // PST (-8 hours)
};
```

### Text and Binary

```rust
// Text
let text = Value::String("Hello, Olocus!".to_string());

// Binary data
let data = Value::Bytes(vec![0x01, 0x02, 0x03, 0x04]);
let hash = Value::Hash256([0u8; 32]); // SHA-256 hash
let hash512 = Value::Hash512([0u8; 64]); // SHA-512 hash

// UUID
let uuid = Value::UUID([0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0, 
                       0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0]);

// JSON documents
let json_doc = Value::Json(br#"{"temperature": 23.5, "unit": "celsius"}"#.to_vec());
```

### Collections

```rust
use std::collections::{BTreeMap, BTreeSet};

// Arrays (ordered)
let readings: Value = vec![1_i64, 2, 3, 4, 5].into();

// Objects (key-value maps)
let mut sensor_data = BTreeMap::new();
sensor_data.insert("temperature".to_string(), Value::Float(23.5));
sensor_data.insert("humidity".to_string(), Value::Float(65.0));
sensor_data.insert("unit".to_string(), Value::String("celsius".to_string()));
let obj = Value::Object(sensor_data);

// Sets (unique values)
let mut tags = BTreeSet::new();
tags.insert(Value::String("temperature".to_string()));
tags.insert(Value::String("outdoor".to_string()));
let set = Value::Set(tags);
```

### Spatial Types

All spatial coordinates use fixed-point representation (degrees × 10^7) for ~1cm precision and cross-platform determinism:

```rust
use olocus_core::measure::{Value, Coordinate};

// 2D Points
let san_francisco = Value::point2d(37.7749, -122.4194);
// Stored as: Point2D { lat: 377749000, lon: -1224194000 }

// 3D Points with altitude
let mount_everest = Value::point3d(27.9881, 86.9250, 8848.86);

// Bounding boxes
let bbox = Value::BoundingBox {
    min_lat: Coordinate::latitude_to_fixed(37.7),
    min_lon: Coordinate::longitude_to_fixed(-122.5),
    max_lat: Coordinate::latitude_to_fixed(37.8),
    max_lon: Coordinate::longitude_to_fixed(-122.4),
};

// GeoJSON-style geometries
let path = Value::linestring(&[
    (37.7749, -122.4194),  // Start
    (37.7849, -122.4094),  // End
]);

let polygon = Value::polygon(
    &[(0.0, 0.0), (0.0, 1.0), (1.0, 1.0), (1.0, 0.0), (0.0, 0.0)], // Exterior
    &[], // No holes
);

let multipoint = Value::multipoint(&[
    (37.7749, -122.4194),
    (37.7849, -122.4094),
]);
```

### References and Patterns

```rust
// Block references
let block_ref = Value::BlockRef([0u8; 32]); // Hash of another block

// Schema references
let schema_ref = Value::SchemaRef {
    namespace: "health".to_string(),
    name: "heart_rate".to_string(),
    version: "1.2.0".to_string(),
};

// Database records
let user_record = Value::record("users", "user_12345");

// Ranges
let age_range = Value::range(Value::Int(18), Value::Int(65));
let inclusive_range = Value::range_inclusive(Value::Int(1), Value::Int(100));

// Regular expressions
let phone_pattern = Value::regex(r"^\d{3}-\d{3}-\d{4}$");
```

## Value Type Checking and Conversion

```rust
let value = Value::Int(42);

// Type checking
assert!(value.is_numeric());
assert!(!value.is_temporal());
assert!(!value.is_spatial());
assert_eq!(value.type_name(), "Int");

// Safe conversion
if let Some(i) = value.as_int() {
    println!("Integer value: {}", i);
}

// Pattern matching
match value {
    Value::Int(i) => println!("Got integer: {}", i),
    Value::Float(f) => println!("Got float: {}", f),
    Value::String(s) => println!("Got string: {}", s),
    _ => println!("Other type: {}", value.type_name()),
}
```

## Measurement Structure

A `Measurement` combines a value with uncertainty, provenance, and validity context:

```rust
use olocus_core::measure::{Measurement, Uncertainty, Provenance, Source, ValidityWindow};

// Basic measurement
let heart_rate = Measurement::new(Value::Int(72))
    .with_uncertainty(Uncertainty::gaussian(2.0))
    .with_source(Source::Sensor {
        device_id: [0u8; 32],
        sensor_type: 0x0001, // Heart rate monitor
        calibration_id: None,
    })
    .with_validity(ValidityWindow::seconds(60)); // Valid for 1 minute

// Check if measurement is currently valid
if heart_rate.is_valid_now() {
    println!("Measurement is still valid");
}

// Get validity factor (0.0 to 1.0)
let validity = heart_rate.validity_factor_now();
println!("Validity: {:.2}", validity);
```

## Uncertainty Models

Different domains represent uncertainty differently:

```rust
// Gaussian/normal distribution (physics, engineering)
let temp_uncertainty = Uncertainty::gaussian(0.5); // ±0.5°C std dev

// Confidence intervals (statistics)
let gps_uncertainty = Uncertainty::interval(10.0, 0.95); // ±10m with 95% confidence

// Circular uncertainty (angles, bearings)
let compass_uncertainty = Uncertainty::Circular { kappa: 5.0 }; // von Mises distribution

// Discrete categories (classification)
let weather_uncertainty = Uncertainty::Categorical {
    probabilities: vec![
        (0, 0.7), // 70% chance sunny
        (1, 0.2), // 20% chance cloudy  
        (2, 0.1), // 10% chance rainy
    ],
};

// Simple confidence score
let ai_uncertainty = Uncertainty::confidence(0.85); // 85% confident

// Exact value (theoretical)
let math_constant = Uncertainty::Exact;

// Unknown uncertainty (discouraged)
let unknown = Uncertainty::Unknown;
```

### Uncertainty Operations

```rust
// Convert any uncertainty to confidence level
let confidence = uncertainty.to_confidence(); // 0.0 to 1.0

// Check if uncertainty is quantified
if uncertainty.is_quantified() {
    println!("Uncertainty is properly quantified");
}
```

## Provenance Tracking

Provenance tracks where measurements came from and how they were processed:

```rust
// Sensor source
let sensor_prov = Provenance::sensor([1u8; 32], 0x0001);

// Self-reported source
let self_reported = Provenance::self_reported([2u8; 32]);

// Derived from other measurements
let derived = Provenance::derived(
    0x1001, // Algorithm ID
    vec![[3u8; 32], [4u8; 32]], // Input measurement hashes
);

// Add transformations
use olocus_core::measure::{Transformation, TransformationOp};

let filtered = sensor_prov.with_transformation(Transformation {
    operation: TransformationOp::Filter {
        algorithm: 0x2001,
        parameters: vec![],
    },
    timestamp: 1609459200,
    actor: [5u8; 32],
    input_hash: [6u8; 32],
});

println!("Transformations applied: {}", filtered.transformation_count());
```

### Source Types

```rust
// Hardware sensor
Source::Sensor {
    device_id: [0u8; 32],
    sensor_type: 0x0001,
    calibration_id: Some([1u8; 32]),
}

// Computed from other data
Source::Derived {
    algorithm_id: 0x1001,
    inputs: vec![[2u8; 32], [3u8; 32]],
    parameters: Some(vec![0x01, 0x02]),
}

// Human input
Source::SelfReported {
    reporter_id: [4u8; 32],
    method: 0x0001, // Web form, voice, etc.
}

// External oracle
Source::Oracle {
    oracle_id: [5u8; 32],
    query_id: Some([6u8; 32]),
}

// Consensus of multiple sources
Source::Consensus {
    sources: vec![[7u8; 32], [8u8; 32], [9u8; 32]],
    method: 0x0001, // Majority vote, weighted average, etc.
    agreement: 0.85, // 85% agreement
}

// Unknown (discouraged - heavily penalized in trust calculations)
Source::Unknown
```

## Validity Windows

Control when measurements are considered valid:

```rust
use std::time::{SystemTime, UNIX_EPOCH};

let now = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap()
    .as_secs();

// Valid for specific duration
let short_term = ValidityWindow::new(now, Some(300)); // 5 minutes

// Valid for N seconds from now
let real_time = ValidityWindow::seconds(60); // 1 minute

// Indefinitely valid (use with caution)
let permanent = ValidityWindow::indefinite();

// With exponential decay
let decaying = ValidityWindow::decaying(3600, 1800); // 1 hour validity, 30 min half-life

// Check validity
assert!(short_term.is_valid_at(now + 100)); // Valid
assert!(!short_term.is_valid_at(now + 400)); // Expired

// Get validity factor with decay
let factor = decaying.validity_at(now + 1800); // Should be ~0.5 (one half-life)
```

### Validity Decay

```rust
use olocus_core::measure::ValidityDecay;

// Step function (binary: valid/invalid)
ValidityDecay::StepFunction

// Linear decay from 1.0 to 0.0
ValidityDecay::Linear

// Exponential decay with half-life
ValidityDecay::Exponential { half_life: 1800 } // 30 minutes

// Custom decay curve (domain-specific)
ValidityDecay::Custom {
    curve_id: 0x1001,
    parameters: vec![],
}
```

## Coordinate Utilities

Fixed-point coordinate system for deterministic spatial calculations:

```rust
use olocus_core::measure::Coordinate;

// Constants
assert_eq!(Coordinate::SCALE, 10_000_000.0); // 10^7 scale factor
assert_eq!(Coordinate::MAX_LAT, 900_000_000); // 90° × 10^7
assert_eq!(Coordinate::EARTH_RADIUS_M, 6_371_000.0);

// Conversions
let lat_fixed = Coordinate::latitude_to_fixed(37.7749290);  // 377749290
let lat_degrees = Coordinate::fixed_to_latitude(377749290); // 37.7749290

// Validation
Coordinate::validate(377749290, -1224193580).unwrap(); // San Francisco

// Distance calculation (Haversine formula)
let distance = Coordinate::haversine_distance(
    377749290, -1224193580, // San Francisco
    407589500, -739444400,  // New York
); // Returns distance in meters

// Bearing calculation (0-360 degrees, 0=north)
let bearing = Coordinate::bearing(
    377749290, -1224193580, // From SF
    407589500, -739444400,  // To NYC
); // Returns ~78.5 degrees (northeast)

// Destination point calculation
let (dest_lat, dest_lon) = Coordinate::destination_point(
    377749290, -1224193580, // Start: San Francisco
    90.0,      // Bearing: due east
    1000.0,    // Distance: 1km
);

// Coordinate offsets
let lat_offset = Coordinate::meters_to_lat_offset(1000.0); // 1km north
let lon_offset = Coordinate::meters_to_lon_offset(1000.0, 377749290); // 1km east at SF latitude
```

## Complete Example

```rust
use olocus_core::measure::*;
use std::collections::BTreeMap;

fn main() -> Result<(), MeasurementError> {
    // Create a comprehensive measurement
    let mut sensor_data = BTreeMap::new();
    sensor_data.insert("temperature".to_string(), Value::Float(23.5));
    sensor_data.insert("humidity".to_string(), Value::Float(65.0));
    sensor_data.insert("location".to_string(), Value::point2d(37.7749, -122.4194));
    
    let measurement = Measurement::new(Value::Object(sensor_data))
        .with_uncertainty(Uncertainty::Interval {
            lower_bound: -0.5,
            upper_bound: 0.5,
            confidence: 0.95,
        })
        .with_provenance(
            Provenance::sensor([1u8; 32], 0x0001)
                .with_transformation(Transformation {
                    operation: TransformationOp::Filter {
                        algorithm: 0x2001,
                        parameters: vec![0x01, 0x02],
                    },
                    timestamp: 1609459200,
                    actor: [2u8; 32],
                    input_hash: [3u8; 32],
                })
                .with_attestation(Attestation {
                    attestor: [4u8; 32],
                    claim: AttestationClaim::Witnessed,
                    signature: [0u8; 64],
                    timestamp: 1609459200,
                })
        )
        .with_validity(ValidityWindow::decaying(3600, 1800));

    // Validate measurement
    if measurement.is_valid_now() {
        println!("Measurement is valid");
        println!("Confidence: {:.2}", measurement.uncertainty.to_confidence());
        println!("Sources: {}", measurement.provenance.attestation_count());
        println!("Validity: {:.2}", measurement.validity_factor_now());
    }

    // Serialize for storage/transmission
    let json = serde_json::to_string(&measurement).unwrap();
    println!("Serialized measurement: {}", json);

    // Deserialize
    let deserialized: Measurement = serde_json::from_str(&json).unwrap();
    assert_eq!(measurement, deserialized);

    Ok(())
}
```

## Value Constructors

Convenience methods for creating common values:

```rust
// From Rust primitives
let v1: Value = 42_i64.into();
let v2: Value = "hello".into();
let v3: Value = true.into();
let v4: Value = vec![1_i64, 2, 3].into();

// Spatial constructors
let point = Value::point2d(37.7749, -122.4194);
let point3d = Value::point3d(37.7749, -122.4194, 100.0);
let line = Value::linestring(&[(0.0, 0.0), (1.0, 1.0)]);

// Utility constructors
let uuid = Value::uuid_from_u128(0x123456789ABCDEF0123456789ABCDEF0);
let range = Value::range(Value::Int(1), Value::Int(100));
let record = Value::record("users", "user_123");
```

## Error Handling

```rust
use olocus_core::measure::MeasurementError;

// Value validation
match Coordinate::validate(lat_fixed, lon_fixed) {
    Ok(()) => println!("Coordinates valid"),
    Err(MeasurementError::ValueOutOfRange { min, max, actual }) => {
        println!("Coordinate out of range: {} not in {}..{}", actual, min, max);
    }
    Err(e) => println!("Other error: {}", e),
}

// Uncertainty validation
let uncertainty = Uncertainty::confidence(1.5); // Invalid: > 1.0
// This would create ConfidenceOutOfRange error

// Provenance validation
let circular = Provenance::derived(0x1001, vec![[1u8; 32]]);
// If input hash references a measurement derived from this one,
// would create CircularProvenance error
```

## Performance Considerations

- **Fixed-Point Arithmetic**: Spatial calculations use integer math for speed and determinism
- **Efficient Serialization**: Values serialize to compact binary or JSON format
- **Memory Layout**: Enums are optimized for minimal memory usage
- **Collection Types**: BTreeMap/BTreeSet ensure deterministic iteration order

## See Also

- [Core API Overview](./core)
- [Block Operations API](./block-operations)
- [Wire Format API](./wire-format-api)
- [Error Handling](./error-handling)
