# Docker Usage Example

This example shows how to deploy easy-kafka-accessor using Docker with custom processors.

## 🚀 Quick Start

### 1. Build the Image
```bash
# From the project root
docker build -t easy-kafka-accessor:latest .
```

### 2. Create Custom Processors
Create your processor files in a local directory:

```bash
mkdir -p my-processors
```

**Example processor: `my-processors/user-events.js`**
```javascript
const { KafkaTopicProcessor } = require('easy-kafka-accessor');

class UserEventsProcessor extends KafkaTopicProcessor {
  async processMessage(message, metadata) {
    console.log('Processing user event:', message);
    
    // Your processing logic here
    const result = await this.processUserEvent(message);
    
    return { processed: true, result };
  }
  
  async processUserEvent(message) {
    // Custom business logic
    return { userId: message.userId, action: message.action };
  }
}

module.exports = UserEventsProcessor;
```

### 3. Run with Docker
```bash
docker run -d --name easy-kafka-accessor \
  -e KAFKA_BROKERS=your-kafka-server:9092 \
  -e KAFKA_CLIENT_ID=my-app \
  -e KAFKA_GROUP_ID=my-group \
  -v $(pwd)/my-processors:/processors \
  easy-kafka-accessor:latest
```

## 🔧 Configuration Options

### Environment Variables
- `KAFKA_BROKERS`: Your Kafka broker addresses
- `KAFKA_CLIENT_ID`: Unique client identifier
- `KAFKA_GROUP_ID`: Consumer group ID
- `LOG_LEVEL`: Logging level (debug, info, warn, error)

### Volume Mounts
- **Processors**: Mount your custom processors directory to `/processors`
- **Environment**: Optionally mount a `.env` file

## 📁 Directory Structure
```
my-processors/
├── user-events.js      # Processes 'user-events' topic
├── order-updates.js    # Processes 'order-updates' topic
└── notifications.js    # Processes 'notifications' topic
```

## 🐳 Docker Commands

### View Logs
```bash
docker logs easy-kafka-accessor
```

### Stop Container
```bash
docker stop easy-kafka-accessor
```

### Remove Container
```bash
docker rm easy-kafka-accessor
```

### Interactive Shell
```bash
docker exec -it easy-kafka-accessor sh
```

## ✅ Benefits of This Approach

1. **No Source Code Copying**: Package is installed from npm
2. **Easy Updates**: Just rebuild the image to get latest version
3. **Custom Processors**: Mount your own processor directory
4. **Environment Isolation**: Clean, reproducible deployments
5. **Production Ready**: Optimized for containerized environments
