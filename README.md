# Easy Kafka Accessor

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)

# One function = Kafka consumer + producer + auto-discovery

Automatically discover Kafka topics and process messages with zero configuration. **Supports keep waiting until getting a message from the queue** for reliable message processing.

## 🚀 Quick Start

### 1. Install
```bash
npm install easy-kafka-accessor
```

### 2. Create processor
```javascript
// processors/user-events.js
const { KafkaTopicProcessor } = require('easy-kafka-accessor');

class UserEventsProcessor extends KafkaTopicProcessor {
  async processMessage(message, metadata) {
    console.log('Processing:', message);
    return { processed: true };
  }
}

module.exports = UserEventsProcessor;
```

### 3. Start
```bash
npm start
```

**Done!** System automatically discovers `user-events.js` → subscribes to `user-events` topic → starts processing messages.

## ✨ How It Works

**Filename = Topic Name**
```
processors/user-events.js → Topic: "user-events"
processors/orders.js      → Topic: "orders"
processors/logs.js        → Topic: "logs"
```

**Zero Configuration**
- No manual topic setup
- No manual subscription  
- Just create processor files
- **Automatic message waiting** - keeps listening until messages arrive

## 🔧 Usage

```javascript
const { KafkaAccessor } = require('easy-kafka-accessor');

const kafka = new KafkaAccessor();

// Start consumer (auto-discovers all processors)
await kafka.startConsumer();

// Send messages
await kafka.sendMessage('user-events', { userId: 123, action: 'login' });

// Get message from specific topic with keep waiting
const message = await kafka.getMessageFromTopic('user-events');
```

## 📁 Processor Rules

1. **Extend `KafkaTopicProcessor`**
2. **Implement `processMessage(message, metadata)`**
3. **That's it!** Topic auto-detected from filename

## ⚙️ Config

Create a `.env` file in your project root:
```bash
KAFKA_BROKERS=kafka:9092
KAFKA_CLIENT_ID=my-app
KAFKA_GROUP_ID=my-group
```

**Note**: Configuration is automatically loaded from `.env` file - no need to set environment variables in command line.

## 🔧 Troubleshooting

### Common Warnings

**KafkaJS Partitioner Warning:**
```bash
# Add to your .env file to suppress
KAFKAJS_NO_PARTITIONER_WARNING=1
```

**Negative Timeout Warning:**
- Check your timeout configurations
- Ensure all timeout values are positive numbers

## 📄 License

MIT License

---

**Write one function → Get Kafka consumer + producer + topic management** 🚀

