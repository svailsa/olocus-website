---
id: clustering
title: Clustering Algorithms
sidebar_position: 3
---

# Clustering Algorithms

The Location extension provides multiple clustering algorithms for analyzing spatial-temporal patterns in location data. Each algorithm is optimized for different use cases and data characteristics.

## Overview

Clustering algorithms group similar locations together to identify:
- **Significant Places**: Frequently visited locations
- **Movement Patterns**: Routes and transitions  
- **Behavioral Insights**: Daily routines and habits

```rust
use olocus_location::clustering::*;

// Available clustering algorithms
let dbscan = ClusteringAlgorithm::DBSCAN {
    epsilon: 30.0,      // 30m radius
    min_points: 3,      // Minimum 3 points per cluster
};

let kmeans = ClusteringAlgorithm::KMeans {
    k: 8,               // 8 expected locations
    max_iterations: 100,
    convergence_threshold: 1.0,
};

let optics = ClusteringAlgorithm::OPTICS {
    min_points: 3,
    epsilon: 100.0,
    xi: 0.05,
};

let hdbscan = ClusteringAlgorithm::HDBSCAN {
    min_cluster_size: 5,
    min_samples: 3,
    cluster_selection_epsilon: 0.0,
};
```

## DBSCAN (Density-Based Spatial Clustering)

DBSCAN is ideal for finding dense clusters of arbitrary shape and handling noise:

### Algorithm Implementation

```rust
use olocus_location::clustering::dbscan::*;

#[derive(Debug, Clone)]
pub struct DBSCANConfig {
    pub epsilon: f64,                    // Maximum distance between points (meters)
    pub min_points: usize,               // Minimum points to form dense region
    pub distance_metric: DistanceMetric, // Haversine, Euclidean, Manhattan
}

#[derive(Debug, Clone)]
pub enum DistanceMetric {
    Haversine,   // Great circle distance for GPS coordinates
    Euclidean,   // Straight-line distance for projected coordinates
    Manhattan,   // City-block distance for grid-based movement
}

pub struct DBSCANClusterer {
    config: DBSCANConfig,
}

impl DBSCANClusterer {
    pub fn cluster(&self, points: &[LocationMeasurement]) -> Result<Vec<Cluster>> {
        let mut clusters = Vec::new();
        let mut visited = vec![false; points.len()];
        let mut cluster_id = 0;
        
        for (i, point) in points.iter().enumerate() {
            if visited[i] {
                continue;
            }
            
            visited[i] = true;
            let neighbors = self.find_neighbors(point, points);
            
            if neighbors.len() < self.config.min_points {
                // Mark as noise
                continue;
            }
            
            // Start new cluster
            let cluster = self.expand_cluster(
                i, &neighbors, points, &mut visited, cluster_id
            )?;
            clusters.push(cluster);
            cluster_id += 1;
        }
        
        Ok(clusters)
    }
    
    fn find_neighbors(&self, center: &LocationMeasurement, points: &[LocationMeasurement]) -> Vec<usize> {
        points.iter().enumerate()
            .filter_map(|(i, point)| {
                let distance = self.calculate_distance(center, point);
                if distance <= self.config.epsilon {
                    Some(i)
                } else {
                    None
                }
            })
            .collect()
    }
    
    fn calculate_distance(&self, p1: &LocationMeasurement, p2: &LocationMeasurement) -> f64 {
        match self.config.distance_metric {
            DistanceMetric::Haversine => {
                Coordinate::haversine_distance(
                    p1.measurement.value.x(), p1.measurement.value.y(),
                    p2.measurement.value.x(), p2.measurement.value.y()
                )
            },
            DistanceMetric::Euclidean => {
                let dx = (p1.measurement.value.x() - p2.measurement.value.x()) as f64 / 10_000_000.0;
                let dy = (p1.measurement.value.y() - p2.measurement.value.y()) as f64 / 10_000_000.0;
                ((dx * dx + dy * dy).sqrt()) * 111_320.0 // Approximate meters per degree
            },
            DistanceMetric::Manhattan => {
                let dx = ((p1.measurement.value.x() - p2.measurement.value.x()).abs() as f64) / 10_000_000.0;
                let dy = ((p1.measurement.value.y() - p2.measurement.value.y()).abs() as f64) / 10_000_000.0;
                (dx + dy) * 111_320.0
            }
        }
    }
}
```

