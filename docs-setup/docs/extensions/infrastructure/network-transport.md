---
id: network-transport
title: Network Transport Layers
sidebar_position: 2
---

# Network Transport Layers

The Network Transport module provides multiple transport layer implementations for distributed Olocus Protocol communication. Each transport is optimized for different network conditions, security requirements, and performance characteristics.

## Overview

Transport layers handle the underlying network communication between Olocus Protocol nodes:

- **TCP**: Reliable, ordered, connection-oriented transport
- **UDP**: Fast, connectionless transport for high-throughput scenarios
- **QUIC**: Modern multiplexed transport with built-in encryption
- **WebSocket**: Browser-compatible bidirectional communication
- **WebRTC**: Peer-to-peer transport with NAT traversal

```rust
use olocus_network::transport::*;

// Configure transport layer
let transport_config = TransportConfig {
    transport: Transport::QUIC {
        bind_addr: "0.0.0.0:8443".parse()?,
        cert_path: Some("server.crt".to_string()),
        key_path: Some("server.key".to_string()),
        max_concurrent_streams: 100,
    },
    timeout_config: TimeoutConfig {
        connect_timeout: Duration::from_secs(10),
        read_timeout: Duration::from_secs(30),
        write_timeout: Duration::from_secs(30),
    },
    buffer_config: BufferConfig {
        send_buffer_size: 64 * 1024,
        recv_buffer_size: 64 * 1024,
        max_message_size: 1024 * 1024, // 1MB
    },
};

let transport = NetworkTransport::new(transport_config).await?;
```

## Transport Trait Interface

### Core Transport Trait

```rust
use olocus_network::transport::traits::*;
use olocus_core::*;

#[async_trait::async_trait]
pub trait Transport: Send + Sync {
    type Connection: Connection + Send + Sync;
    type Listener: Listener<Connection = Self::Connection> + Send + Sync;

    async fn listen(&self, addr: SocketAddr) -> Result<Self::Listener>;
    async fn connect(&self, addr: SocketAddr) -> Result<Self::Connection>;
    async fn connect_timeout(&self, addr: SocketAddr, timeout: Duration) -> Result<Self::Connection>;
    
    fn transport_type(&self) -> TransportType;
    fn supports_multiplexing(&self) -> bool;
    fn supports_encryption(&self) -> bool;
}

#[async_trait::async_trait]
pub trait Connection: Send + Sync {
    async fn send(&mut self, data: &[u8]) -> Result<()>;
    async fn recv(&mut self) -> Result<Vec<u8>>;
    async fn send_block(&mut self, block: &Block<impl BlockPayload>) -> Result<()>;
    async fn recv_block(&mut self) -> Result<Block<serde_json::Value>>;
    
    async fn close(&mut self) -> Result<()>;
    fn peer_addr(&self) -> Result<SocketAddr>;
    fn local_addr(&self) -> Result<SocketAddr>;
    fn connection_id(&self) -> ConnectionId;
}

#[async_trait::async_trait]
pub trait Listener: Send + Sync {
    type Connection: Connection + Send + Sync;
    
    async fn accept(&mut self) -> Result<Self::Connection>;
    async fn local_addr(&self) -> Result<SocketAddr>;
    async fn close(&mut self) -> Result<()>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransportType {
    TCP,
    UDP,
    QUIC,
    WebSocket,
    WebRTC,
}
```

## TCP Transport

TCP provides reliable, ordered, connection-oriented communication:

### Implementation

```rust
use olocus_network::transport::tcp::*;

#[derive(Debug)]
pub struct TcpTransport {
    config: TcpConfig,
}

impl TcpTransport {
    pub fn new(config: TcpConfig) -> Self {
        Self { config }
    }
}

#[derive(Debug, Clone)]
pub struct TcpConfig {
    pub keepalive: Option<Duration>,
    pub nodelay: bool,
    pub reuse_addr: bool,
    pub reuse_port: bool,
    pub ttl: Option<u32>,
}

impl Default for TcpConfig {
    fn default() -> Self {
        Self {
            keepalive: Some(Duration::from_secs(30)),
            nodelay: true,
            reuse_addr: true,
            reuse_port: false,
            ttl: None,
        }
    }
}

#[async_trait::async_trait]
impl Transport for TcpTransport {
    type Connection = TcpConnection;
    type Listener = TcpListener;

    async fn listen(&self, addr: SocketAddr) -> Result<Self::Listener> {
        let listener = tokio::net::TcpListener::bind(addr).await?;
        Ok(TcpListener::new(listener, self.config.clone()))
    }

    async fn connect(&self, addr: SocketAddr) -> Result<Self::Connection> {
        let stream = tokio::net::TcpStream::connect(addr).await?;
        self.configure_stream(&stream)?;
        Ok(TcpConnection::new(stream))
    }

    fn transport_type(&self) -> TransportType {
        TransportType::TCP
    }

    fn supports_multiplexing(&self) -> bool {
        false
    }

    fn supports_encryption(&self) -> bool {
        false // Encryption handled at application layer
    }
}
```

