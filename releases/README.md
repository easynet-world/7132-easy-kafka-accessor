# Kafka Accessor RPM Package - Version 0.0.1

This directory contains the source files needed to build the kafka-accessor RPM package.

## Files

- `kafka-accessor-0.0.1.tar.gz` - Source tarball containing the application
- `kafka-accessor.spec` - RPM spec file for building the package
- `build-rpm.sh` - Build script for Linux systems

## Building the RPM Package

### Prerequisites

- RHEL/CentOS/Fedora system
- rpm-build package installed

```bash
# Install rpm-build
sudo dnf install rpm-build
```

### Build Steps

1. **Copy files to your Linux system**
   ```bash
   # Copy the releases directory to your Linux machine
   scp -r releases/ user@your-linux-server:/path/to/destination/
   ```

2. **Navigate to the releases directory**
   ```bash
   cd releases/
   ```

3. **Run the build script**
   ```bash
   ./build-rpm.sh
   ```

4. **Install the RPM package**
   ```bash
   # Install the built RPM
   sudo dnf install kafka-accessor-0.0.1-1.noarch.rpm
   
   # Or using rpm command
   sudo rpm -ivh kafka-accessor-0.0.1-1.noarch.rpm
   ```

## Package Contents

The RPM package will install:

- **Binary**: `/usr/bin/kafka-accessor`
- **Application**: `/usr/share/kafka-accessor/`
- **Configuration**: `/etc/kafka-accessor/kafka.env`
- **Services**: `/etc/systemd/system/kafka-accessor-*.service`
- **Logs**: `/var/log/kafka-accessor/`
- **Data**: `/var/lib/kafka-accessor/`

## Service Management

After installation:

```bash
# Enable and start services
sudo systemctl enable kafka-accessor-producer
sudo systemctl enable kafka-accessor-consumer
sudo systemctl start kafka-accessor-producer
sudo systemctl start kafka-accessor-consumer

# Check status
sudo systemctl status kafka-accessor-*

# View logs
sudo journalctl -u kafka-accessor-producer -f
sudo journalctl -u kafka-accessor-consumer -f
```

## Usage

```bash
# Test the installation
kafka-accessor --help
kafka-accessor --version

# Start services
kafka-accessor producer
kafka-accessor consumer --topics system-logs
kafka-accessor both --topics system-logs
```

## Troubleshooting

If the build fails:

1. Check that rpm-build is installed
2. Ensure you have sufficient disk space
3. Verify the spec file syntax
4. Check the build logs in `~/rpmbuild/BUILD/`

For more information, see the main README.md file.
