# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install easy-kafka-accessor package globally
RUN npm install -g easy-kafka-accessor

# Create default processors directory
RUN mkdir -p /processors

# Set default processors directory as environment variable
ENV PROCESSORS_DIR=/processors

# Expose any necessary ports (if needed for health checks)
EXPOSE 3000

# Set the default command to run the application
CMD ["easy-kafka-accessor"]
