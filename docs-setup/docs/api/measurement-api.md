---
id: measurement-api
title: Measurement API
sidebar_position: 1
---

# Measurement API

The Universal Measurement Foundation provides the core primitives for representing any measured data in the Olocus Protocol. It follows a three-layer architecture: Core defines structural types, Schema defines validity constraints, and Domain defines semantic meaning.

## Core Types

### Value Enum

The `Value` enum represents the structural types supported by the protocol. It contains 36 variants covering all fundamental data types across multiple categories:

```rust
use olocus_core::measure::Value;

// === Absence ===
let none_val = Value::None;

// === Primitives ===
let bool_val = Value::Bool(true);
let int_val = Value::Int(42);              // Signed 64-bit integer
let uint_val = Value::UInt(100);           // Unsigned 64-bit integer  
let float_val = Value::Float(3.14159);     // 64-bit floating point

// Decimal for exact precision (value × 10^-scale)
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
// === Text ===
let text = Value::String("Hello, Olocus!".to_string());

// === Binary ===
let data = Value::Bytes(vec![0x01, 0x02, 0x03, 0x04]);
let hash256 = Value::Hash256([0u8; 32]); // SHA-256 hash (common case)
let hash512 = Value::Hash512([0u8; 64]); // SHA-512 hash

// === Structured ===
// Raw JSON document for maximum flexibility
let json_doc = Value::Json(br#"{"temperature": 23.5, "unit": "celsius"}"#.to_vec());
```

### Identifiers

```rust
// === UUID (Universally Unique Identifier) ===
let uuid_bytes = Value::UUID([0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0, 
                              0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0]);

// Helper constructors
let uuid_from_int = Value::uuid_from_u128(0x123456789ABCDEF0123456789ABCDEF0);
let uuid_from_array = Value::uuid([1u8; 16]);
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

// Multi-geometry collections
let multilinestring = Value::multilinestring(vec![
    vec![(377749000, -1224194000), (377849000, -1224094000)], // Line 1 (fixed-point)
    vec![(378000000, -1224000000), (378100000, -1223900000)], // Line 2 (fixed-point)
]);

let multipolygon = Value::multipolygon(vec![
    // Polygon 1: exterior ring, interior holes
    (vec![(0, 0), (1000000, 0), (1000000, 1000000), (0, 1000000), (0, 0)], vec![]),
    // Polygon 2: with a hole
    (vec![(2000000, 0), (3000000, 0), (3000000, 1000000), (2000000, 1000000), (2000000, 0)], 
     vec![vec![(2200000, 200000), (2800000, 200000), (2800000, 800000), (2200000, 800000), (2200000, 200000)]]),
]);

let geometry_collection = Value::geometry_collection(vec![
    Value::point2d(37.7749, -122.4194),
    Value::linestring(&[(37.7749, -122.4194), (37.7751, -122.4180)]),
    Value::polygon(&[(0.0, 0.0), (0.0, 1.0), (1.0, 1.0), (1.0, 0.0), (0.0, 0.0)], &[]),
]);
```

### Ranges and Patterns

```rust
// === Ranges ===
// Range with start and end bounds (default: start inclusive, end exclusive)
let age_range = Value::range(Value::Int(18), Value::Int(65)); // [18, 65)
let price_range = Value::range_inclusive(Value::Float(10.0), Value::Float(100.0)); // [10.0, 100.0]

// Complex ranges with mixed types
let time_range = Value::range(
    Value::Timestamp(1609459200), // 2021-01-01 00:00:00 UTC
    Value::Timestamp(1640995200), // 2022-01-01 00:00:00 UTC
);

// === Patterns ===
// Regular expressions for pattern matching
let phone_pattern = Value::regex(r"^\d{3}-\d{3}-\d{4}$");
let email_pattern = Value::regex(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$");
let postal_code = Value::regex(r"^\d{5}(-\d{4})?$");
```

### References and Database Records

```rust
// === Block References ===
let block_ref = Value::BlockRef([0u8; 32]); // Hash of another block

// Schema references
let schema_ref = Value::SchemaRef {
    namespace: "health".to_string(),
    name: "heart_rate".to_string(),
    version: "1.2.0".to_string(),
};

// === Database Records (SurrealDB-style) ===
let user_record = Value::record("users", "user_12345");
let sensor_record = Value::record("sensors", "temp_sensor_001");
let measurement_record = Value::record("measurements", "measurement_abc123");
```

### Extension Points

```rust
// === Custom Extension Types ===
// Domain-specific types not covered by core Value variants
let custom_extension = Value::Extension {
    type_id: 0x8001,              // Custom type identifier (0x8000-0xFFFF)
    data: vec![0x01, 0x02, 0x03], // Serialized custom data
};

// Extensions can register custom serialization for their type_ids
let biometric_data = Value::Extension {
    type_id: 0x9001,              // Biometric data type
    data: custom_biometric_serializer.encode(&fingerprint_data),
};
```