### Usage Example

```rust
use olocus_network::transport::tcp::*;

let config = TcpConfig {
    keepalive: Some(Duration::from_secs(60)),
    nodelay: true,
    reuse_addr: true,
    reuse_port: false,
    ttl: Some(64),
};

let transport = TcpTransport::new(config);

// Server
let mut listener = transport.listen("127.0.0.1:8080".parse()?).await?;
tokio::spawn(async move {
    while let Ok(mut connection) = listener.accept().await {
        tokio::spawn(async move {
            while let Ok(block) = connection.recv_block().await {
                // Process received block
                println!("Received block: {}", block.index);
            }
        });
    }
});

// Client
let mut connection = transport.connect("127.0.0.1:8080".parse()?).await?;
connection.send_block(&my_block).await?;
```

## UDP Transport

UDP provides fast, connectionless communication for high-throughput scenarios:

### Implementation

```rust
use olocus_network::transport::udp::*;

#[derive(Debug)]
pub struct UdpTransport {
    config: UdpConfig,
}

#[derive(Debug, Clone)]
pub struct UdpConfig {
    pub max_packet_size: usize,
    pub reuse_addr: bool,
    pub reuse_port: bool,
    pub multicast_ttl: Option<u32>,
    pub broadcast: bool,
}

impl Default for UdpConfig {
    fn default() -> Self {
        Self {
            max_packet_size: 65507, // Max UDP payload
            reuse_addr: true,
            reuse_port: false,
            multicast_ttl: None,
            broadcast: false,
        }
    }
}

// UDP requires different semantics due to connectionless nature
#[async_trait::async_trait]
pub trait DatagramTransport: Send + Sync {
    async fn bind(&self, addr: SocketAddr) -> Result<UdpSocket>;
    async fn send_to(&self, socket: &UdpSocket, data: &[u8], addr: SocketAddr) -> Result<()>;
    async fn recv_from(&self, socket: &UdpSocket) -> Result<(Vec<u8>, SocketAddr)>;
}

#[derive(Debug)]
pub struct UdpSocket {
    socket: tokio::net::UdpSocket,
    config: UdpConfig,
}

impl UdpSocket {
    pub async fn send_block_to(&self, block: &Block<impl BlockPayload>, addr: SocketAddr) -> Result<()> {
        let data = block.to_wire_format(WireFormat::default())?;
        if data.len() > self.config.max_packet_size {
            return Err(NetworkError::PacketTooLarge(data.len()));
        }
        self.socket.send_to(&data, addr).await?;
        Ok(())
    }

    pub async fn recv_block_from(&self) -> Result<(Block<serde_json::Value>, SocketAddr)> {
        let mut buffer = vec![0; self.config.max_packet_size];
        let (len, addr) = self.socket.recv_from(&mut buffer).await?;
        buffer.truncate(len);
        
        let block = Block::from_wire_format(&buffer, WireFormat::default())?;
        Ok((block, addr))
    }
}
```

### Usage Example

```rust
use olocus_network::transport::udp::*;

let config = UdpConfig {
    max_packet_size: 32768, // 32KB
    reuse_addr: true,
    broadcast: true,
    ..Default::default()
};

let transport = UdpTransport::new(config);

// Server
let socket = transport.bind("127.0.0.1:8080".parse()?).await?;
tokio::spawn(async move {
    loop {
        match socket.recv_block_from().await {
            Ok((block, peer_addr)) => {
                println!("Received block {} from {}", block.index, peer_addr);
                // Send acknowledgment
                let ack_block = create_ack_block(&block);
                socket.send_block_to(&ack_block, peer_addr).await?;
            }
            Err(e) => eprintln!("UDP receive error: {}", e),
        }
    }
});

// Client  
let socket = transport.bind("0.0.0.0:0".parse()?).await?;
socket.send_block_to(&my_block, "127.0.0.1:8080".parse()?).await?;
```

## QUIC Transport

QUIC provides modern multiplexed transport with built-in encryption and stream management:

### Implementation

