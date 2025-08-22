#!/bin/bash

# Automated NPM Publishing Script for Self-Hosted Runners
# This script handles version bumping and npm publishing

set -e  # Exit on any error

# Configuration
VERSION_TYPE=${VERSION_TYPE:-"patch"}  # patch, minor, major
NPM_TOKEN=${NPM_TOKEN}
NPM_REGISTRY=${NPM_REGISTRY:-"https://registry.npmjs.org/"}
GITHUB_TOKEN=${GITHUB_TOKEN}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if required environment variables are set
check_environment() {
    log_info "Checking environment variables..."
    
    if [[ -z "$NPM_TOKEN" ]]; then
        log_error "NPM_TOKEN environment variable is required"
        exit 1
    fi
    
    if [[ -z "$GITHUB_TOKEN" ]]; then
        log_error "GITHUB_TOKEN environment variable is required"
        exit 1
    fi
    
    log_success "Environment variables are set"
}

# Check if we're in a git repository
check_git_status() {
    log_info "Checking git repository status..."
    
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository"
        exit 1
    fi
    
    # Check if there are uncommitted changes
    if [[ -n "$(git status --porcelain)" ]]; then
        log_warning "There are uncommitted changes in the repository"
        git status --short
    fi
    
    log_success "Git repository status checked"
}

# Configure npm for publishing
configure_npm() {
    log_info "Configuring npm for publishing..."
    
    # Set npm registry
    npm config set registry "$NPM_REGISTRY"
    
    # Create .npmrc file with token
    echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > .npmrc
    echo "registry=$NPM_REGISTRY" >> .npmrc
    
    log_success "NPM configured for publishing"
}

# Bump version in package.json
bump_version() {
    log_info "Bumping version ($VERSION_TYPE)..."
    
    # Get current version
    CURRENT_VERSION=$(node -p "require('./package.json').version")
    log_info "Current version: $CURRENT_VERSION"
    
    # Bump version
    npm version "$VERSION_TYPE" --no-git-tag-version
    
    # Get new version
    NEW_VERSION=$(node -p "require('./package.json').version")
    log_success "New version: $NEW_VERSION"
    
    echo "$NEW_VERSION"
}

# Run pre-publish checks
run_checks() {
    log_info "Running pre-publish checks..."
    
    # Install dependencies
    log_info "Installing dependencies..."
    npm ci
    
    # Run tests
    log_info "Running tests..."
    npm test
    
    # Run linting
    log_info "Running linting..."
    npm run lint
    
    log_success "All checks passed"
}

# Publish to npm
publish_to_npm() {
    log_info "Publishing to npm..."
    
    npm publish --access public
    
    log_success "Successfully published to npm"
}

# Create git tag and push
create_git_tag() {
    local version=$1
    
    log_info "Creating git tag and pushing changes..."
    
    # Add package.json changes
    git add package.json
    
    # Commit version bump
    git commit -m "chore: bump version to $version [skip ci]"
    
    # Create tag
    git tag -a "v$version" -m "Release version $version"
    
    # Push changes
    git push origin HEAD
    
    # Push tags
    git push --tags
    
    log_success "Git tag created and pushed"
}

# Main function
main() {
    log_info "🚀 Starting automated npm publish process..."
    log_info "Version type: $VERSION_TYPE"
    log_info "NPM registry: $NPM_REGISTRY"
    
    # Run all steps
    check_environment
    check_git_status
    configure_npm
    run_checks
    NEW_VERSION=$(bump_version)
    publish_to_npm
    create_git_tag "$NEW_VERSION"
    
    log_success "🎉 Successfully published!"
    log_info "📦 Package version: $NEW_VERSION"
    log_info "🏷️ Git tag: v$NEW_VERSION"
    log_info "✨ Your package is now available on npm!"
}

# Run main function
main "$@"
