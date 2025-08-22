# Kafka Accessor

A scalable, production-ready Kafka accessor built with Node.js, packaged as an RPM for easy deployment on RHEL/CentOS/Fedora systems.

## 📋 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [Architecture](#-architecture)
- [Message Processing](#-message-processing)
- [API Reference](#-api-reference)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

- **RPM Package**: Easy installation and management on RPM-based systems
- **Systemd Integration**: Producer and consumer services with systemd
- **Separate Producer & Consumer Services**: Can be deployed independently for better scalability
- **Message Processing**: Built-in processor registry with custom message processors
- **JSON Payload Support**: Native JSON message handling
- **Graceful Shutdown**: Proper signal handling for service management
- **Health Monitoring**: Built-in health checks and status reporting
- **Comprehensive Logging**: Winston-based logging with structured output
- **Error Handling**: Robust error handling with retry mechanisms
- **CLI Interface**: Command-line interface for easy management

## 🚀 Quick Start

### Prerequisites
- Node.js >= 16.0.0
- Kafka cluster running and accessible
- RPM-based system (RHEL/CentOS/Fedora)

### Install and Run
```bash
# Install the RPM package
sudo dnf install kafka-accessor-1.0.0-1.noarch.rpm

# Start consumer service
sudo systemctl enable --now kafka-accessor-consumer

# Start producer service  
sudo systemctl enable --now kafka-accessor-producer

# Check status
sudo systemctl status kafka-accessor-*
```

### Test the Installation
```bash
# Test CLI
kafka-accessor --help
kafka-accessor --version

# Test processor
node -e "const p = require('/usr/share/kafka-accessor/processors/system-logs'); console.log('✅ Loaded:', p.name);"
```

## 📦 Installation

### From RPM Package

```bash
# Install the RPM package
sudo dnf install kafka-accessor-1.0.0-1.noarch.rpm

# Or using rpm command
sudo rpm -ivh kafka-accessor-1.0.0-1.noarch.rpm
```

### Building from Source

```bash
# Install build dependencies
sudo dnf install nodejs npm rpm-build

# Clone and build
git clone <repository-url>
cd kafka-accessor
make build-rpm

# Install the built package
make install-rpm
```

## ⚙️ Configuration

### Configuration File

Edit the configuration file at `/etc/kafka-accessor/kafka.env`:

```bash
# Kafka Configuration for Production Deployment
# This file will be installed to /etc/kafka-accessor/kafka.env

# Kafka brokers - comma-separated list of Kafka broker addresses
KAFKA_BROKERS=localhost:9092

# Client configuration
KAFKA_CLIENT_ID=kafka-accessor
KAFKA_GROUP_ID=kafka-accessor-group

# Producer configuration
PRODUCER_ACKS=1
PRODUCER_TIMEOUT=30000
PRODUCER_RETRY_ATTEMPTS=3

# Consumer configuration
CONSUMER_SESSION_TIMEOUT=30000
CONSUMER_HEARTBEAT_INTERVAL=3000
CONSUMER_MAX_BYTES=1048576

# Logging
LOG_LEVEL=info

# Security (uncomment and configure as needed)
# KAFKA_SASL_MECHANISM=PLAIN
# KAFKA_USERNAME=your-username
# KAFKA_PASSWORD=your-password
# KAFKA_SSL_ENABLED=true
```

### Environment Variables

You can override configuration using environment variables:

```bash
# Override Kafka brokers
export KAFKA_BROKERS=kafka1:9092,kafka2:9092

# Override client ID
export KAFKA_CLIENT_ID=my-custom-client

# Start services
kafka-accessor consumer
```

## 🎯 Usage

### Command Line Interface

```bash
# Basic service management
kafka-accessor producer                    # Start producer only
kafka-accessor consumer                    # Start consumer with default topic
kafka-accessor consumer --topics logs     # Start consumer with custom topic
kafka-accessor both                       # Start both services

# Help and information
kafka-accessor --help                     # Show main help
kafka-accessor --version                  # Show version
kafka-accessor consumer --help            # Show consumer help
kafka-accessor producer --help            # Show producer help

# Topic examples
kafka-accessor consumer --topics system-logs,logs,system
kafka-accessor consumer --topics app-logs,error-logs
kafka-accessor consumer --topics web-server,api-server
```

### Systemd Services

```bash
# Enable and start producer service
sudo systemctl enable kafka-accessor-producer
sudo systemctl start kafka-accessor-producer

# Enable and start consumer service
sudo systemctl enable kafka-accessor-consumer
sudo systemctl start kafka-accessor-consumer

# Check service status
sudo systemctl status kafka-accessor-producer
sudo systemctl status kafka-accessor-consumer

# View logs
sudo journalctl -u kafka-accessor-producer -f
sudo journalctl -u kafka-accessor-consumer -f
```

### Producing Messages

#### Basic Message Production

```bash
# Start the producer service
kafka-accessor producer

# The producer will be ready to send messages programmatically
# You can also use the KafkaAccessor class in your own scripts
```

#### Programmatic Message Production

```javascript
const KafkaAccessor = require('./src/kafka-accessor');

const kafka = new KafkaAccessor({
  brokers: 'localhost:9092',
  clientId: 'my-producer'
});

// Initialize producer
await kafka.initProducer();

// Send a single message
await kafka.sendMessage('system-logs', {
  level: 'info',
  service: 'web-server',
  message: 'Server started successfully',
  timestamp: new Date().toISOString(),
  hostname: 'web-01'
});

// Send batch messages
const messages = [
  { level: 'info', service: 'db', message: 'Database connected' },
  { level: 'warn', service: 'cache', message: 'Cache miss rate high' },
  { level: 'error', service: 'api', message: 'Rate limit exceeded' }
];

for (const msg of messages) {
  await kafka.sendMessage('system-logs', {
    ...msg,
    timestamp: new Date().toISOString(),
    hostname: 'web-01'
  });
}
```

### Consuming Messages

#### Start Consumer Service

```bash
# Consume from default topic (system-logs)
kafka-accessor consumer

# Consume from specific topics
kafka-accessor consumer --topics system-logs,logs,system

# Consume from multiple topics with custom names
kafka-accessor consumer --topics app-logs,error-logs,audit-logs
```

#### Message Processing

When messages arrive, the SystemLogsProcessor automatically:

1. **Extracts metadata** (topic, partition, offset)
2. **Formats the message** for easy reading
3. **Prints to console** with clear formatting
4. **Returns processing result**

#### Example Message Output

```
📋 System Log Message:
  Topic: system-logs
  Partition: 0
  Offset: 123
  Message: {
  "level": "error",
  "service": "database",
  "message": "Connection timeout",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "hostname": "db-01"
}
---
```

#### Expected Message Format

For best results, send messages in this format:

```json
{
  "level": "info|warn|error|debug",
  "service": "service-name",
  "message": "Human readable message",
  "timestamp": "ISO-8601 timestamp",
  "hostname": "server-hostname",
  "additional": "any other fields you want"
}
```

### Testing Producer and Consumer Together

Here's how to test the complete flow:

#### 1. Start the Consumer Service

```bash
# Terminal 1: Start consumer
kafka-accessor consumer --topics system-logs
```

#### 2. Start the Producer Service

```bash
# Terminal 2: Start producer
kafka-accessor producer
```

#### 3. Send Test Messages

In a third terminal or script, send test messages:

```bash
# Using kafka-console-producer (if you have Kafka tools installed)
echo '{"level":"info","service":"test","message":"Hello World","timestamp":"2024-01-01T12:00:00.000Z"}' | \
  kafka-console-producer --broker-list localhost:9092 --topic system-logs

# Or using the Node.js example above
node -e "
const KafkaAccessor = require('./src/kafka-accessor');
const kafka = new KafkaAccessor({brokers:'localhost:9092',clientId:'test'});
kafka.initProducer().then(() => {
  return kafka.sendMessage('system-logs', {
    level: 'info',
    service: 'test',
    message: 'Hello from command line!',
    timestamp: new Date().toISOString()
  });
}).then(() => console.log('Message sent!')).catch(console.error);
"
```

#### 4. Watch Messages Being Processed

In Terminal 1, you should see:

```
📋 System Log Message:
  Topic: system-logs
  Partition: 0
  Offset: 123
  Message: {
  "level": "info",
  "service": "test",
  "message": "Hello from command line!",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
---
```

### Running Both Services in One Command

You can also run producer and consumer together:

```bash
# Start both services
kafka-accessor both --topics system-logs

# This will start both producer and consumer in the same process
# Messages sent programmatically will be processed automatically
```

### Message Format Examples

Here are some example messages you can send to test the system:

#### Info Level Message
```json
{
  "level": "info",
  "service": "web-server",
  "message": "Server started on port 3000",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "hostname": "web-01",
  "port": 3000
}
```

#### Warning Level Message
```json
{
  "level": "warn",
  "service": "database",
  "message": "Connection pool at 80% capacity",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "hostname": "db-01",
  "poolSize": 80
}
```

#### Error Level Message
```json
{
  "level": "error",
  "service": "api",
  "message": "Failed to connect to external service",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "hostname": "api-01",
  "errorCode": "CONNECTION_TIMEOUT",
  "retryCount": 3
}
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Producer      │    │   Consumer      │
│   Instance      │    │   Instance      │
│                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │KafkaAccessor│ │    │ │KafkaAccessor│ │
│ │  Producer   │ │    │ │  Consumer   │ │
│ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘
         │                       │
         └───────────────────────┘
                    │
         ┌─────────────────────┐
         │     Kafka Cluster   │
         └─────────────────────┘
```

## 🔄 Message Processing

The system includes a dynamic processor registry and message processors for handling different types of Kafka messages.

### Processor Architecture

Processors are simple classes that handle messages from specific Kafka topics. Each processor extends `BaseProcessor` and implements a `processMessage(message, metadata)` method that receives a message and returns a processing result.

#### Processor Structure

Each processor follows this optimized structure by extending BaseProcessor:

```javascript
const BaseProcessor = require('../src/base-processor');

class ExampleProcessor extends BaseProcessor {
  async processMessage(message, metadata) {
    // Add your custom processing logic here
    
    // Return simple success result using helper method
    return this.createSuccessResult('Message processed successfully');
  }
}
```

#### BaseProcessor Features

The `BaseProcessor` class provides:

- **Automatic Logging**: Logs incoming messages and metadata automatically
- **Error Handling**: Built-in error handling with consistent error response format
- **Result Structure**: Ensures consistent result format with status and message
- **Helper Methods**: `createSuccessResult()` and `createErrorResult()` methods
- **Common Interface**: Standardized `process(topic, message, metadata)` method that calls your `processMessage(message, metadata)`

#### Available Processors

- **SystemLogsProcessor**: Simple processor that prints out system-level messages from `system-logs`, `logs`, or `system` topics
- **Custom Processors**: You can create additional processors by extending `BaseProcessor`

#### Processor Registry

The system includes a `ProcessorRegistry` class that manages dynamic registration, deregistration, and updates of topic processors:

```javascript
const ProcessorRegistry = require('./src/processor-registry');

const registry = new ProcessorRegistry();

// Register a processor for a topic
registry.registerProcessor('my-topic', new MyProcessor());

// Process messages using registered processors
const result = await registry.processMessage('my-topic', message, metadata);
```

**Registry Features:**
- **Dynamic Registration**: Add/remove processors at runtime
- **Version Management**: Track processor versions and updates
- **Event System**: Emit events for processor lifecycle changes
- **Statistics**: Monitor registry usage and performance
- **Validation**: Ensure processors have required methods

## 📚 API Reference

### KafkaAccessor

The core class that provides Kafka functionality.

#### Constructor

```javascript
new KafkaAccessor(config)
```

**Config Options:**
- `brokers`: Comma-separated list of Kafka brokers
- `clientId`: Unique client identifier
- `groupId`: Consumer group ID

#### Methods

- `initProducer()`: Initialize the Kafka producer
- `initConsumer()`: Initialize the Kafka consumer
- `sendMessage(topic, payload, options)`: Send a message to a topic
- `subscribeToTopic(topic, messageHandler, options)`: Subscribe to a topic
- `disconnect()`: Gracefully disconnect from Kafka
- `getHealthStatus()`: Get current health status

### KafkaProducer

Standalone producer instance.

#### Methods

- `init()`: Initialize the producer
- `sendMessage(topic, payload, options)`: Send a single message
- `sendBatch(topic, messages, options)`: Send multiple messages
- `getHealthStatus()`: Get producer health status
- `start()`: Start the producer service

### KafkaConsumer

Standalone consumer instance.

#### Methods

- `init()`: Initialize the consumer
- `subscribeToTopic(topic, messageHandler, options)`: Subscribe to a topic
- `subscribeToTopics(subscriptions)`: Subscribe to multiple topics
- `unsubscribeFromTopic(topic)`: Unsubscribe from a topic
- `getHealthStatus()`: Get consumer health status
- `start()`: Start the consumer service

## 🚀 Deployment

### RPM Package Deployment

The application is packaged as an RPM for easy deployment on RHEL/CentOS/Fedora systems.

#### Package Contents

- **Binary**: `/usr/bin/kafka-accessor`
- **Application**: `/usr/share/kafka-accessor/`
- **Configuration**: `/etc/kafka-accessor/kafka.env`
- **Services**: `/etc/systemd/system/kafka-accessor-*.service`
- **Logs**: `/var/log/kafka-accessor/`
- **Data**: `/var/lib/kafka-accessor/`

#### Service Management

```bash
# Enable services
sudo systemctl enable kafka-accessor-producer
sudo systemctl enable kafka-accessor-consumer

# Start services
sudo systemctl start kafka-accessor-producer
sudo systemctl start kafka-accessor-consumer

# Check status
sudo systemctl status kafka-accessor-*

# View logs
sudo journalctl -u kafka-accessor-producer -f
sudo journalctl -u kafka-accessor-consumer -f
```

### Scaling Considerations

#### Producer Scaling

- Producers are stateless and can be scaled horizontally
- Each producer instance gets a unique client ID
- Consider partitioning strategy for optimal performance

#### Consumer Scaling

- Consumers in the same group share the workload
- Each consumer processes messages from assigned partitions
- Scale based on message processing requirements

#### Partition Strategy

- Use message keys for consistent partitioning
- Consider the number of partitions when scaling consumers
- Monitor partition lag for optimal scaling

### Monitoring

#### Health Endpoints

- `/health`: Liveness probe endpoint
- `/ready`: Readiness probe endpoint
- `/metrics`: Prometheus metrics (if implemented)

#### Logging

Structured logging with Winston:

```json
{
  "level": "info",
  "message": "Message sent successfully",
  "topic": "my-topic",
  "partition": 0,
  "offset": "123",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "kafka-accessor"
}
```

## 🔧 Troubleshooting

### Common Issues and Solutions

**1. Connection Refused Errors**
```
Error: Connection error: ECONNREFUSED
```
**Solution**: Make sure Kafka is running and accessible at the configured broker address.

**2. Topic Not Found**
```
Error: Topic 'system-logs' not found
```
**Solution**: Create the topic first or use `kafka-accessor producer` to auto-create topics.

**3. Consumer Not Receiving Messages**
**Solution**: 
- Verify the consumer is subscribed to the correct topic
- Check that the producer is sending to the same topic
- Ensure both services are running

**4. Permission Denied**
```
Error: Permission denied
```
**Solution**: Check Kafka ACLs and ensure your client has read/write permissions.

### Testing Without Kafka

If you don't have Kafka running, you can test the CLI interface:

```bash
# Test CLI parsing (will fail to connect to Kafka, but CLI works)
kafka-accessor --help
kafka-accessor --version
kafka-accessor consumer --help

# Test processor loading
node -e "const p = require('./processors/system-logs'); console.log('✅ Processor loaded:', p.name);"
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