```rust
use olocus_network::transport::quic::*;
use quinn::*;

#[derive(Debug)]
pub struct QuicTransport {
    config: QuicConfig,
}

#[derive(Debug, Clone)]
pub struct QuicConfig {
    pub max_concurrent_streams: u32,
    pub keep_alive_interval: Option<Duration>,
    pub max_idle_timeout: Duration,
    pub initial_max_data: u32,
    pub initial_max_stream_data: u32,
    pub cert_chain: Option<Vec<u8>>,
    pub private_key: Option<Vec<u8>>,
}

impl Default for QuicConfig {
    fn default() -> Self {
        Self {
            max_concurrent_streams: 100,
            keep_alive_interval: Some(Duration::from_secs(30)),
            max_idle_timeout: Duration::from_secs(300),
            initial_max_data: 1024 * 1024 * 10, // 10MB
            initial_max_stream_data: 1024 * 1024, // 1MB
            cert_chain: None,
            private_key: None,
        }
    }
}

pub struct QuicConnection {
    connection: Connection,
    config: QuicConfig,
}

impl QuicConnection {
    pub async fn open_stream(&self) -> Result<QuicStream> {
        let (send, recv) = self.connection.open_bi().await?;
        Ok(QuicStream::new(send, recv))
    }

    pub async fn accept_stream(&self) -> Result<QuicStream> {
        let (send, recv) = self.connection.accept_bi().await?;
        Ok(QuicStream::new(send, recv))
    }
}

pub struct QuicStream {
    send: SendStream,
    recv: RecvStream,
}

impl QuicStream {
    pub async fn send_block(&mut self, block: &Block<impl BlockPayload>) -> Result<()> {
        let data = block.to_wire_format(WireFormat::default())?;
        let length = (data.len() as u32).to_be_bytes();
        
        self.send.write_all(&length).await?;
        self.send.write_all(&data).await?;
        self.send.finish().await?;
        Ok(())
    }

    pub async fn recv_block(&mut self) -> Result<Block<serde_json::Value>> {
        let mut length_bytes = [0u8; 4];
        self.recv.read_exact(&mut length_bytes).await?;
        let length = u32::from_be_bytes(length_bytes) as usize;
        
        let mut data = vec![0u8; length];
        self.recv.read_exact(&mut data).await?;
        
        let block = Block::from_wire_format(&data, WireFormat::default())?;
        Ok(block)
    }
}
```

### Usage Example

```rust
use olocus_network::transport::quic::*;

let config = QuicConfig {
    max_concurrent_streams: 200,
    keep_alive_interval: Some(Duration::from_secs(60)),
    max_idle_timeout: Duration::from_secs(600),
    cert_chain: Some(load_cert_chain("server.crt")?),
    private_key: Some(load_private_key("server.key")?),
    ..Default::default()
};

let transport = QuicTransport::new(config);

// Server
let mut listener = transport.listen("127.0.0.1:8443".parse()?).await?;
tokio::spawn(async move {
    while let Ok(connection) = listener.accept().await {
        tokio::spawn(async move {
            while let Ok(mut stream) = connection.accept_stream().await {
                tokio::spawn(async move {
                    while let Ok(block) = stream.recv_block().await {
                        println!("Received block: {}", block.index);
                        // Send response on same stream
                        let response = create_response_block(&block);
                        stream.send_block(&response).await?;
                    }
                });
            }
        });
    }
});

// Client
let connection = transport.connect("127.0.0.1:8443".parse()?).await?;
let mut stream = connection.open_stream().await?;
stream.send_block(&my_block).await?;
let response = stream.recv_block().await?;
```

## WebSocket Transport

WebSocket provides browser-compatible bidirectional communication:

### Implementation

