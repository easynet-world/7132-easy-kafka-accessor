# Easy Kafka Accessor

> **Kafka message processing that automatically discovers your topics and requires just ONE function to process everything.**

## ✨ **What This Does** 

**Automatically discover Kafka topics and process messages with intelligent auto-subscription - you only implement ONE function and get everything else for free.**

## 🚀 **Key Benefits** 

| Feature                          | What You Get                                                       |
| -------------------------------- | ------------------------------------------------------------------ |
| 🔍 **Auto Discovery**            | Automatically finds and subscribes to all processor topics        |
| 🧠 **One Function Processing**   | Just implement `processMessage()` - everything else is automatic  |
| 🛡️ **Zero Configuration**        | No manual topic subscription or setup needed                       |
| ⚡ **File-Based Discovery**      | Create `processors/[topic-name].js` and it's automatically loaded |
| 🔄 **Runtime Management**        | Add, remove, or update processors without restarting              |

## 📦 **Installation** 

```bash
npm install easy-kafka-accessor
```

## 🐳 **Docker Support**

### **Quick Docker Deployment**

```bash
# Build the Docker image
docker build -t easy-kafka-accessor:latest .

# Run with custom processors
docker run -d --name easy-kafka-accessor \
  -e KAFKA_BROKERS=your-kafka:9092 \
  -v /path/to/your/processors:/processors \
  easy-kafka-accessor:latest
```

### **Docker Features**
- ✅ **Lightweight**: Based on Node.js 18 Alpine
- ✅ **Easy Deployment**: Install from npm, no source code copying
- ✅ **Custom Processors**: Mount your processors directory at `/processors`
- ✅ **Environment Config**: All Kafka settings via environment variables
- ✅ **Production Ready**: Optimized for containerized deployments

### **Environment Variables**
| Variable | Default | Description |
|-----------|---------|-------------|
| `KAFKA_BROKERS` | `localhost:9092` | Kafka broker addresses |
| `KAFKA_CLIENT_ID` | `easy-kafka-accessor` | Client identifier |
| `KAFKA_GROUP_ID` | `easy-kafka-accessor-group` | Consumer group ID |
| `PROCESSORS_DIR` | `/processors` | Processors directory (Docker default) |
| `LOG_LEVEL` | `info` | Logging level |

### **Volume Mounting**
```bash
# Mount your custom processors
-v /host/processors:/processors

# Mount environment file (optional)
-v ./.env:/app/.env:ro
```

### **Docker Image Versioning**
The Docker image versioning is automatically synchronized with npm releases:

| npm Release | Docker Image Tag | Description |
|-------------|------------------|-------------|
| `v1.0.0` | `easynetdocker/easy-kafka-accessor:v1.0.0` | Exact version match |
| `v2.1.0` | `easynetdocker/easy-kafka-accessor:v2.1.0` | Exact version match |
| `latest` | `easynetdocker/easy-kafka-accessor:latest` | Always latest release |

**Pull specific versions:**
```bash
# Pull exact version
docker pull easynetdocker/easy-kafka-accessor:v1.0.0

# Pull latest release
docker pull easynetdocker/easy-kafka-accessor:latest
```

**Run with specific version:**
```bash
docker run -d --name easy-kafka-accessor \
  -e KAFKA_BROKERS=your-kafka:9092 \
  -v /path/to/your/processors:/processors \
  easynetdocker/easy-kafka-accessor:v1.0.0
```

## ⚡ **Quick Start (3 Steps)** 

### **Step 1: Setup Environment**

```bash
# Copy and edit environment file
cp env.example .env
```

**Edit `.env` with your Kafka settings:**

```bash
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=my-app
KAFKA_GROUP_ID=my-group
```

### **Step 2: Create a Processor**

**📁 Important**: The filename must match your topic name exactly: `processors/[topic-name].js`

```javascript
// processors/my-topic.js
const { KafkaTopicProcessor } = require('easy-kafka-accessor');

class MyTopicProcessor extends KafkaTopicProcessor {
  async processMessage(message, metadata) {
    // 🎯 THIS IS THE ONLY FUNCTION YOU NEED TO IMPLEMENT!
    console.log('Processing message:', message);
    
    // Your processing logic here
    return { processed: true, data: message };
  }
}

module.exports = MyTopicProcessor;
```

### **Step 3: Start Processing**

```bash
npm start
```

**🎉 That's it!** The application automatically:
- ✅ Detects your `processors/my-topic.js` file
- ✅ Subscribes to the `my-topic` topic (from filename)
- ✅ Starts processing messages immediately

## 🔍 **How It Works** 

### **1. Auto Discovery**
```javascript
await kafka.startConsumer();
// ✅ Scans processors/ directory for topic processors
// ✅ Automatically subscribes to all discovered topics
// ✅ Uses topic names from filenames (processors/[topic-name].js)
// ✅ Runtime changes automatically detected and applied
```

### **2. One Function Processing**
```javascript
// The processor KNOWS your topic, so it:
// - Automatically handles all messages for that topic
// - Provides built-in error handling and logging
// - Gives you metadata (partition, offset, timestamp)
// - Requires just ONE function: processMessage()
```