## Value Type Checking and Conversion

```rust
let value = Value::Int(42);

// Type checking (built-in predicates)
assert!(value.is_numeric());
assert!(!value.is_temporal());
assert!(!value.is_spatial());
assert!(!value.is_geometry());
assert!(!value.is_collection());
assert_eq!(value.type_name(), "Int");

// Safe conversion (extract methods)
if let Some(i) = value.as_int() {
    println!("Integer value: {}", i);
}

// New extraction methods for additional types
let uuid_val = Value::uuid([1u8; 16]);
if let Some(uuid_bytes) = uuid_val.as_uuid() {
    println!("UUID: {:?}", uuid_bytes);
}

let regex_val = Value::regex(r"^\d+$");
if let Some(pattern) = regex_val.as_regex() {
    println!("Regex pattern: {}", pattern);
}

let record_val = Value::record("users", "123");
if let Some((table, id)) = record_val.as_record() {
    println!("Record: {}:{}", table, id);
}

let range_val = Value::range(Value::Int(1), Value::Int(10));
if let Some((start, end, start_inc, end_inc)) = range_val.as_range() {
    println!("Range: {}{}{}{}", 
             if start_inc { "[" } else { "(" },
             start.as_int().unwrap(),
             end.as_int().unwrap(),
             if end_inc { "]" } else { ")" });
}

let line_val = Value::linestring(&[(37.7749, -122.4194), (37.7751, -122.4180)]);
if let Some(points) = line_val.as_linestring() {
    println!("LineString with {} points", points.len());
}

let poly_val = Value::polygon(&[(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0), (0.0, 0.0)], &[]);
if let Some((exterior, holes)) = poly_val.as_polygon() {
    println!("Polygon: {} exterior points, {} holes", exterior.len(), holes.len());
}

let multipoint_val = Value::multipoint(&[(37.7749, -122.4194), (37.7751, -122.4180)]);
if let Some(points) = multipoint_val.as_multipoint() {
    println!("MultiPoint with {} points", points.len());
}

// Pattern matching (comprehensive example)
match value {
    Value::None => println!("No value"),
    Value::Bool(b) => println!("Boolean: {}", b),
    Value::Int(i) => println!("Integer: {}", i),
    Value::UInt(u) => println!("Unsigned integer: {}", u),
    Value::Float(f) => println!("Float: {}", f),
    Value::Decimal { value, scale } => println!("Decimal: {} × 10^-{}", value, scale),
    Value::String(s) => println!("String: {}", s),
    Value::Bytes(b) => println!("Bytes: {} bytes", b.len()),
    Value::Hash256(h) => println!("Hash256: {:?}", &h[0..4]),
    Value::Hash512(h) => println!("Hash512: {:?}", &h[0..4]),
    Value::UUID(u) => println!("UUID: {:?}", u),
    Value::Timestamp(t) => println!("Timestamp: {}", t),
    Value::TimestampNanos { seconds, nanos } => println!("Timestamp: {}.{:09}", seconds, nanos),
    Value::Duration(d) => println!("Duration: {} ns", d),
    Value::Date { year, month, day } => println!("Date: {}-{:02}-{:02}", year, month, day),
    Value::Time { hour, minute, second, nanos } => println!("Time: {:02}:{:02}:{:02}.{:09}", hour, minute, second, nanos),
    Value::DateTime { year, month, day, hour, minute, second, nanos, tz_offset_minutes } => {
        println!("DateTime: {}-{:02}-{:02}T{:02}:{:02}:{:02}.{:09}+{:02}:{:02}", 
                 year, month, day, hour, minute, second, nanos, 
                 tz_offset_minutes / 60, tz_offset_minutes % 60);
    },
    Value::Array(a) => println!("Array: {} elements", a.len()),
    Value::Object(o) => println!("Object: {} fields", o.len()),
    Value::Set(s) => println!("Set: {} unique values", s.len()),
    Value::Point2D { lat, lon } => println!("Point2D: ({}, {})", lat, lon),
    Value::Point3D { lat, lon, alt } => println!("Point3D: ({}, {}, {})", lat, lon, alt),
    Value::BoundingBox { min_lat, min_lon, max_lat, max_lon } => {
        println!("BoundingBox: ({},{}) to ({},{})", min_lat, min_lon, max_lat, max_lon);
    },
    Value::LineString(points) => println!("LineString: {} points", points.len()),
    Value::Polygon { exterior, holes } => println!("Polygon: {} exterior, {} holes", exterior.len(), holes.len()),
    Value::MultiPoint(points) => println!("MultiPoint: {} points", points.len()),
    Value::MultiLineString(lines) => println!("MultiLineString: {} lines", lines.len()),
    Value::MultiPolygon(polygons) => println!("MultiPolygon: {} polygons", polygons.len()),
    Value::GeometryCollection(geoms) => println!("GeometryCollection: {} geometries", geoms.len()),
    Value::BlockRef(hash) => println!("BlockRef: {:?}", &hash[0..4]),
    Value::SchemaRef { namespace, name, version } => println!("SchemaRef: {}:{}@{}", namespace, name, version),
    Value::Record { table, id } => println!("Record: {}:{}", table, id),
    Value::Range { start, end, start_inclusive, end_inclusive } => {
        println!("Range: {}{:?},{:?}{}", 
                 if *start_inclusive { "[" } else { "(" },
                 start, end,
                 if *end_inclusive { "]" } else { ")" });
    },
    Value::Regex(pattern) => println!("Regex: {}", pattern),
    Value::Json(data) => println!("JSON: {} bytes", data.len()),
    Value::Extension { type_id, data } => println!("Extension: type 0x{:04X}, {} bytes", type_id, data.len()),
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
// === From Rust Primitives ===
let v1: Value = 42_i64.into();      // Int
let v2: Value = "hello".into();     // String
let v3: Value = true.into();        // Bool
let v4: Value = 3.14_f64.into();    // Float
let v5: Value = 100_u64.into();     // UInt
let v6: Value = vec![1_i64, 2, 3].into(); // Array

// === Binary Data ===
let bytes: Value = vec![0x01, 0x02, 0x03].into(); // Bytes
let hash256: Value = [0u8; 32].into();             // Hash256

// === Temporal Constructors ===
let timestamp = Value::Timestamp(1609459200);
let precise_time = Value::TimestampNanos { 
    seconds: 1609459200, 
    nanos: 123456789 
};
let duration = Value::Duration(3600_000_000_000); // 1 hour in ns

let date = Value::Date { year: 2023, month: 12, day: 25 };
let time = Value::Time { hour: 14, minute: 30, second: 0, nanos: 0 };
let datetime = Value::DateTime {
    year: 2023, month: 12, day: 25,
    hour: 14, minute: 30, second: 0, nanos: 0,
    tz_offset_minutes: -480, // PST
};

// === Spatial Constructors ===
let point = Value::point2d(37.7749, -122.4194);
let point3d = Value::point3d(37.7749, -122.4194, 100.0);

// Simple geometry
let line = Value::linestring(&[(0.0, 0.0), (1.0, 1.0)]);
let polygon = Value::polygon(
    &[(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0), (0.0, 0.0)],
    &[] // No holes
);
let multipoint = Value::multipoint(&[(0.0, 0.0), (1.0, 1.0)]);

// Complex geometry (fixed-point coordinates)
let multiline = Value::multilinestring(vec![
    vec![(0, 0), (1000000, 1000000)],        // Line 1
    vec![(2000000, 0), (3000000, 1000000)],  // Line 2
]);

let multipoly = Value::multipolygon(vec![
    (vec![(0, 0), (1000000, 0), (1000000, 1000000), (0, 1000000), (0, 0)], vec![])
]);

let geom_collection = Value::geometry_collection(vec![
    Value::point2d(37.7749, -122.4194),
    Value::linestring(&[(37.7749, -122.4194), (37.7751, -122.4180)]),
]);

// === Identifier Constructors ===
let uuid1 = Value::uuid([1u8; 16]);
let uuid2 = Value::uuid_from_u128(0x123456789ABCDEF0123456789ABCDEF0);

// === Pattern and Range Constructors ===
let regex = Value::regex(r"^\d{3}-\d{3}-\d{4}$");
let range = Value::range(Value::Int(1), Value::Int(100));          // [1, 100)
let range_inc = Value::range_inclusive(Value::Int(1), Value::Int(100)); // [1, 100]

// === Database Reference Constructors ===
let user_record = Value::record("users", "user_123");
let sensor_record = Value::record("sensors", "temp_001");

// === Structured Data ===
let json_doc = Value::Json(br#"{"temperature": 23.5, "unit": "celsius"}"#.to_vec());

// Collections
let mut object = std::collections::BTreeMap::new();
object.insert("temperature".to_string(), Value::Float(23.5));
object.insert("location".to_string(), Value::point2d(37.7749, -122.4194));
let sensor_reading = Value::Object(object);

let mut tags = std::collections::BTreeSet::new();
tags.insert(Value::String("outdoor".to_string()));
tags.insert(Value::String("temperature".to_string()));
let tag_set = Value::Set(tags);

// === Decimal Constructor ===
let price = Value::Decimal { value: 1999, scale: 2 }; // $19.99

// === Block and Schema References ===
let block_ref = Value::BlockRef([0u8; 32]);
let schema_ref = Value::SchemaRef {
    namespace: "health".to_string(),
    name: "heart_rate".to_string(),
    version: "1.2.0".to_string(),
};

// === Extension Constructor ===
let custom_extension = Value::Extension {
    type_id: 0x8001,
    data: vec![0x01, 0x02, 0x03, 0x04],
};
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