### DBSCAN Configuration Examples

```rust
// Dense urban environment
let urban_dbscan = DBSCANConfig {
    epsilon: 15.0,                          // Small radius for precise clustering
    min_points: 5,                          // Higher threshold for dense data
    distance_metric: DistanceMetric::Haversine,
};

// Sparse rural environment
let rural_dbscan = DBSCANConfig {
    epsilon: 50.0,                          // Larger radius for GPS variance
    min_points: 2,                          // Lower threshold for sparse data
    distance_metric: DistanceMetric::Haversine,
};

// Indoor positioning with beacons
let indoor_dbscan = DBSCANConfig {
    epsilon: 5.0,                           // High precision indoor
    min_points: 3,                          // Moderate threshold
    distance_metric: DistanceMetric::Euclidean,
};

// Vehicle tracking on roads
let vehicle_dbscan = DBSCANConfig {
    epsilon: 25.0,                          // Road-width tolerance
    min_points: 4,                          // Filter brief stops
    distance_metric: DistanceMetric::Haversine,
};
```

## K-Means Clustering

K-Means partitions data into a predetermined number of clusters:

### Algorithm Implementation

```rust
use olocus_location::clustering::kmeans::*;

#[derive(Debug, Clone)]
pub struct KMeansConfig {
    pub k: usize,                           // Number of clusters
    pub max_iterations: usize,              // Maximum iterations
    pub convergence_threshold: f64,         // Convergence threshold (meters)
    pub initialization: InitMethod,         // Centroid initialization method
}

#[derive(Debug, Clone)]
pub enum InitMethod {
    Random,                                 // Random centroid placement
    KMeansPlusPlus,                        // K-means++ initialization
    Forgy,                                 // Forgy method (random points as centroids)
}

pub struct KMeansClusterer {
    config: KMeansConfig,
}

impl KMeansClusterer {
    pub fn cluster(&self, points: &[LocationMeasurement]) -> Result<KMeansResult> {
        let mut centroids = self.initialize_centroids(points)?;
        let mut assignments = vec![0; points.len()];
        
        for iteration in 0..self.config.max_iterations {
            // Assign points to nearest centroid
            let mut changed = false;
            for (i, point) in points.iter().enumerate() {
                let new_assignment = self.find_nearest_centroid(point, &centroids);
                if assignments[i] != new_assignment {
                    assignments[i] = new_assignment;
                    changed = true;
                }
            }
            
            // Update centroids
            let new_centroids = self.update_centroids(points, &assignments)?;
            
            // Check convergence
            let max_movement = centroids.iter().zip(new_centroids.iter())
                .map(|(old, new)| Coordinate::haversine_distance(
                    old.latitude, old.longitude,
                    new.latitude, new.longitude
                ))
                .fold(0.0, f64::max);
                
            centroids = new_centroids;
            
            if !changed || max_movement < self.config.convergence_threshold {
                return Ok(KMeansResult {
                    centroids,
                    assignments,
                    iterations: iteration + 1,
                    inertia: self.calculate_inertia(points, &centroids, &assignments),
                });
            }
        }
        
        Ok(KMeansResult {
            centroids,
            assignments,
            iterations: self.config.max_iterations,
            inertia: self.calculate_inertia(points, &centroids, &assignments),
        })
    }
    
    fn initialize_centroids(&self, points: &[LocationMeasurement]) -> Result<Vec<Coordinate>> {
        match self.config.initialization {
            InitMethod::Random => self.random_initialization(points),
            InitMethod::KMeansPlusPlus => self.kmeans_plus_plus_initialization(points),
            InitMethod::Forgy => self.forgy_initialization(points),
        }
    }
    
    fn kmeans_plus_plus_initialization(&self, points: &[LocationMeasurement]) -> Result<Vec<Coordinate>> {
        let mut centroids = Vec::with_capacity(self.config.k);
        let mut rng = rand::thread_rng();
        
        // Choose first centroid randomly
        let first_index = rng.gen_range(0..points.len());
        centroids.push(Coordinate {
            latitude: points[first_index].measurement.value.x(),
            longitude: points[first_index].measurement.value.y(),
        });
        
        // Choose remaining centroids with probability proportional to squared distance
        for _ in 1..self.config.k {
            let distances: Vec<f64> = points.iter()
                .map(|point| {
                    centroids.iter()
                        .map(|centroid| Coordinate::haversine_distance(
                            centroid.latitude, centroid.longitude,
                            point.measurement.value.x(), point.measurement.value.y()
                        ))
                        .fold(f64::INFINITY, f64::min)
                        .powi(2)
                })
                .collect();
                
            let total_distance: f64 = distances.iter().sum();
            let threshold = rng.gen::<f64>() * total_distance;
            
            let mut cumsum = 0.0;
            for (i, &distance) in distances.iter().enumerate() {
                cumsum += distance;
                if cumsum >= threshold {
                    centroids.push(Coordinate {
                        latitude: points[i].measurement.value.x(),
                        longitude: points[i].measurement.value.y(),
                    });
                    break;
                }
            }
        }
        
        Ok(centroids)
    }
}
```

