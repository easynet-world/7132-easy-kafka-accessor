#!/bin/bash

# GitHub Actions Self-Hosted Runner Setup Script
# This script helps you set up a self-hosted runner for automated npm publishing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RUNNER_VERSION="2.311.0"
RUNNER_DIR="actions-runner"
REPO_URL=""
RUNNER_TOKEN=""

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Detect operating system
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [[ -f /etc/debian_version ]]; then
            echo "debian"
        elif [[ -f /etc/redhat-release ]]; then
            echo "redhat"
        else
            echo "linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    else
        echo "unknown"
    fi
}

# Install dependencies based on OS
install_dependencies() {
    local os=$(detect_os)
    
    log_info "Installing dependencies for $os..."
    
    case $os in
        "debian"|"ubuntu")
            sudo apt update
            sudo apt install -y curl wget git nodejs npm
            ;;
        "redhat"|"centos"|"fedora")
            if command -v dnf &> /dev/null; then
                sudo dnf install -y curl wget git nodejs npm
            else
                sudo yum install -y curl wget git nodejs npm
            fi
            ;;
        "macos")
            if ! command -v brew &> /dev/null; then
                log_info "Installing Homebrew..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            brew install git node
            ;;
        *)
            log_warning "Unknown OS. Please install git, node, and npm manually."
            ;;
    esac
    
    log_success "Dependencies installed"
}

# Download and setup runner
setup_runner() {
    local os=$(detect_os)
    local arch="x64"
    
    # Determine architecture
    if [[ "$(uname -m)" == "aarch64" || "$(uname -m)" == "arm64" ]]; then
        arch="arm64"
    fi
    
    log_info "Setting up GitHub Actions runner..."
    
    # Create runner directory
    mkdir -p "$RUNNER_DIR"
    cd "$RUNNER_DIR"
    
    # Download runner
    local runner_file="actions-runner-${os}-${arch}-${RUNNER_VERSION}.tar.gz"
    local download_url="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-${os}-${arch}-${RUNNER_VERSION}.tar.gz"
    
    log_info "Downloading runner from: $download_url"
    curl -L -o "$runner_file" "$download_url"
    
    # Extract runner
    log_info "Extracting runner..."
    tar xzf "$runner_file"
    
    # Clean up downloaded file
    rm "$runner_file"
    
    log_success "Runner downloaded and extracted"
}

# Configure runner
configure_runner() {
    log_info "Configuring runner..."
    
    if [[ -z "$REPO_URL" || -z "$RUNNER_TOKEN" ]]; then
        log_error "Repository URL and runner token are required"
        log_info "Please run this script with:"
        log_info "  ./scripts/setup-runner.sh --repo https://github.com/USER/REPO --token YOUR_TOKEN"
        exit 1
    fi
    
    cd "$RUNNER_DIR"
    
    # Configure the runner
    ./config.sh --url "$REPO_URL" --token "$RUNNER_TOKEN" --labels "self-hosted,nodejs" --unattended
    
    log_success "Runner configured"
}

# Install as service
install_service() {
    local os=$(detect_os)
    
    log_info "Installing runner as a service..."
    
    cd "$RUNNER_DIR"
    
    if [[ "$os" == "macos" ]]; then
        log_warning "Service installation not supported on macOS"
        log_info "Please run the runner manually with: ./run.sh"
        return
    fi
    
    # Install service
    sudo ./svc.sh install
    
    # Start service
    sudo ./svc.sh start
    
    log_success "Runner service installed and started"
    log_info "Service status: sudo ./svc.sh status"
    log_info "Service logs: sudo journalctl -u actions.runner.* -f"
}

# Show usage
show_usage() {
    echo "GitHub Actions Self-Hosted Runner Setup Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --repo URL       GitHub repository URL (required)"
    echo "  --token TOKEN    Runner registration token (required)"
    echo "  --service        Install runner as a service"
    echo "  --help           Show this help message"
    echo ""
    echo "Example:"
    echo "  $0 --repo https://github.com/username/repo --token ABC123 --service"
    echo ""
    echo "Prerequisites:"
    echo "  1. Go to your repository → Settings → Actions → Runners"
    echo "  2. Click 'New self-hosted runner'"
    echo "  3. Copy the repository URL and runner token"
    echo "  4. Run this script with those values"
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --repo)
                REPO_URL="$2"
                shift 2
                ;;
            --token)
                RUNNER_TOKEN="$2"
                shift 2
                ;;
            --service)
                INSTALL_SERVICE=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

# Main function
main() {
    log_info "🚀 GitHub Actions Self-Hosted Runner Setup"
    log_info "This script will help you set up a runner for automated npm publishing"
    
    # Parse arguments
    parse_args "$@"
    
    # Check if required arguments are provided
    if [[ -z "$REPO_URL" || -z "$RUNNER_TOKEN" ]]; then
        show_usage
        exit 1
    fi
    
    # Install dependencies
    install_dependencies
    
    # Setup runner
    setup_runner
    
    # Configure runner
    configure_runner
    
    # Install service if requested
    if [[ "$INSTALL_SERVICE" == "true" ]]; then
        install_service
    else
        log_info "To start the runner manually, run:"
        log_info "  cd $RUNNER_DIR && ./run.sh"
    fi
    
    log_success "🎉 Runner setup complete!"
    log_info ""
    log_info "Next steps:"
    log_info "1. Ensure the runner appears online in your repository settings"
    log_info "2. Add NPM_TOKEN secret to your repository"
    log_info "3. Push to master branch to trigger the publish workflow"
    log_info ""
    log_info "Runner directory: $RUNNER_DIR"
    log_info "Repository: $REPO_URL"
}

# Run main function
main "$@"
