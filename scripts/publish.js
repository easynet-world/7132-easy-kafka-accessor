#!/usr/bin/env node

/**
 * Auto-publish script for kafka-data-accessor
 * Automatically bumps version and publishes to npm
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${step}: ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function runCommand(command, description) {
  try {
    logStep('RUNNING', description);
    const result = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    logSuccess(description);
    return result.trim();
  } catch (error) {
    logError(`Failed to ${description.toLowerCase()}: ${error.message}`);
    throw error;
  }
}

async function checkCurrentNpmVersion() {
  try {
    logStep('CHECKING', 'Current npm version');
    
    // Get current version from package.json
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const currentVersion = packageJson.version;
    
    logInfo(`Current local version: ${currentVersion}`);
    
    // Check if package exists on npm
    try {
      // Use full path to npm
      const npmPath = '/opt/homebrew/bin/npm';
      const npmInfo = execSync(`${npmPath} view ${packageJson.name} version`, { encoding: 'utf8', stdio: 'pipe' });
      const npmVersion = npmInfo.trim();
      logInfo(`Current npm version: ${npmVersion}`);
      
      if (npmVersion === currentVersion) {
        logWarning('Local version matches npm version. Bumping patch version...');
        return 'patch';
      } else if (npmVersion !== currentVersion) {
        logInfo('Local version differs from npm version. Using local version.');
        return null; // Don't bump, just publish
      }
    } catch (npmError) {
      if (npmError.message.includes('404')) {
        logInfo('Package not found on npm. This will be the first publish.');
        return null; // Don't bump, just publish
      }
      throw npmError;
    }
    
    return 'patch';
  } catch (error) {
    logError(`Failed to check current npm version: ${error.message}`);
    throw error;
  }
}

async function bumpVersion(bumpType) {
  if (!bumpType) {
    logInfo('No version bump needed');
    return;
  }
  
  try {
    logStep('BUMPING', `Version (${bumpType})`);
    
    // Read current package.json
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const currentVersion = packageJson.version;
    
    // Parse current version
    const versionParts = currentVersion.split('.').map(Number);
    let newVersion;
    
    switch (bumpType) {
      case 'patch':
        versionParts[2] = (versionParts[2] || 0) + 1;
        break;
      case 'minor':
        versionParts[1] = (versionParts[1] || 0) + 1;
        versionParts[2] = 0;
        break;
      case 'major':
        versionParts[0] = (versionParts[0] || 0) + 1;
        versionParts[1] = 0;
        versionParts[2] = 0;
        break;
      default:
        throw new Error(`Invalid bump type: ${bumpType}`);
    }
    
    newVersion = versionParts.join('.');
    
    // Update package.json
    packageJson.version = newVersion;
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
    
    logSuccess(`Version bumped from ${currentVersion} to ${newVersion}`);
    return newVersion;
  } catch (error) {
    logError(`Failed to bump version: ${error.message}`);
    throw error;
  }
}

async function runTests() {
  try {
    logStep('TESTING', 'Running tests');
    await runCommand('/opt/homebrew/bin/npm test', 'Run tests');
    logSuccess('All tests passed');
  } catch (error) {
    logError('Tests failed. Aborting publish.');
    process.exit(1);
  }
}

async function runLint() {
  try {
    logStep('LINTING', 'Running linting');
    await runCommand('/opt/homebrew/bin/npm run lint', 'Run linting');
    logSuccess('Linting passed');
  } catch (error) {
    logError('Linting failed. Aborting publish.');
    process.exit(1);
  }
}

async function publishToNpm() {
  try {
    logStep('PUBLISHING', 'Publishing to npm');
    await runCommand('/opt/homebrew/bin/npm publish', 'Publish to npm');
    logSuccess('Successfully published to npm');
  } catch (error) {
    logError(`Failed to publish to npm: ${error.message}`);
    throw error;
  }
}

async function createGitTag(version) {
  if (!version) return;
  
  try {
    logStep('TAGGING', 'Creating git tag');
    await runCommand(`git add package.json`, 'Stage package.json');
    await runCommand(`git commit -m "chore: bump version to ${version}"`, 'Commit version bump');
    await runCommand(`git tag v${version}`, 'Create git tag');
    await runCommand(`git push origin HEAD`, 'Push changes');
    await runCommand(`git push origin v${version}`, 'Push tag');
    logSuccess(`Git tag v${version} created and pushed`);
  } catch (error) {
    logWarning(`Failed to create git tag: ${error.message}`);
    // Don't fail the publish process for git issues
  }
}

async function main() {
  try {
    log('🚀 Starting auto-publish process...', 'bright');
    
    // Check current version and determine if we need to bump
    const bumpType = await checkCurrentNpmVersion();
    
    // Run quality checks
    await runTests();
    await runLint();
    
    // Bump version if needed
    const newVersion = await bumpVersion(bumpType);
    
    // Publish to npm
    await publishToNpm();
    
    // Create git tag
    await createGitTag(newVersion);
    
    log('\n🎉 Publish completed successfully!', 'bright');
    
    if (newVersion) {
      log(`📦 Version ${newVersion} published to npm`, 'green');
    } else {
      log('📦 Package published to npm with existing version', 'green');
    }
    
  } catch (error) {
    logError(`\n💥 Publish failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  main();
}

module.exports = { main };
