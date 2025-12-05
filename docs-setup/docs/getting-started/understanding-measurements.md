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

The actual data, supporting 36 types across multiple categories:

```rust
// === Absence and Primitives ===
Value::None                      // No value present
Value::Bool(true)                // Boolean
Value::Int(42)                   // Signed 64-bit integer
Value::UInt(100)                 // Unsigned 64-bit integer
Value::Float(22.5)              // 64-bit floating point
Value::Decimal { value: 1999, scale: 2 } // Exact precision ($19.99)

// === Text and Binary ===
Value::String("Hello".to_string()) // UTF-8 string
Value::Bytes(vec![0x01, 0x02])     // Raw bytes
Value::Hash256([0u8; 32])          // SHA-256 hash
Value::Hash512([0u8; 64])          // SHA-512 hash

// === Temporal ===
Value::Timestamp(1234567890)       // Unix timestamp (seconds)
Value::TimestampNanos { seconds: 1234567890, nanos: 123456 } // Nanosecond precision
Value::Duration(3600_000_000_000)  // Duration in nanoseconds
Value::Date { year: 2023, month: 12, day: 25 }              // Calendar date
Value::Time { hour: 14, minute: 30, second: 0, nanos: 0 }   // Time of day
Value::DateTime { year: 2023, month: 12, day: 25, hour: 14, // Full datetime
                  minute: 30, second: 0, nanos: 0, tz_offset_minutes: -480 }

// === Collections ===
Value::Array(vec![...])         // Ordered lists
Value::Object(map)              // Key-value maps (BTreeMap)
Value::Set(set)                 // Unique values (BTreeSet)

// === Spatial (fixed-point coordinates) ===
Value::Point2D { lat, lon }     // 2D location
Value::Point3D { lat, lon, alt } // 3D location with altitude
Value::BoundingBox { min_lat, min_lon, max_lat, max_lon } // Rectangular area

// === Extended Geometry (GeoJSON-compatible) ===
Value::LineString(points)       // Path of connected points
Value::Polygon { exterior, holes } // Polygon with potential holes
Value::MultiPoint(points)       // Collection of points
Value::MultiLineString(lines)   // Collection of line strings
Value::MultiPolygon(polygons)   // Collection of polygons
Value::GeometryCollection(geoms) // Mixed geometry types

// === Identifiers ===
Value::UUID([0u8; 16])          // Universally Unique Identifier

// === Ranges and Patterns ===
Value::Range { start, end, start_inclusive, end_inclusive } // Value ranges
Value::Regex("^\d{3}-\d{3}-\d{4}$".to_string()) // Regular expressions

// === References ===
Value::BlockRef([0u8; 32])      // Reference to another block
Value::SchemaRef { namespace, name, version } // Schema reference
Value::Record { table, id }     // Database record reference

// === Structured ===
Value::Json(bytes)              // Raw JSON document

// === Extension Point ===
Value::Extension { type_id, data } // Custom domain-specific types
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

### Geographic Data with Extended Geometry

```rust
// Delivery route using LineString
let delivery_route = Measurement {
    value: Value::linestring(&[
        (37.7749, -122.4194), // Start: San Francisco
        (37.7849, -122.4094), // Waypoint 1
        (37.7949, -122.3994), // End: Destination
    ]),
    uncertainty: Uncertainty::Interval {
        lower_bound: -5.0,  // ±5 meter accuracy
        upper_bound: 5.0,
        confidence: 0.95,
    },
    provenance: Provenance {
        source: Source::Sensor {
            device_id: gps_device_id,
            sensor_type: 0x0001, // GPS
            calibration_id: Some(gps_calibration_id),
        },
        transformations: vec![],
        attestations: vec![],
    },
    validity: ValidityWindow::new(now, Some(now + 3600)), // Valid for 1 hour
};

// Service area coverage using Polygon
let service_area = Measurement {
    value: Value::polygon(
        &[  // Exterior boundary
            (37.7000, -122.5000),
            (37.7000, -122.3000),
            (37.8000, -122.3000),
            (37.8000, -122.5000),
            (37.7000, -122.5000), // Close the ring
        ],
        &[  // Holes (excluded areas)
            &[(37.7300, -122.4300), (37.7300, -122.4100), 
              (37.7500, -122.4100), (37.7500, -122.4300), (37.7300, -122.4300)]
        ]
    ),
    uncertainty: Uncertainty::Exact, // Defined boundary
    provenance: Provenance {
        source: Source::SelfReported {
            reporter_id: business_id,
            method: 0x0002, // Geographic tool
        },
        transformations: vec![],
        attestations: vec![],
    },
    validity: ValidityWindow::indefinite(), // Service area doesn't change often
};
```

### Temporal Event Sequences

```rust
// Precise event timing with nanosecond accuracy
let system_event = Measurement {
    value: Value::TimestampNanos {
        seconds: 1640995200,    // 2022-01-01 00:00:00 UTC
        nanos: 123456789,       // Additional nanoseconds
    },
    uncertainty: Uncertainty::Interval {
        lower_bound: -0.001,    // ±1ms accuracy
        upper_bound: 0.001,
        confidence: 0.999,
    },
    provenance: Provenance {
        source: Source::Sensor {
            device_id: atomic_clock_id,
            sensor_type: 0x0010, // Atomic clock
            calibration_id: Some(nist_calibration_id),
        },
        transformations: vec![],
        attestations: vec![],
    },
    validity: ValidityWindow::new(now, Some(now + 1)), // Valid for 1 second
};

