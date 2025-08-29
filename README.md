# Easy Kafka Accessor

[![npm version](https://badge.fury.io/js/easy-kafka-accessor.svg)](https://badge.fury.io/js/easy-kafka-accessor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](https://nodejs.org/)

# One Function = Kafka Consumer + Producer + Auto-Discovery + Topic Management

> _Use file-based discovery instead of manual configuration_

---

---

# 🚀 **Quick Start (30 seconds)** 

## 1\. Install

```bash
npm install easy-kafka-accessor
```

## 2\. Create your first processor

```bash
mkdir -p processors/hello-world
```

```javascript
// processors/hello-world.js

const { KafkaTopicProcessor } = require('easy-kafka-accessor');

/**
 * @description Processes hello world messages from Kafka
 * @summary Hello world message processor
 */
class HelloWorldProcessor extends KafkaTopicProcessor {
  constructor() {
    super('hello-world');
  }

  async processMessage(message, metadata) {
    console.log('Hello World Message:', message);
    return { processed: true, message: 'Hello World!' };
  }
}

module.exports = HelloWorldProcessor;
```

## 3\. Start consumer

```bash
KAFKA_BROKERS=kafka:9092 npm start
```

## 🎉 That's it! You now have:

**✅ What You Get:**

* **Kafka Consumer**:  
   * **Topic**: `hello-world` (auto-discovered from filename)
   * **Auto-Subscription**: Automatically subscribes to all processor topics
   * **Message Processing**: Your `processMessage()` function handles all messages
* **Kafka Producer**:  
   * **Auto-Topic Creation**: Topics created automatically when sending messages
   * **Simple API**: `await kafka.sendMessage('topic', data)`
* **Topic Management**:  
   * **Auto-Discovery**: Scan `processors/` directory, find topics automatically
   * **Zero Configuration**: No manual topic setup required

**🎯 The Magic**: Write one function → Get Kafka consumer + producer + topic management for free!

# 🌟 **Key Features** 

* **🔍 Auto Discovery** - Scan `processors/` directory, find topics automatically
* **🤖 Instant Processing** - Your functions become Kafka message processors in real-time
* **📚 Zero Configuration** - Works out of the box, no setup required
* **⚡ Hot Reloading** - Save file = instant topic discovery and subscription
* **🛡️ Built-in Error Handling** - Automatic retry logic and error management

# 📁 **File-Based Topic Discovery** 

**All Kafka topics are auto-discovered!** Just create the corresponding processor file:

| File Name           | Kafka Topic | Example Usage                    |
| ------------------- | ----------- | -------------------------------- |
| `processors/user-events.js` | `user-events` | Process user activity messages |
| `processors/orders.js`      | `orders`      | Process order updates          |
| `processors/logs.js`        | `logs`        | Process system logs            |
| `processors/krumbit.js`     | `krumbit`     | Process krumbit messages       |

**💡 Pro Tip**: You can create multiple processors for different topics. Each processor automatically handles its corresponding topic. The framework automatically detects and subscribes to each topic!

# 🔍 **What Are Kafka Processors?** 

## **🤖 Kafka Topic Processors**

Kafka processors automatically handle messages from specific topics. When you create a processor file, it automatically becomes a message handler for that topic.

**How It Works:**

* **File Discovery**: System scans `processors/` directory
* **Topic Mapping**: Filename `krumbit.js` → Topic `krumbit`
* **Auto-Subscription**: Automatically subscribes to discovered topics
* **Message Processing**: Your `processMessage()` function handles all messages

**Benefits:**

* **Zero Configuration** - No manual topic subscription needed
* **Instant Processing** - Messages start flowing immediately
* **Automatic Scaling** - Add/remove topics by adding/removing files

## **📚 Built-in Features**

* **Error Handling** - Automatic retry logic and error logging
* **Message Metadata** - Access to partition, offset, timestamp, and headers
* **Logging** - Built-in Winston logger for each processor
* **Health Monitoring** - Built-in health checks and status monitoring

# 🎯 **Use Cases & Applications** 

* **Message Processing** - Process Kafka messages with zero configuration
* **Event Streaming** - Handle real-time events from multiple topics
* **Data Pipelines** - Build data processing pipelines automatically
* **Microservices** - Create lightweight, focused message processors
* **Real-time Analytics** - Process streaming data in real-time

---

# 💡 **Pro Tips** 

## **Using JSDoc Annotations**

```javascript
/**
 * @description Processes user registration events
 * @summary User registration processor
 */
class UserRegistrationProcessor extends KafkaTopicProcessor {
  constructor() {
    super('user-registration');
  }

  async processMessage(message, metadata) {
    // Your logic here
  }
}
```

## **Custom Message Processing**

```javascript
async processMessage(message, metadata) {
  // Access message metadata
  const { topic, partition, offset, timestamp, key } = metadata;
  
  // Process the message
  const result = await this.processUserRegistration(message);
  
  // Return processing result
  return {
    processed: true,
    userId: message.userId,
    timestamp: new Date().toISOString()
  };
}
```

---

# 🚀 **Advanced Usage** 

## **Programmatic Usage**

```javascript
const { KafkaAccessor } = require('easy-kafka-accessor');

const kafka = new KafkaAccessor();

// Start consumer (auto-discovers all processor topics)
await kafka.startConsumer();

// Send messages (auto-creates topics if not exist)
await kafka.sendMessage('user-events', {
  userId: 123,
  action: 'login',
  timestamp: new Date().toISOString()
});

// Check topic existence
const exists = await kafka.topicExists('my-topic');

// Create topic manually
await kafka.createTopic('my-topic', {
  numPartitions: 3,
  replicationFactor: 1
});
```

## **Environment Configuration**

```bash
# Kafka Configuration
KAFKA_BROKERS=kafka:9092
KAFKA_CLIENT_ID=easy-kafka-accessor
KAFKA_GROUP_ID=easy-kafka-accessor-group

# Logging
LOG_LEVEL=info

# Processor Registry
PROCESSORS_DIR=./processors
PROCESSORS_AUTO_REFRESH=true
PROCESSORS_REFRESH_INTERVAL=5000
```

---

# 🐳 **Docker Support**

## **Quick Docker Deployment**

```bash
# Build the Docker image
docker build -t easy-kafka-accessor:latest .

# Run with custom processors
docker run -d --name easy-kafka-accessor \
  -e KAFKA_BROKERS=kafka:9092 \
  -v /path/to/your/processors:/processors \
  easy-kafka-accessor:latest
```

## **Docker Features**

- ✅ **Lightweight**: Based on Node.js 18 Alpine
- ✅ **Easy Deployment**: Install from npm, no source code copying
- ✅ **Custom Processors**: Mount your processors directory at `/processors`
- ✅ **Environment Config**: All Kafka settings via environment variables
- ✅ **Production Ready**: Optimized for containerized deployments

---

# 🧪 **Testing** 

```bash
npm test
```

## **Test Coverage**

- ✅ **Unit Tests**: All core functionality tested
- ✅ **Integration Tests**: Kafka client integration tested
- ✅ **Processor Tests**: Topic processor functionality tested
- ✅ **Error Handling**: Error scenarios and edge cases tested

---

# 📄 **License** 

MIT License - see LICENSE file for details.

---

**🎯 The Future of Kafka Development: Write Once, Deploy Everywhere**  
**One function = Kafka Consumer + Producer + Topic Management** 🚀✨

---

**📦 Package Version**: This project uses automated patch releases only. Every commit triggers a new patch version automatically.

## Keywords

* kafka
* message-processing
* streaming
* auto-discovery
* nodejs
* microservices
* event-driven
* real-time

## Package Sidebar

### Install

`npm i easy-kafka-accessor`

### Repository

[github.com/easynet-world/7132-easy-kafka-accessor](https://github.com/easynet-world/7132-easy-kafka-accessor)

### Homepage

[github.com/easynet-world/7132-easy-kafka-accessor#readme](https://github.com/easynet-world/7132-easy-kafka-accessor#readme)

**Fund** this package

### Downloads

Weekly Downloads

### Version

1.0.17

### License

MIT

### Unpacked Size

80.1 kB

### Total Files

25

### Last publish

Recently

### Collaborators

* boqiang.liang

**Try** on RunKit

**Report** malware

