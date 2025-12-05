---
id: visit-detection
title: Visit Detection
sidebar_position: 2
---

# Visit Detection

The Location extension provides sophisticated visit detection capabilities using clustering algorithms to identify meaningful stays and locations in movement data.

## Overview

Visit detection analyzes sequences of location measurements to identify:
- **Stops**: Stationary periods exceeding minimum dwell time
- **Visits**: Semantically meaningful locations (home, work, shops)
- **Transitions**: Movement between significant locations

```rust
use olocus_location::visit::*;
use olocus_location::clustering::*;

// Configure visit detection
let config = VisitConfig {
    min_dwell_time: Duration::from_mins(5),    // 5 minute minimum
    max_distance: 50.0,                        // 50m radius for visit
    clustering_algorithm: ClusteringAlgorithm::DBSCAN {
        epsilon: 30.0,      // 30m cluster radius
        min_points: 3,      // minimum 3 points per visit
    },
};

let detector = VisitDetector::new(config);
```

## DBSCAN Clustering

DBSCAN (Density-Based Spatial Clustering) is the primary algorithm for visit detection:

### Algorithm Configuration

```rust
use olocus_location::clustering::dbscan::*;

let dbscan_config = DBSCANConfig {
    epsilon: 30.0,           // Maximum distance between points (meters)
    min_points: 3,           // Minimum points to form a cluster
    distance_metric: DistanceMetric::Haversine, // Geographic distance
};

let dbscan = DBSCANClusterer::new(dbscan_config);
```

### Clustering Process

```rust
// Input: sequence of location measurements
let locations: Vec<LocationMeasurement> = get_location_history();

// Run DBSCAN clustering
let clusters = dbscan.cluster(&locations)?;

for cluster in clusters {
    match cluster {
        Cluster::Core { id, points, centroid } => {
            println!("Visit detected at ({:.6}, {:.6}) with {} points", 
                centroid.latitude, centroid.longitude, points.len());
        },
        Cluster::Noise { points } => {
            println!("Transit points: {} locations", points.len());
        }
    }
}
```

### DBSCAN Parameters

```rust
// Urban environment (dense GPS data)
let urban_config = DBSCANConfig {
    epsilon: 25.0,      // Smaller radius for precise urban locations
    min_points: 4,      // More points needed due to GPS density
    distance_metric: DistanceMetric::Haversine,
};

// Rural environment (sparse GPS data)  
let rural_config = DBSCANConfig {
    epsilon: 100.0,     // Larger radius for sparse data
    min_points: 2,      // Fewer points available
    distance_metric: DistanceMetric::Haversine,
};

// Indoor environment (WiFi/Bluetooth beacons)
let indoor_config = DBSCANConfig {
    epsilon: 10.0,      // High precision indoor positioning
    min_points: 5,      // Dense beacon coverage
    distance_metric: DistanceMetric::Euclidean,
};
```

## Visit Detection Algorithm

### Real-Time Visit Detection

```rust
use std::collections::VecDeque;

pub struct VisitDetector {
    config: VisitConfig,
    location_buffer: VecDeque<LocationMeasurement>,
    current_visit: Option<PendingVisit>,
    clusterer: Box<dyn ClusteringAlgorithm>,
}

impl VisitDetector {
    pub fn add_location(&mut self, location: LocationMeasurement) -> Result<Vec<Visit>> {
        self.location_buffer.push_back(location.clone());
        
        // Keep rolling window of recent locations
        if self.location_buffer.len() > self.config.max_buffer_size {
            self.location_buffer.pop_front();
        }
        
        // Check for visit completion
        let mut completed_visits = Vec::new();
        
        if let Some(ref mut visit) = self.current_visit {
            if self.is_visit_ended(&location, visit) {
                // Complete the current visit
                let finished_visit = self.finalize_visit(visit.clone())?;
                completed_visits.push(finished_visit);
                self.current_visit = None;
            } else {
                // Continue current visit
                visit.locations.push(location);
                visit.end_time = location.timestamp;
            }
        }
        
        // Check for new visit start
        if self.current_visit.is_none() {
            if let Some(new_visit) = self.detect_new_visit(&location)? {
                self.current_visit = Some(new_visit);
            }
        }
        
        Ok(completed_visits)
    }
    
    fn is_visit_ended(&self, location: &LocationMeasurement, visit: &PendingVisit) -> bool {
        // Check if moved too far from visit centroid
        let distance = Coordinate::haversine_distance(
            visit.centroid.latitude,
            visit.centroid.longitude,
            location.measurement.value.x(),
            location.measurement.value.y()
        );
        
        distance > self.config.max_distance
    }
}
```