### K-Means Optimization

```rust
// Automatic K selection using elbow method
pub fn find_optimal_k(points: &[LocationMeasurement], max_k: usize) -> Result<usize> {
    let mut inertias = Vec::new();
    
    for k in 1..=max_k {
        let config = KMeansConfig {
            k,
            max_iterations: 100,
            convergence_threshold: 1.0,
            initialization: InitMethod::KMeansPlusPlus,
        };
        
        let clusterer = KMeansClusterer::new(config);
        let result = clusterer.cluster(points)?;
        inertias.push(result.inertia);
    }
    
    // Find elbow point (maximum reduction in inertia)
    let mut max_reduction = 0.0;
    let mut optimal_k = 2;
    
    for i in 1..inertias.len() - 1 {
        let reduction = inertias[i - 1] - 2.0 * inertias[i] + inertias[i + 1];
        if reduction > max_reduction {
            max_reduction = reduction;
            optimal_k = i + 1;
        }
    }
    
    Ok(optimal_k)
}
```

## OPTICS (Ordering Points To Identify Clustering Structure)

OPTICS provides hierarchical density-based clustering:

### Algorithm Implementation

```rust
use olocus_location::clustering::optics::*;

#[derive(Debug, Clone)]
pub struct OPTICSConfig {
    pub min_points: usize,                  // Minimum points for core object
    pub epsilon: f64,                       // Maximum search radius (meters)
    pub xi: f64,                           // Steepness threshold for cluster extraction
}

pub struct OPTICSClusterer {
    config: OPTICSConfig,
}

#[derive(Debug, Clone)]
pub struct OPTICSResult {
    pub ordering: Vec<usize>,               // Point ordering
    pub reachability: Vec<Option<f64>>,     // Reachability distances
    pub core_distances: Vec<Option<f64>>,   // Core distances
}

impl OPTICSClusterer {
    pub fn cluster(&self, points: &[LocationMeasurement]) -> Result<OPTICSResult> {
        let mut ordering = Vec::new();
        let mut processed = vec![false; points.len()];
        let mut reachability = vec![None; points.len()];
        let mut core_distances = vec![None; points.len()];
        
        // Calculate core distances
        for (i, point) in points.iter().enumerate() {
            let neighbors = self.find_neighbors(i, points);
            if neighbors.len() >= self.config.min_points {
                core_distances[i] = Some(self.find_kth_distance(i, &neighbors, points));
            }
        }
        
        // Process all points
        for i in 0..points.len() {
            if processed[i] {
                continue;
            }
            
            self.expand_cluster_order(
                i, points, &mut processed, &mut ordering,
                &mut reachability, &core_distances
            )?;
        }
        
        Ok(OPTICSResult {
            ordering,
            reachability,
            core_distances,
        })
    }
    
    fn expand_cluster_order(
        &self,
        point_idx: usize,
        points: &[LocationMeasurement],
        processed: &mut [bool],
        ordering: &mut Vec<usize>,
        reachability: &mut [Option<f64>],
        core_distances: &[Option<f64>],
    ) -> Result<()> {
        let mut priority_queue = BinaryHeap::new();
        processed[point_idx] = true;
        ordering.push(point_idx);
        
        if let Some(core_dist) = core_distances[point_idx] {
            let neighbors = self.find_neighbors(point_idx, points);
            self.update_priority_queue(
                &neighbors, points, core_dist,
                &mut priority_queue, processed, reachability
            )?;
        }
        
        while let Some(OrderPoint { index, distance: _ }) = priority_queue.pop() {
            processed[index] = true;
            ordering.push(index);
            
            if let Some(core_dist) = core_distances[index] {
                let neighbors = self.find_neighbors(index, points);
                self.update_priority_queue(
                    &neighbors, points, core_dist,
                    &mut priority_queue, processed, reachability
                )?;
            }
        }
        
        Ok(())
    }
}
```

