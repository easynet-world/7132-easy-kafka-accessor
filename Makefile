NAME = kafka-accessor
VERSION = 0.0.1
RELEASE = 1

# RPM build directories
RPMBUILD_DIR = $(HOME)/rpmbuild
SOURCES_DIR = $(RPMBUILD_DIR)/SOURCES
SPECS_DIR = $(RPMBUILD_DIR)/SPECS
RPMS_DIR = $(RPMBUILD_DIR)/RPMS
SRPMS_DIR = $(RPMBUILD_DIR)/SRPMS

.PHONY: all clean prepare-rpm build-rpm install-deps test

all: build-rpm

# Install Node.js dependencies
install-deps:
	npm install

# Run tests
test:
	npm test

# Clean build artifacts
clean:
	rm -rf $(RPMBUILD_DIR)
	rm -f $(NAME)-$(VERSION).tar.gz
	rm -rf node_modules

# Prepare RPM build environment
prepare-rpm:
	@echo "Preparing RPM build environment..."
	mkdir -p $(SOURCES_DIR) $(SPECS_DIR) $(RPMS_DIR) $(SRPMS_DIR)
	
	# Create source tarball
	@echo "Creating source tarball..."
	# Create a temporary directory for the source
	mkdir -p /tmp/$(NAME)-$(VERSION)
	# Copy files to temp directory
	cp -r src processors config index.js package.json README.md /tmp/$(NAME)-$(VERSION)/
	# Create tarball
	cd /tmp && tar -czf $(SOURCES_DIR)/$(NAME)-$(VERSION).tar.gz $(NAME)-$(VERSION)
	# Clean up
	rm -rf /tmp/$(NAME)-$(VERSION)
	
	# Copy spec file
	cp $(NAME).spec $(SPECS_DIR)/

# Build RPM package
build-rpm: prepare-rpm
	@echo "Building RPM package..."
	rpmbuild -ba $(SPECS_DIR)/$(NAME).spec
	@echo "RPM package built successfully!"
	@echo "Location: $(RPMS_DIR)/noarch/$(NAME)-$(VERSION)-$(RELEASE).*.noarch.rpm"

# Build source RPM only
build-srpm: prepare-rpm
	@echo "Building source RPM..."
	rpmbuild -bs $(SPECS_DIR)/$(NAME).spec

# Install the built RPM (requires root)
install-rpm: build-rpm
	sudo dnf install -y $(RPMS_DIR)/noarch/$(NAME)-$(VERSION)-$(RELEASE).*.noarch.rpm

# Remove the installed package (requires root)
uninstall-rpm:
	sudo dnf remove -y $(NAME)

# Show package info
info:
	@echo "Package: $(NAME)"
	@echo "Version: $(VERSION)"
	@echo "Release: $(RELEASE)"
	@echo "Build directory: $(RPMBUILD_DIR)"

# Lint the spec file
lint-spec:
	rpmlint $(NAME).spec

help:
	@echo "Available targets:"
	@echo "  install-deps  - Install Node.js dependencies"
	@echo "  test         - Run tests"
	@echo "  clean        - Clean build artifacts"
	@echo "  prepare-rpm  - Prepare RPM build environment"
	@echo "  build-rpm    - Build RPM package"
	@echo "  build-srpm   - Build source RPM only"
	@echo "  install-rpm  - Install the built RPM (requires root)"
	@echo "  uninstall-rpm - Remove the installed package (requires root)"
	@echo "  info         - Show package information"
	@echo "  lint-spec    - Lint the spec file"
	@echo "  help         - Show this help message"