### Dwell Time Analysis

```rust
#[derive(Debug, Clone)]
pub struct DwellTimeAnalysis {
    pub total_duration: Duration,
    pub active_duration: Duration,     // Time with movement
    pub stationary_duration: Duration, // Time without movement  
    pub movement_ratio: f64,           // active / total
}

impl VisitDetector {
    fn analyze_dwell_time(&self, locations: &[LocationMeasurement]) -> DwellTimeAnalysis {
        let mut active_duration = Duration::ZERO;
        let mut total_duration = Duration::ZERO;
        
        for window in locations.windows(2) {
            let [prev, curr] = [&window[0], &window[1]];
            let time_delta = curr.timestamp.duration_since(prev.timestamp).unwrap_or_default();
            total_duration += time_delta;
            
            // Check for movement above threshold
            let distance = Coordinate::haversine_distance(
                prev.measurement.value.x(), prev.measurement.value.y(),
                curr.measurement.value.x(), curr.measurement.value.y()
            );
            
            if distance > self.config.movement_threshold {
                active_duration += time_delta;
            }
        }
        
        let movement_ratio = if total_duration.as_secs() > 0 {
            active_duration.as_secs_f64() / total_duration.as_secs_f64()
        } else {
            0.0
        };
        
        DwellTimeAnalysis {
            total_duration,
            active_duration,
            stationary_duration: total_duration - active_duration,
            movement_ratio,
        }
    }
}
```

## Visit Classification

### Visit Types

```rust
#[derive(Debug, Clone, PartialEq)]
pub enum VisitType {
    Home,           // Frequent overnight stays
    Work,           // Weekday daytime stays  
    School,         // Regular educational visits
    Shopping,       // Short commercial visits
    Recreation,     // Entertainment venues
    Transit,        // Transportation hubs
    Unknown,        // Unclassified visits
}

#[derive(Debug, Clone)]
pub struct Visit {
    pub id: VisitId,
    pub centroid: Coordinate,
    pub radius: f64,                    // Visit area radius
    pub start_time: SystemTime,
    pub end_time: SystemTime,
    pub duration: Duration,
    pub visit_type: VisitType,
    pub confidence: f64,                // Classification confidence
    pub locations: Vec<LocationMeasurement>,
    pub dwell_analysis: DwellTimeAnalysis,
}
```

### Classification Algorithm

```rust
impl VisitClassifier {
    pub fn classify_visit(&self, visit: &Visit) -> (VisitType, f64) {
        let features = self.extract_features(visit);
        
        // Rule-based classification
        if self.is_home_visit(&features) {
            (VisitType::Home, features.home_confidence)
        } else if self.is_work_visit(&features) {
            (VisitType::Work, features.work_confidence)
        } else if self.is_shopping_visit(&features) {
            (VisitType::Shopping, features.shopping_confidence)
        } else {
            (VisitType::Unknown, 0.5)
        }
    }
    
    fn extract_features(&self, visit: &Visit) -> VisitFeatures {
        VisitFeatures {
            duration: visit.duration,
            time_of_day: self.get_time_of_day(&visit.start_time),
            day_of_week: self.get_day_of_week(&visit.start_time),
            frequency: self.get_visit_frequency(&visit.centroid),
            nearby_pois: self.get_nearby_pois(&visit.centroid),
            movement_pattern: visit.dwell_analysis.movement_ratio,
            home_confidence: self.calculate_home_confidence(visit),
            work_confidence: self.calculate_work_confidence(visit),
            shopping_confidence: self.calculate_shopping_confidence(visit),
        }
    }
    
    fn is_home_visit(&self, features: &VisitFeatures) -> bool {
        // Long duration overnight visits
        features.duration > Duration::from_hours(6) &&
        (features.time_of_day == TimeOfDay::Evening || 
         features.time_of_day == TimeOfDay::Night || 
         features.time_of_day == TimeOfDay::Morning) &&
        features.frequency > 0.7 // Visited regularly
    }
    
    fn is_work_visit(&self, features: &VisitFeatures) -> bool {
        // Weekday daytime visits
        features.duration > Duration::from_hours(2) &&
        features.time_of_day == TimeOfDay::Business &&
        matches!(features.day_of_week, DayOfWeek::Monday..=DayOfWeek::Friday) &&
        features.frequency > 0.5
    }
}
```