### Cluster Extraction from OPTICS

```rust
impl OPTICSResult {
    pub fn extract_clusters(&self, xi: f64) -> Result<Vec<Cluster>> {
        let mut clusters = Vec::new();
        let mut steep_up_areas = Vec::new();
        let mut cluster_starts = Vec::new();
        
        // Find steep areas in reachability plot
        for i in 1..self.reachability.len() {
            let prev_reach = self.reachability[i - 1].unwrap_or(f64::INFINITY);
            let curr_reach = self.reachability[i].unwrap_or(f64::INFINITY);
            
            // Steep up area (significant increase in reachability)
            if curr_reach > prev_reach * (1.0 + xi) {
                steep_up_areas.push(i);
            }
            
            // Steep down area (significant decrease in reachability)
            if prev_reach > curr_reach * (1.0 + xi) {
                cluster_starts.push(i);
            }
        }
        
        // Extract clusters between steep areas
        for (start_idx, &start) in cluster_starts.iter().enumerate() {
            let end = steep_up_areas.get(start_idx).copied()
                .unwrap_or(self.ordering.len());
                
            if end - start >= 3 { // Minimum cluster size
                let cluster_points: Vec<usize> = self.ordering[start..end].to_vec();
                let centroid = self.calculate_centroid(&cluster_points)?;
                
                clusters.push(Cluster::Core {
                    id: start_idx,
                    points: cluster_points,
                    centroid,
                });
            }
        }
        
        Ok(clusters)
    }
}
```

## HDBSCAN (Hierarchical DBSCAN)

HDBSCAN provides parameter-free hierarchical clustering:

### Algorithm Implementation