// Date without time (for events, birthdays, etc.)
let birth_date = Measurement {
    value: Value::Date {
        year: 1990,
        month: 6,
        day: 15,
    },
    uncertainty: Uncertainty::Exact, // Exact known date
    provenance: Provenance {
        source: Source::SelfReported {
            reporter_id: user_id,
            method: 0x0001, // Form entry
        },
        transformations: vec![],
        attestations: vec![],
    },
    validity: ValidityWindow::indefinite(), // Birth date doesn't change
};
```

### Financial and Precise Numeric Data

```rust
// Financial transaction using Decimal for exact precision
let transaction_amount = Measurement {
    value: Value::Decimal {
        value: 1234567,  // $12,345.67 stored as 1234567 cents
        scale: 2,        // 2 decimal places
    },
    uncertainty: Uncertainty::Exact, // Exact financial amount
    provenance: Provenance {
        source: Source::Oracle {
            oracle_id: payment_processor_id,
            query_id: Some(transaction_id),
        },
        transformations: vec![],
        attestations: vec![
            Attestation {
                attestor: bank_id,
                claim: AttestationClaim::Verified {
                    reference_id: bank_record_id,
                },
                signature: bank_signature,
                timestamp: transaction_time,
            }
        ],
    },
    validity: ValidityWindow::new(transaction_time, Some(transaction_time + 86400 * 7)), // Valid for 1 week
};
```

### Structured Data and References

```rust
// Complex sensor reading using Object
let environmental_reading = Measurement {
    value: {
        let mut readings = std::collections::BTreeMap::new();
        readings.insert("temperature".to_string(), Value::Float(23.5));
        readings.insert("humidity".to_string(), Value::Float(65.0));
        readings.insert("pressure".to_string(), Value::Float(1013.25));
        readings.insert("location".to_string(), Value::point2d(37.7749, -122.4194));
        readings.insert("device_id".to_string(), Value::UUID(sensor_uuid));
        Value::Object(readings)
    },
    uncertainty: Uncertainty::Gaussian { std_dev: 1.0 }, // Combined uncertainty
    provenance: Provenance {
        source: Source::Sensor {
            device_id: weather_station_id,
            sensor_type: 0x0020, // Multi-sensor weather station
            calibration_id: Some(calibration_id),
        },
        transformations: vec![],
        attestations: vec![],
    },
    validity: ValidityWindow::decaying(1800, 600), // Valid for 30 minutes, decays with 10-min half-life
};

// Reference to related data
let analysis_result = Measurement {
    value: Value::Record {
        table: "analyses".to_string(),
        id: "weather_analysis_20240101".to_string(),
    },
    uncertainty: Uncertainty::confidence(0.92), // 92% confidence in analysis
    provenance: Provenance {
        source: Source::Derived {
            algorithm_id: 0x3001, // Weather analysis algorithm
            inputs: vec![environmental_reading_hash],
            parameters: Some(analysis_params),
        },
        transformations: vec![],
        attestations: vec![],
    },
    validity: ValidityWindow::new(now, Some(now + 86400)), // Valid for 24 hours
};
```

### Pattern Matching and Validation

```rust
// Data validation using regex patterns
let phone_validation = Measurement {
    value: Value::Regex(r"^\+1\d{10}$".to_string()), // US phone number pattern
    uncertainty: Uncertainty::Exact, // Pattern is exactly defined
    provenance: Provenance {
        source: Source::SelfReported {
            reporter_id: system_admin_id,
            method: 0x0003, // Configuration
        },
        transformations: vec![],
        attestations: vec![],
    },
    validity: ValidityWindow::indefinite(), // Validation rules are stable
};

// Value range constraints
let temperature_range = Measurement {
    value: Value::range_inclusive(
        Value::Float(-40.0),  // Minimum valid temperature
        Value::Float(85.0),   // Maximum valid temperature
    ),
    uncertainty: Uncertainty::Exact, // Range is exactly defined
    provenance: Provenance {
        source: Source::Oracle {
            oracle_id: equipment_spec_id,
            query_id: Some(sensor_spec_id),
        },
        transformations: vec![],
        attestations: vec![],
    },
    validity: ValidityWindow::indefinite(), // Sensor specs don't change often
};
```

### Custom Domain Extensions

```rust
// Biometric data using Extension type
let fingerprint_data = Measurement {
    value: Value::Extension {
        type_id: 0x8001,                    // Biometric data type
        data: biometric_encoder.encode(&fingerprint_template),
    },
    uncertainty: Uncertainty::confidence(0.999), // Very high confidence
    provenance: Provenance {
        source: Source::Sensor {
            device_id: fingerprint_scanner_id,
            sensor_type: 0x0030, // Fingerprint scanner
            calibration_id: Some(fbi_certification_id),
        },
        transformations: vec![
            Transformation {
                operation: TransformationOp::Custom {
                    type_id: 0x8001,        // Biometric processing
                    parameters: privacy_params,
                },
                timestamp: scan_time,
                actor: biometric_processor_id,
                input_hash: raw_scan_hash,
            }
        ],
        attestations: vec![
            Attestation {
                attestor: security_officer_id,
                claim: AttestationClaim::DeviceCertified {
                    certification_id: fbi_cert_id,
                },
                signature: officer_signature,
                timestamp: certification_time,
            }
        ],
    },
    validity: ValidityWindow::new(scan_time, Some(scan_time + 300)), // Valid for 5 minutes
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