## Advanced Clustering Algorithms

### K-Means Clustering

```rust
use olocus_location::clustering::kmeans::*;

let kmeans_config = KMeansConfig {
    k: 5,                           // Expected number of significant locations
    max_iterations: 100,
    convergence_threshold: 1.0,     // Meters
    initialization: InitMethod::KMeansPlusPlus,
};

let kmeans = KMeansClusterer::new(kmeans_config);
let clusters = kmeans.cluster(&location_history)?;
```

### OPTICS Clustering

```rust
use olocus_location::clustering::optics::*;

// OPTICS provides hierarchical density-based clustering
let optics_config = OPTICSConfig {
    min_points: 3,
    epsilon: 100.0,                 // Maximum search radius
    xi: 0.05,                       // Steepness threshold for cluster extraction
};

let optics = OPTICSClusterer::new(optics_config);
let hierarchy = optics.cluster(&locations)?;

// Extract clusters at different density levels
let clusters_loose = hierarchy.extract_clusters(0.1)?;   // Loose clustering
let clusters_tight = hierarchy.extract_clusters(0.3)?;   // Tight clustering
```

### HDBSCAN Clustering

```rust
use olocus_location::clustering::hdbscan::*;

// Hierarchical DBSCAN with automatic parameter selection
let hdbscan_config = HDBSCANConfig {
    min_cluster_size: 5,
    min_samples: 3,
    cluster_selection_epsilon: 0.0, // Use all hierarchy levels
    cluster_selection_method: ClusterSelection::EOM, // Excess of Mass
};

let hdbscan = HDBSCANClusterer::new(hdbscan_config);
let result = hdbscan.cluster(&locations)?;

// HDBSCAN provides stability scores for each cluster
for (cluster_id, stability) in result.cluster_stability {
    println!("Cluster {} stability: {:.2}", cluster_id, stability);
}
```

## Performance Optimization

### Incremental Processing

```rust
pub struct IncrementalVisitDetector {
    spatial_index: KDTree,          // Fast spatial queries
    visit_cache: LRU<VisitId, Visit>,
    recent_locations: CircularBuffer<LocationMeasurement>,
}

impl IncrementalVisitDetector {
    pub fn add_location(&mut self, location: LocationMeasurement) -> Result<Option<Visit>> {
        // Use spatial index for fast nearby visit lookup
        let nearby_visits = self.spatial_index.within_radius(
            &location.centroid(), 
            self.config.max_distance
        );
        
        if let Some(existing_visit_id) = nearby_visits.first() {
            // Extend existing visit
            self.extend_visit(*existing_visit_id, location)
        } else {
            // Check if we have enough points for new visit
            let nearby_points = self.get_nearby_recent_locations(&location);
            if nearby_points.len() >= self.config.min_points {
                self.create_new_visit(nearby_points)
            } else {
                Ok(None)
            }
        }
    }
}
```

### Memory Management

```rust
// Configure memory usage for large datasets
let config = VisitConfig {
    max_buffer_size: 1000,          // Keep last 1000 locations in memory
    visit_cache_size: 100,          // Cache 100 most recent visits
    clustering_batch_size: 500,     // Process locations in batches
    use_spatial_index: true,        // Enable spatial indexing
};

// Periodic cleanup of old data
detector.cleanup_old_data(cutoff_time)?;
```

## Integration Examples

### Real-Time Visit Stream

```rust
use tokio_stream::StreamExt;

async fn process_location_stream() -> Result<()> {
    let mut detector = VisitDetector::new(VisitConfig::default());
    let mut location_stream = get_location_stream().await?;
    
    while let Some(location) = location_stream.next().await {
        match detector.add_location(location?).await? {
            Some(completed_visit) => {
                println!("Visit completed: {:?}", completed_visit);
                
                // Store visit in blockchain
                let visit_block = create_visit_block(completed_visit)?;
                store_block(visit_block).await?;
                
                // Notify applications
                send_visit_notification(&completed_visit).await?;
            },
            None => {
                // Continue tracking
            }
        }
    }
    
    Ok(())
}
```

### Batch Visit Analysis