```rust
use olocus_network::transport::websocket::*;
use tokio_tungstenite::*;

#[derive(Debug)]
pub struct WebSocketTransport {
    config: WebSocketConfig,
}

#[derive(Debug, Clone)]
pub struct WebSocketConfig {
    pub max_frame_size: usize,
    pub max_message_size: usize,
    pub compression: bool,
    pub subprotocol: Option<String>,
}

impl Default for WebSocketConfig {
    fn default() -> Self {
        Self {
            max_frame_size: 16 * 1024 * 1024, // 16MB
            max_message_size: 64 * 1024 * 1024, // 64MB
            compression: true,
            subprotocol: Some("olocus-v1".to_string()),
        }
    }
}

pub struct WebSocketConnection {
    ws_stream: WebSocketStream<tokio::net::TcpStream>,
    config: WebSocketConfig,
}

impl WebSocketConnection {
    pub async fn send_block(&mut self, block: &Block<impl BlockPayload>) -> Result<()> {
        let data = block.to_wire_format(WireFormat::json())?;
        let message = Message::Text(String::from_utf8(data)?);
        self.ws_stream.send(message).await?;
        Ok(())
    }

    pub async fn recv_block(&mut self) -> Result<Block<serde_json::Value>> {
        loop {
            match self.ws_stream.next().await {
                Some(Ok(Message::Text(text))) => {
                    let block = Block::from_wire_format(text.as_bytes(), WireFormat::json())?;
                    return Ok(block);
                }
                Some(Ok(Message::Binary(data))) => {
                    let block = Block::from_wire_format(&data, WireFormat::default())?;
                    return Ok(block);
                }
                Some(Ok(Message::Ping(data))) => {
                    self.ws_stream.send(Message::Pong(data)).await?;
                }
                Some(Ok(Message::Pong(_))) => {
                    // Ignore pong messages
                }
                Some(Ok(Message::Close(_))) => {
                    return Err(NetworkError::ConnectionClosed);
                }
                Some(Err(e)) => return Err(NetworkError::WebSocket(e)),
                None => return Err(NetworkError::ConnectionClosed),
            }
        }
    }
}
```

### Usage Example

```rust
use olocus_network::transport::websocket::*;

let config = WebSocketConfig {
    max_message_size: 32 * 1024 * 1024, // 32MB
    compression: true,
    subprotocol: Some("olocus-v1".to_string()),
    ..Default::default()
};

// Server
let transport = WebSocketTransport::new(config.clone());
let listener = transport.listen("127.0.0.1:8080".parse()?).await?;

tokio::spawn(async move {
    while let Ok(mut connection) = listener.accept().await {
        tokio::spawn(async move {
            while let Ok(block) = connection.recv_block().await {
                println!("WebSocket received block: {}", block.index);
                // Echo block back
                connection.send_block(&block).await?;
            }
        });
    }
});

// Client (can be used from browser JavaScript)
let connection = transport.connect("ws://127.0.0.1:8080".parse()?).await?;
connection.send_block(&my_block).await?;
```

## WebRTC Transport

WebRTC provides peer-to-peer transport with NAT traversal:

### Implementation

```rust
use olocus_network::transport::webrtc::*;

#[derive(Debug)]
pub struct WebRtcTransport {
    config: WebRtcConfig,
}

#[derive(Debug, Clone)]
pub struct WebRtcConfig {
    pub ice_servers: Vec<IceServer>,
    pub max_message_size: usize,
    pub ordered: bool,
    pub max_retransmits: Option<u16>,
    pub max_packet_lifetime: Option<Duration>,
}

#[derive(Debug, Clone)]
pub struct IceServer {
    pub urls: Vec<String>,
    pub username: Option<String>,
    pub credential: Option<String>,
}

impl Default for WebRtcConfig {
    fn default() -> Self {
        Self {
            ice_servers: vec![
                IceServer {
                    urls: vec!["stun:stun.l.google.com:19302".to_string()],
                    username: None,
                    credential: None,
                },
            ],
            max_message_size: 16 * 1024, // 16KB (WebRTC limit)
            ordered: true,
            max_retransmits: Some(3),
            max_packet_lifetime: Some(Duration::from_secs(3)),
        }
    }
}

pub struct WebRtcConnection {
    data_channel: Arc<DataChannel>,
    peer_connection: Arc<PeerConnection>,
    config: WebRtcConfig,
}

impl WebRtcConnection {
    pub async fn send_block(&self, block: &Block<impl BlockPayload>) -> Result<()> {
        let data = block.to_wire_format(WireFormat::messagepack())?;
        
        // Fragment large blocks
        const CHUNK_SIZE: usize = 15 * 1024; // Leave room for headers
        if data.len() > CHUNK_SIZE {
            let chunks = data.chunks(CHUNK_SIZE);
            let total_chunks = chunks.len();
            
            for (i, chunk) in chunks.enumerate() {
                let fragment = BlockFragment {
                    block_hash: block.hash()?,
                    fragment_id: i as u16,
                    total_fragments: total_chunks as u16,
                    data: chunk.to_vec(),
                };
                
                let fragment_data = bincode::serialize(&fragment)?;
                self.data_channel.send(&fragment_data)?;
            }
        } else {
            self.data_channel.send(&data)?;
        }
        
        Ok(())
    }
    
    pub async fn create_offer(&self) -> Result<SessionDescription> {
        let offer = self.peer_connection.create_offer().await?;
        self.peer_connection.set_local_description(offer.clone()).await?;
        Ok(offer)
    }
    
    pub async fn create_answer(&self, offer: &SessionDescription) -> Result<SessionDescription> {
        self.peer_connection.set_remote_description(offer.clone()).await?;
        let answer = self.peer_connection.create_answer().await?;
        self.peer_connection.set_local_description(answer.clone()).await?;
        Ok(answer)
    }
}
```