```rust
use olocus_location::clustering::hdbscan::*;

#[derive(Debug, Clone)]
pub struct HDBSCANConfig {
    pub min_cluster_size: usize,            // Minimum cluster size
    pub min_samples: usize,                 // Minimum samples for core point
    pub cluster_selection_epsilon: f64,     // Cluster selection threshold
    pub cluster_selection_method: ClusterSelection,
}

#[derive(Debug, Clone)]
pub enum ClusterSelection {
    EOM,    // Excess of Mass
    Leaf,   // Leaf selection
}

pub struct HDBSCANClusterer {
    config: HDBSCANConfig,
}

impl HDBSCANClusterer {
    pub fn cluster(&self, points: &[LocationMeasurement]) -> Result<HDBSCANResult> {
        // 1. Build minimum spanning tree
        let mst = self.build_minimum_spanning_tree(points)?;
        
        // 2. Build cluster hierarchy
        let hierarchy = self.build_hierarchy(&mst)?;
        
        // 3. Extract flat clustering
        let clusters = self.extract_clusters(&hierarchy)?;
        
        // 4. Calculate stability scores
        let stability_scores = self.calculate_stability(&hierarchy, &clusters)?;
        
        Ok(HDBSCANResult {
            clusters,
            hierarchy,
            stability_scores,
            noise_points: self.identify_noise_points(&clusters, points.len()),
        })
    }
    
    fn build_minimum_spanning_tree(&self, points: &[LocationMeasurement]) -> Result<MST> {
        // Use Prim's algorithm to build MST of mutual reachability distances
        let mut mst = MST::new();
        let mut visited = vec![false; points.len()];
        let mut min_edge = vec![(f64::INFINITY, 0); points.len()];
        
        min_edge[0] = (0.0, 0);
        
        for _ in 0..points.len() {
            let mut u = usize::MAX;
            for v in 0..points.len() {
                if !visited[v] && (u == usize::MAX || min_edge[v].0 < min_edge[u].0) {
                    u = v;
                }
            }
            
            visited[u] = true;
            
            if min_edge[u].0 != 0.0 {
                mst.add_edge(min_edge[u].1, u, min_edge[u].0);
            }
            
            for v in 0..points.len() {
                if !visited[v] {
                    let mutual_reach_dist = self.mutual_reachability_distance(u, v, points);
                    if mutual_reach_dist < min_edge[v].0 {
                        min_edge[v] = (mutual_reach_dist, u);
                    }
                }
            }
        }
        
        Ok(mst)
    }
    
    fn mutual_reachability_distance(
        &self,
        i: usize,
        j: usize,
        points: &[LocationMeasurement]
    ) -> f64 {
        let core_dist_i = self.core_distance(i, points);
        let core_dist_j = self.core_distance(j, points);
        let direct_dist = Coordinate::haversine_distance(
            points[i].measurement.value.x(), points[i].measurement.value.y(),
            points[j].measurement.value.x(), points[j].measurement.value.y()
        );
        
        core_dist_i.max(core_dist_j).max(direct_dist)
    }
}
```

## Performance Comparison

### Algorithm Characteristics

| Algorithm | Time Complexity | Space Complexity | Best Use Case |
|-----------|----------------|------------------|---------------|
| DBSCAN | O(n log n) | O(n) | Dense, irregular clusters |
| K-Means | O(nkt) | O(nk) | Spherical, balanced clusters |
| OPTICS | O(n²) | O(n) | Hierarchical analysis |
| HDBSCAN | O(n² log n) | O(n²) | Varying density clusters |

### Performance Benchmarks

```rust
use std::time::Instant;

fn benchmark_clustering_algorithms(points: &[LocationMeasurement]) -> BenchmarkResults {
    let mut results = BenchmarkResults::new();
    
    // DBSCAN benchmark
    let start = Instant::now();
    let dbscan = DBSCANClusterer::new(DBSCANConfig::default());
    let _clusters = dbscan.cluster(points).unwrap();
    results.dbscan_time = start.elapsed();
    
    // K-Means benchmark
    let start = Instant::now();
    let kmeans = KMeansClusterer::new(KMeansConfig::default());
    let _clusters = kmeans.cluster(points).unwrap();
    results.kmeans_time = start.elapsed();
    
    // OPTICS benchmark
    let start = Instant::now();
    let optics = OPTICSClusterer::new(OPTICSConfig::default());
    let _result = optics.cluster(points).unwrap();
    results.optics_time = start.elapsed();
    
    // HDBSCAN benchmark (for smaller datasets)
    if points.len() <= 1000 {
        let start = Instant::now();
        let hdbscan = HDBSCANClusterer::new(HDBSCANConfig::default());
        let _result = hdbscan.cluster(points).unwrap();
        results.hdbscan_time = start.elapsed();
    }
    
    results
}
```

## Spatial Indexing

### KD-Tree for Fast Neighbor Queries