```rust
async fn analyze_historical_visits(
    start_time: SystemTime,
    end_time: SystemTime
) -> Result<Vec<Visit>> {
    
    // Load historical location data
    let locations = load_location_history(start_time, end_time).await?;
    
    // Configure for historical analysis (different parameters)
    let config = VisitConfig {
        min_dwell_time: Duration::from_mins(10),  // Longer minimum for historical
        clustering_algorithm: ClusteringAlgorithm::HDBSCAN {
            min_cluster_size: 8,    // More conservative for historical data
            min_samples: 5,
        },
        ..Default::default()
    };
    
    let detector = VisitDetector::new(config);
    let visits = detector.detect_visits_batch(&locations)?;
    
    // Classify visits
    let classifier = VisitClassifier::new();
    let classified_visits: Vec<Visit> = visits
        .into_iter()
        .map(|mut visit| {
            let (visit_type, confidence) = classifier.classify_visit(&visit);
            visit.visit_type = visit_type;
            visit.confidence = confidence;
            visit
        })
        .collect();
    
    Ok(classified_visits)
}
```

### Visit Analytics

```rust
pub struct VisitAnalytics {
    pub total_visits: usize,
    pub visit_types: HashMap<VisitType, usize>,
    pub average_duration: Duration,
    pub most_frequent_locations: Vec<(Coordinate, usize)>,
    pub daily_patterns: HashMap<DayOfWeek, Vec<TimeRange>>,
}

impl VisitAnalytics {
    pub fn analyze_visits(visits: &[Visit]) -> Self {
        let total_visits = visits.len();
        
        let mut visit_types = HashMap::new();
        let mut total_duration = Duration::ZERO;
        
        for visit in visits {
            *visit_types.entry(visit.visit_type.clone()).or_insert(0) += 1;
            total_duration += visit.duration;
        }
        
        let average_duration = if total_visits > 0 {
            total_duration / total_visits as u32
        } else {
            Duration::ZERO
        };
        
        // Additional analytics...
        
        Self {
            total_visits,
            visit_types,
            average_duration,
            most_frequent_locations: Self::find_frequent_locations(visits),
            daily_patterns: Self::analyze_daily_patterns(visits),
        }
    }
}
```

## Testing & Validation

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_home_visit_detection() {
        let mut detector = VisitDetector::new(VisitConfig::default());
        
        // Simulate overnight stay at home
        let home_location = create_test_location(37.7749, -122.4194);
        let mut visits = Vec::new();
        
        // Add locations over 8 hours (evening to morning)
        for hour in 20..=28 { // 8pm to 4am next day
            let timestamp = base_time + Duration::from_hours(hour);
            let location = create_location_with_time(home_location, timestamp);
            
            if let Ok(new_visits) = detector.add_location(location).await {
                visits.extend(new_visits);
            }
        }
        
        // Should detect one home visit
        assert_eq!(visits.len(), 1);
        assert_eq!(visits[0].visit_type, VisitType::Home);
        assert!(visits[0].duration >= Duration::from_hours(8));
    }
    
    #[test]
    fn test_dbscan_clustering() {
        let locations = create_clustered_test_data();
        
        let dbscan = DBSCANClusterer::new(DBSCANConfig {
            epsilon: 50.0,
            min_points: 3,
            distance_metric: DistanceMetric::Haversine,
        });
        
        let clusters = dbscan.cluster(&locations).unwrap();
        
        // Verify expected cluster count
        let core_clusters: Vec<_> = clusters.iter()
            .filter(|c| matches!(c, Cluster::Core { .. }))
            .collect();
            
        assert_eq!(core_clusters.len(), 2); // Two distinct visit locations
    }
}
```

## Configuration Examples

### Urban Environment

```rust
let urban_config = VisitConfig {
    min_dwell_time: Duration::from_mins(3),     // Shorter for busy urban areas
    max_distance: 25.0,                         // Smaller radius for precision
    movement_threshold: 5.0,                    // Sensitive movement detection
    clustering_algorithm: ClusteringAlgorithm::DBSCAN {
        epsilon: 20.0,
        min_points: 4,
    },
};
```

### Rural Environment

```rust
let rural_config = VisitConfig {
    min_dwell_time: Duration::from_mins(10),    // Longer for sparse data
    max_distance: 100.0,                        // Larger radius for GPS variance
    movement_threshold: 15.0,                   // Less sensitive to noise
    clustering_algorithm: ClusteringAlgorithm::DBSCAN {
        epsilon: 75.0,
        min_points: 2,
    },
};
```

## Related Documentation

- [GPS Tracking](./tracking.md) - Coordinate systems and accuracy
- [Clustering Algorithms](./clustering.md) - Detailed clustering documentation  
- [Privacy & Obfuscation](./privacy-obfuscation.md) - Protecting visit privacy