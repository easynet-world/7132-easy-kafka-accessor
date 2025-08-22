#!/usr/bin/env node

/**
 * Simple auto-publish script
 * Bumps version and publishes to npm
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const NPM = '/opt/homebrew/bin/npm';

function run(command) {
  execSync(command, { stdio: 'inherit' });
}

function runSilent(command) {
  return execSync(command, { encoding: 'utf8', stdio: 'pipe' }).trim();
}

function getCurrentVersion() {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  return pkg.version;
}

function getNpmVersion(packageName) {
  try {
    return runSilent(`${NPM} view ${packageName} version`);
  } catch {
    return null; // Package doesn't exist on npm
  }
}

function bumpVersion(type = 'patch') {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  const parts = pkg.version.split('.').map(Number);
  
  switch (type) {
    case 'patch': parts[2]++; break;
    case 'minor': parts[1]++; parts[2] = 0; break;
    case 'major': parts[0]++; parts[1] = 0; parts[2] = 0; break;
  }
  
  const newVersion = parts.join('.');
  pkg.version = newVersion;
  
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Version bumped to ${newVersion}`);
  return newVersion;
}

function main() {
  try {
    console.log('🚀 Publishing package...\n');
    
    // Get package info
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const currentVersion = getCurrentVersion();
    const npmVersion = getNpmVersion(pkg.name);
    
    console.log(`Current version: ${currentVersion}`);
    console.log(`NPM version: ${npmVersion || 'not published'}\n`);
    
    // Decide if we need to bump
    const needsBump = npmVersion === currentVersion;
    let newVersion = currentVersion;
    
    if (needsBump) {
      console.log('Version matches npm, bumping patch version...');
      newVersion = bumpVersion('patch');
    }
    
    // Run tests
    console.log('\n📋 Running tests...');
    run(`${NPM} test`);
    
    // Run linting
    console.log('\n🔍 Running linter...');
    run(`${NPM} run lint`);
    
    // Publish
    console.log('\n📦 Publishing to npm...');
    run(`${NPM} publish`);
    
    // Git operations
    if (needsBump) {
      console.log('\n🏷️ Creating git tag...');
      run(`git add package.json`);
      run(`git commit -m "chore: bump version to ${newVersion}"`);
      run(`git tag v${newVersion}`);
      run(`git push origin HEAD`);
      run(`git push origin v${newVersion}`);
    }
    
    console.log(`\n✅ Successfully published ${pkg.name}@${newVersion}!`);
    
  } catch (error) {
    console.error(`\n❌ Failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };