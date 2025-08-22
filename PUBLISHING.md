# Publishing Guide

This guide explains how to publish the `kafka-data-accessor` package to npm.

## 🚀 Quick Publish

The easiest way to publish is using the auto-publish script:

```bash
npm run publish
```

This script will:
1. ✅ Run all tests
2. ✅ Run linting
3. 🔍 Check current npm version
4. 📈 Automatically bump version if needed
5. 📦 Publish to npm
6. 🏷️ Create git tag and push

## 📋 Manual Publishing Options

### Version Bumping

```bash
# Bump patch version (0.0.1 → 0.0.2)
npm run version:patch

# Bump minor version (0.0.1 → 0.1.0)
npm run version:minor

# Bump major version (0.0.1 → 1.0.0)
npm run version:major

# Auto-detect bump type based on commits
npm run version:auto
```

### Publishing

```bash
# Publish with patch version bump
npm run publish:patch

# Publish with minor version bump
npm run publish:minor

# Publish with major version bump
npm run publish:major

# Publish with auto version bump
npm run publish:auto
```

## 🔧 Prerequisites

Before publishing, ensure you have:

1. **npm account**: Logged in with `npm login`
2. **Git setup**: Proper git configuration and remote origin
3. **Tests passing**: Run `npm test` to verify
4. **Linting clean**: Run `npm run lint` to verify

## 📝 Publishing Process

### 1. Auto-Publish (Recommended)

```bash
npm run publish
```

### 2. Manual Step-by-Step

```bash
# 1. Run tests
npm test

# 2. Run linting
npm run lint

# 3. Bump version
npm run version:patch  # or minor/major

# 4. Publish to npm
npm publish

# 5. Create git tag (optional)
git add package.json
git commit -m "chore: bump version to X.X.X"
git tag vX.X.X
git push origin HEAD
git push origin vX.X.X
```

## 🎯 Version Strategy

- **Patch (0.0.X)**: Bug fixes, small improvements
- **Minor (0.X.0)**: New features, backward compatible
- **Major (X.0.0)**: Breaking changes, major rewrites

## 🔍 Version Checking

The auto-publish script automatically:

- Checks current local version in `package.json`
- Compares with published npm version
- Bumps version only if needed
- Handles first-time publishing

## 🚨 Troubleshooting

### Tests Fail
```bash
# Fix test issues first
npm test
```

### Linting Fails
```bash
# Auto-fix linting issues
npm run lint:fix

# Or fix manually
npm run lint
```

### Version Conflicts
```bash
# Check current versions
npm view kafka-data-accessor version
cat package.json | grep version
```

### Git Issues
```bash
# Ensure proper git setup
git status
git remote -v
```

## 📚 Additional Commands

```bash
# Check package info
npm view kafka-data-accessor

# Check current version
npm view kafka-data-accessor version

# View package contents
npm pack --dry-run

# Test publish (dry run)
npm publish --dry-run
```

## 🎉 Success

After successful publishing, you should see:
- ✅ Package published to npm
- 🏷️ Git tag created
- 📦 New version available on npmjs.com

## 🔗 Useful Links

- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org/)
- [Package.json Reference](https://docs.npmjs.com/cli/v8/configuring-npm/package-json)
