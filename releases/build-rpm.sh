#!/bin/bash

# Build script for kafka-accessor RPM package
# Run this on a RHEL/CentOS/Fedora system with rpm-build installed

set -e

VERSION="0.0.1"
RELEASE="1"
NAME="kafka-accessor"

echo "Building kafka-accessor RPM package version ${VERSION}..."

# Check if rpm-build is installed
if ! command -v rpmbuild &> /dev/null; then
    echo "Error: rpmbuild not found. Please install rpm-build:"
    echo "  sudo dnf install rpm-build"
    exit 1
fi

# Create RPM build directories
RPMBUILD_DIR="$HOME/rpmbuild"
mkdir -p "$RPMBUILD_DIR"/{SOURCES,SPECS,RPMS,SRPMS}

# Copy source tarball
cp "${NAME}-${VERSION}.tar.gz" "$RPMBUILD_DIR/SOURCES/"

# Copy spec file
cp "${NAME}.spec" "$RPMBUILD_DIR/SPECS/"

# Build RPM
echo "Building RPM package..."
rpmbuild -ba "$RPMBUILD_DIR/SPECS/${NAME}.spec"

# Find the built RPM
RPM_FILE=$(find "$RPMBUILD_DIR/RPMS" -name "${NAME}-${VERSION}-${RELEASE}.*.rpm" | head -1)
SRPM_FILE=$(find "$RPMBUILD_DIR/SRPMS" -name "${NAME}-${VERSION}-${RELEASE}.*.src.rpm" | head -1)

if [ -n "$RPM_FILE" ]; then
    echo "✅ RPM package built successfully:"
    echo "   RPM: $RPM_FILE"
    echo "   SRPM: $SRPM_FILE"
    
    # Copy to current directory
    cp "$RPM_FILE" .
    cp "$SRPM_FILE" .
    
    echo "📦 RPM files copied to current directory:"
    ls -la *.rpm
else
    echo "❌ Failed to build RPM package"
    exit 1
fi

echo "🎉 Build completed successfully!"