```rust
use olocus_location::spatial::kdtree::*;

pub struct SpatialIndex {
    kdtree: KDTree,
    points: Vec<LocationMeasurement>,
}

impl SpatialIndex {
    pub fn new(points: Vec<LocationMeasurement>) -> Self {
        let mut kdtree = KDTree::new();
        
        for (i, point) in points.iter().enumerate() {
            kdtree.insert([
                point.measurement.value.x() as f64 / 10_000_000.0,  // Convert to decimal degrees
                point.measurement.value.y() as f64 / 10_000_000.0,
            ], i);
        }
        
        Self { kdtree, points }
    }
    
    pub fn find_neighbors(&self, center: &LocationMeasurement, radius: f64) -> Vec<usize> {
        let center_coords = [
            center.measurement.value.x() as f64 / 10_000_000.0,
            center.measurement.value.y() as f64 / 10_000_000.0,
        ];
        
        // Convert radius from meters to approximate degrees
        let radius_degrees = radius / 111_320.0; // Approximate meters per degree
        
        self.kdtree.within_radius(&center_coords, radius_degrees)
    }
    
    pub fn k_nearest(&self, center: &LocationMeasurement, k: usize) -> Vec<(usize, f64)> {
        let center_coords = [
            center.measurement.value.x() as f64 / 10_000_000.0,
            center.measurement.value.y() as f64 / 10_000_000.0,
        ];
        
        self.kdtree.k_nearest(&center_coords, k)
            .into_iter()
            .map(|(idx, euclidean_dist)| {
                // Calculate actual haversine distance
                let actual_distance = Coordinate::haversine_distance(
                    center.measurement.value.x(), center.measurement.value.y(),
                    self.points[idx].measurement.value.x(), self.points[idx].measurement.value.y()
                );
                (idx, actual_distance)
            })
            .collect()
    }
}
```

## Integration Examples

### Adaptive Clustering

```rust
use olocus_location::clustering::adaptive::*;

pub struct AdaptiveClusterer {
    spatial_index: SpatialIndex,
    algorithms: Vec<Box<dyn ClusteringAlgorithm>>,
}

impl AdaptiveClusterer {
    pub fn cluster_adaptive(&self, points: &[LocationMeasurement]) -> Result<Vec<Cluster>> {
        // Analyze data characteristics
        let stats = self.analyze_data_characteristics(points);
        
        // Select optimal algorithm based on characteristics
        let algorithm = match stats.density_distribution {
            DensityDistribution::Uniform => &self.algorithms[0], // K-Means
            DensityDistribution::Varying => &self.algorithms[1], // HDBSCAN
            DensityDistribution::Sparse => &self.algorithms[2],  // DBSCAN
        };
        
        algorithm.cluster(points)
    }
    
    fn analyze_data_characteristics(&self, points: &[LocationMeasurement]) -> DataCharacteristics {
        let mut densities = Vec::new();
        
        // Sample density at various points
        for i in (0..points.len()).step_by(points.len() / 20) {
            let neighbors = self.spatial_index.find_neighbors(&points[i], 100.0);
            densities.push(neighbors.len() as f64 / (std::f64::consts::PI * 100.0 * 100.0));
        }
        
        let mean_density = densities.iter().sum::<f64>() / densities.len() as f64;
        let density_variance = densities.iter()
            .map(|&d| (d - mean_density).powi(2))
            .sum::<f64>() / densities.len() as f64;
            
        DataCharacteristics {
            point_count: points.len(),
            mean_density,
            density_variance,
            density_distribution: if density_variance < mean_density * 0.1 {
                DensityDistribution::Uniform
            } else if density_variance > mean_density {
                DensityDistribution::Varying
            } else {
                DensityDistribution::Sparse
            },
        }
    }
}
```

### Stream Processing