### **3. Zero Manual Work**
* ❌ No manual topic subscription
* ❌ No configuration boilerplate
* ❌ No complex Kafka setup code
* ❌ No manual topic creation
* ✅ Just create a processor file and implement one function
* ✅ Topics are automatically created when you send messages

## 📋 **Usage Examples** 

### **Quick Start (npm start)**
```bash
npm start
```

### **Programmatic Usage**
```javascript
const { KafkaAccessor } = require('easy-kafka-accessor');

const kafka = new KafkaAccessor();

// Start consumer - automatically subscribes to all processor topics
await kafka.startConsumer();

// Send messages (producer auto-initializes, topic auto-created if not exists)
await kafka.sendMessage('user-events', {
  userId: 123,
  action: 'login',
  timestamp: new Date().toISOString()
});

// Messages automatically processed by processors/user-events.js
```

## 🎯 **Core Methods** 

| Method                          | Purpose               | Example                                                    |
| -------------------------------- | --------------------- | ---------------------------------------------------------- |
| startConsumer()                 | Start auto-processing | await kafka.startConsumer()                                |
| sendMessage(topic, data)        | Send messages (auto-creates topic if not exists) | await kafka.sendMessage('logs', {level: 'info'})          |
| subscribeToTopic(topic, handler)| Custom subscription   | await kafka.subscribeToTopic('events', handler)           |
| topicExists(topic)              | Check topic exists    | const exists = await kafka.topicExists('my-topic')        |
| createTopic(topic, options)     | Create new topic      | await kafka.createTopic('my-topic', {numPartitions: 3})   |
| disconnect()                     | Clean shutdown        | await kafka.disconnect()                                   |

## 🚀 **Application Scripts** 

```bash
# Start
npm start                    # or node app.js
./scripts/start.sh          # Unix/Mac
scripts\start.bat           # Windows

# Stop
npm run stop                # Unix/Mac
npm run stop:win            # Windows
./scripts/stop.sh           # Unix/Mac
scripts\stop.bat            # Windows
```

## ⚙️ **Configuration** 

Create a `.env` file with your Kafka settings:

```bash
# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=my-app
KAFKA_GROUP_ID=my-group
LOG_LEVEL=info

# Producer Configuration
PRODUCER_ACKS=1
PRODUCER_TIMEOUT=30000
PRODUCER_RETRY_ATTEMPTS=3

# Consumer Configuration
CONSUMER_SESSION_TIMEOUT=30000
CONSUMER_HEARTBEAT_INTERVAL=3000
CONSUMER_MAX_BYTES=1048576

# Processor Registry (optional)
PROCESSORS_DIR=./processors
PROCESSORS_AUTO_REFRESH=true
PROCESSORS_REFRESH_INTERVAL=5000
```

**Note**: No constructor parameters needed - everything comes from `.env` file.

## 🔧 **API Reference** 

### **KafkaAccessor**
```javascript
const kafka = new KafkaAccessor(); // No parameters needed
```

### **Producer Methods**
```javascript
// Send message (auto-initializes producer)
await kafka.sendMessage('topic', { data: 'message' });

// Send with options
await kafka.sendMessage('topic', message, {
  key: 'message-key',
  partition: 0
});
```

### **Consumer Methods**
```javascript
// Start consumer (auto-initializes and subscribes to all processor topics)
await kafka.startConsumer();

// Optional: Subscribe to specific topic with custom handler
await kafka.subscribeToTopic('topic', (message, metadata) => {
  // Handle message
});
```

### **Admin Methods**
```javascript
// Check if topic exists (auto-initializes admin)
const exists = await kafka.topicExists('my-topic');

// Create topic (auto-initializes admin)
await kafka.createTopic('my-topic', {
  numPartitions: 3,
  replicationFactor: 1
});
```

### **Cleanup**
```javascript
await kafka.disconnect(); // Disconnect all clients
```

## 🎯 **Why Choose Kafka Data Accessor?** 

### **🚀 Smart Auto-Subscription**
- **Zero Configuration**: No manual topic subscription needed
- **File-Based Discovery**: Create `processors/[topic-name].js` and it's automatically loaded
- **Instant Processing**: Messages start flowing immediately after `startConsumer()`
- **Runtime Management**: Add, remove, or update processors without restarting

### **⚡ One Function Processing**
- **Single Responsibility**: Just implement `processMessage()` - that's it!
- **Everything Included**: Error handling, logging, validation, and result formatting
- **No Boilerplate**: Focus on your business logic, not infrastructure code
- **Consistent Interface**: Same pattern for all processors

### **🔍 Zero Configuration**
- **Environment-Based**: All config comes from `.env` file
- **Auto-Initialization**: Producers, consumers, and admin clients auto-initialize
- **Smart Defaults**: Sensible defaults for all settings
- **Production Ready**: Configure once, deploy anywhere

**🎉 Result**: Write less code, get more functionality, focus on what matters!

## 🧪 **Testing** 

```bash
npm test
```

## 📄 **License** 

MIT License - see LICENSE file for details.

---

**Easy Kafka message processing that thinks for itself** 🧠✨

