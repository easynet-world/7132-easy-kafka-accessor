#!/usr/bin/env node

/**
 * Automated NPM Publishing Script
 * This script handles version bumping and npm publishing
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');
const VERSION_TYPE = process.env.VERSION_TYPE || 'patch'; // patch, minor, major

/**
 * Read package.json
 */
function readPackageJson() {
  try {
    const content = fs.readFileSync(PACKAGE_JSON_PATH, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('❌ Error reading package.json:', error.message);
    process.exit(1);
  }
}

/**
 * Write package.json
 */
function writePackageJson(packageJson) {
  try {
    fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + '\n');
  } catch (error) {
    console.error('❌ Error writing package.json:', error.message);
    process.exit(1);
  }
}

/**
 * Bump version based on type
 */
function bumpVersion(currentVersion, type) {
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Invalid version type: ${type}`);
  }
}

/**
 * Run command and return output
 */
function runCommand(command, options = {}) {
  try {
    const output = execSync(command, { 
      encoding: 'utf8', 
      stdio: 'pipe',
      ...options 
    });
    return output.trim();
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    console.error('Error:', error.message);
    process.exit(1);
  }
}

/**
 * Check if we're in a git repository
 */
function checkGitStatus() {
  try {
    runCommand('git status --porcelain');
    console.log('✅ Git repository status checked');
  } catch (error) {
    console.error('❌ Not in a git repository or git not available');
    process.exit(1);
  }
}

/**
 * Check if npm is authenticated
 */
function checkNpmAuth() {
  try {
    const whoami = runCommand('npm whoami');
    console.log(`✅ Authenticated as npm user: ${whoami}`);
    return whoami;
  } catch (error) {
    console.error('❌ Not authenticated with npm. Please run: npm login');
    process.exit(1);
  }
}

/**
 * Main publish function
 */
async function publish() {
  console.log('🚀 Starting automated npm publish process...\n');
  
  // Pre-flight checks
  checkGitStatus();
  const npmUser = checkNpmAuth();
  
  // Read current package.json
  console.log('📖 Reading package.json...');
  const packageJson = readPackageJson();
  const currentVersion = packageJson.version;
  
  console.log(`📦 Current version: ${currentVersion}`);
  console.log(`🔄 Bumping version type: ${VERSION_TYPE}`);
  
  // Bump version
  const newVersion = bumpVersion(currentVersion, VERSION_TYPE);
  packageJson.version = newVersion;
  
  console.log(`📈 New version: ${newVersion}`);
  
  // Write updated package.json
  console.log('💾 Updating package.json...');
  writePackageJson(packageJson);
  
  // Run tests and linting
  console.log('🧪 Running tests and linting...');
  runCommand('npm run prepublishOnly');
  
  // Publish to npm
  console.log('📤 Publishing to npm...');
  runCommand('npm publish');
  
  // Create git tag
  console.log('🏷️ Creating git tag...');
  runCommand(`git add package.json`);
  runCommand(`git commit -m "chore: bump version to ${newVersion}"`);
  runCommand(`git tag -a v${newVersion} -m "Release version ${newVersion}"`);
  
  // Push changes and tags
  console.log('📤 Pushing changes and tags...');
  runCommand('git push origin HEAD');
  runCommand('git push --tags');
  
  console.log('\n🎉 Successfully published!');
  console.log(`📦 Package: ${packageJson.name}@${newVersion}`);
  console.log(`👤 Published by: ${npmUser}`);
  console.log(`🏷️ Git tag: v${newVersion}`);
  console.log('\n✨ Your package is now available on npm!');
}

// Handle command line arguments
if (require.main === module) {
  publish().catch(error => {
    console.error('❌ Publishing failed:', error.message);
    process.exit(1);
  });
}

module.exports = { publish, bumpVersion };