```rust
use tokio_stream::StreamExt;

async fn process_location_stream_with_clustering() -> Result<()> {
    let mut location_buffer = Vec::new();
    let mut clusterer = DBSCANClusterer::new(DBSCANConfig::default());
    let mut stream = get_location_stream().await?;
    
    while let Some(location) = stream.next().await {
        location_buffer.push(location?);
        
        // Process in batches of 100 locations
        if location_buffer.len() >= 100 {
            let clusters = clusterer.cluster(&location_buffer)?;
            
            // Process identified clusters
            for cluster in clusters {
                if let Cluster::Core { id, points, centroid } = cluster {
                    println!("New cluster {} with {} points at {:.6},{:.6}", 
                        id, points.len(), centroid.latitude, centroid.longitude);
                    
                    // Create visit block for significant clusters
                    if points.len() >= 5 {
                        let visit_block = create_visit_block_from_cluster(&cluster)?;
                        store_block(visit_block).await?;
                    }
                }
            }
            
            // Keep sliding window
            location_buffer.drain(0..50); // Remove older half
        }
    }
    
    Ok(())
}
```

## Testing & Validation

```rust
#[cfg(test)]
mod clustering_tests {
    use super::*;
    
    #[test]
    fn test_dbscan_with_known_clusters() {
        let points = create_test_clusters();
        let config = DBSCANConfig {
            epsilon: 50.0,
            min_points: 3,
            distance_metric: DistanceMetric::Haversine,
        };
        
        let clusterer = DBSCANClusterer::new(config);
        let clusters = clusterer.cluster(&points).unwrap();
        
        // Should find exactly 2 clusters
        let core_clusters: Vec<_> = clusters.into_iter()
            .filter(|c| matches!(c, Cluster::Core { .. }))
            .collect();
            
        assert_eq!(core_clusters.len(), 2);
    }
    
    #[test]
    fn test_kmeans_convergence() {
        let points = create_test_data(100);
        let config = KMeansConfig {
            k: 5,
            max_iterations: 100,
            convergence_threshold: 1.0,
            initialization: InitMethod::KMeansPlusPlus,
        };
        
        let clusterer = KMeansClusterer::new(config);
        let result = clusterer.cluster(&points).unwrap();
        
        // Should converge within reasonable iterations
        assert!(result.iterations < 50);
        assert!(result.inertia > 0.0);
    }
    
    fn create_test_clusters() -> Vec<LocationMeasurement> {
        let mut points = Vec::new();
        
        // Cluster 1: Around downtown SF
        for _ in 0..10 {
            let lat = 37.7749 + (rand::random::<f64>() - 0.5) * 0.001;
            let lon = -122.4194 + (rand::random::<f64>() - 0.5) * 0.001;
            points.push(create_test_location(lat, lon));
        }
        
        // Cluster 2: Around Mission district
        for _ in 0..8 {
            let lat = 37.7599 + (rand::random::<f64>() - 0.5) * 0.001;
            let lon = -122.4148 + (rand::random::<f64>() - 0.5) * 0.001;
            points.push(create_test_location(lat, lon));
        }
        
        // Noise points
        for _ in 0..5 {
            let lat = 37.7000 + rand::random::<f64>() * 0.1;
            let lon = -122.5000 + rand::random::<f64>() * 0.1;
            points.push(create_test_location(lat, lon));
        }
        
        points
    }
}
```

## Configuration Recommendations

### Data Size Guidelines

```rust
// Small datasets (< 1000 points)
if points.len() < 1000 {
    return ClusteringAlgorithm::HDBSCAN {
        min_cluster_size: 3,
        min_samples: 2,
        cluster_selection_epsilon: 0.0,
    };
}

// Medium datasets (1000 - 10000 points)  
if points.len() < 10000 {
    return ClusteringAlgorithm::DBSCAN {
        epsilon: determine_optimal_epsilon(points),
        min_points: 4,
    };
}

// Large datasets (> 10000 points)
ClusteringAlgorithm::KMeans {
    k: estimate_optimal_k(points),
    max_iterations: 100,
    convergence_threshold: 1.0,
    initialization: InitMethod::KMeansPlusPlus,
}
```

## Related Documentation

- [GPS Tracking](./tracking.md) - Coordinate systems and measurement
- [Visit Detection](./visit-detection.md) - Using clustering for visit detection
- [Privacy & Obfuscation](./privacy-obfuscation.md) - Privacy-preserving clustering