### Usage Example

```rust
use olocus_network::transport::webrtc::*;

let config = WebRtcConfig {
    ice_servers: vec![
        IceServer {
            urls: vec![
                "stun:stun.l.google.com:19302".to_string(),
                "turn:myturnserver.com:3478".to_string(),
            ],
            username: Some("user".to_string()),
            credential: Some("password".to_string()),
        },
    ],
    max_message_size: 15 * 1024, // 15KB
    ordered: true,
    ..Default::default()
};

// Peer A (Initiator)
let transport_a = WebRtcTransport::new(config.clone());
let connection_a = transport_a.create_connection().await?;
let offer = connection_a.create_offer().await?;

// Send offer to Peer B via signaling server
send_via_signaling_server(offer).await?;

// Peer B (Responder) 
let transport_b = WebRtcTransport::new(config);
let connection_b = transport_b.create_connection().await?;
let answer = connection_b.create_answer(&offer).await?;

// Send answer back to Peer A
send_via_signaling_server(answer).await?;

// After ICE gathering completes, can send blocks
connection_a.send_block(&my_block).await?;
```

## Performance Characteristics

| Transport | Latency | Throughput | CPU Usage | Memory | Use Case |
|-----------|---------|------------|-----------|---------|----------|
| TCP       | Low     | High       | Low       | Low     | Reliable bulk transfer |
| UDP       | Lowest  | Highest    | Lowest    | Lowest  | Real-time, loss-tolerant |
| QUIC      | Low     | High       | Medium    | Medium  | Modern web applications |
| WebSocket | Medium  | Medium     | Medium    | Medium  | Browser compatibility |
| WebRTC    | Medium  | Low        | High      | High    | P2P, NAT traversal |

## Configuration Best Practices

### Production TCP Settings

```rust
let tcp_config = TcpConfig {
    keepalive: Some(Duration::from_secs(60)),
    nodelay: true,          // Disable Nagle's algorithm
    reuse_addr: true,       // Allow port reuse
    reuse_port: false,      // Avoid in production
    ttl: Some(64),          // Standard Internet TTL
};
```

### High-Performance UDP Settings

```rust
let udp_config = UdpConfig {
    max_packet_size: 1400,  // Avoid IP fragmentation
    reuse_addr: true,
    broadcast: false,       // Disable unless needed
    multicast_ttl: None,    // Only set for multicast
};
```

### Enterprise QUIC Settings

```rust
let quic_config = QuicConfig {
    max_concurrent_streams: 1000,
    keep_alive_interval: Some(Duration::from_secs(30)),
    max_idle_timeout: Duration::from_secs(120),
    initial_max_data: 1024 * 1024 * 100,      // 100MB
    initial_max_stream_data: 1024 * 1024 * 10, // 10MB
    cert_chain: Some(load_production_cert()?),
    private_key: Some(load_production_key()?),
};
```

## Error Handling

```rust
use olocus_network::transport::error::*;

#[derive(Debug, thiserror::Error)]
pub enum NetworkError {
    #[error("Connection timeout")]
    Timeout,
    
    #[error("Connection closed by peer")]
    ConnectionClosed,
    
    #[error("Invalid address: {0}")]
    InvalidAddress(String),
    
    #[error("Packet too large: {0} bytes")]
    PacketTooLarge(usize),
    
    #[error("TLS error: {0}")]
    Tls(#[from] rustls::Error),
    
    #[error("WebSocket error: {0}")]
    WebSocket(#[from] tokio_tungstenite::tungstenite::Error),
    
    #[error("QUIC error: {0}")]
    Quic(#[from] quinn::ConnectionError),
    
    #[error("WebRTC error: {0}")]
    WebRtc(String),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] bincode::Error),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}
```

## Transport Selection Guidelines

Choose the appropriate transport based on your requirements:

1. **TCP**: Default choice for reliable communication
2. **UDP**: Real-time applications, broadcasting, multicasting
3. **QUIC**: Modern applications requiring multiplexing and performance
4. **WebSocket**: Browser-based applications, long-lived connections
5. **WebRTC**: Peer-to-peer communication, NAT traversal required

Each transport can be configured independently and used with the same high-level Olocus Protocol APIs.