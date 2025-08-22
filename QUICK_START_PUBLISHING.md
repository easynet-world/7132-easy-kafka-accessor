# 🚀 Quick Start: Automated NPM Publishing

Get automated npm publishing set up in 5 minutes!

## ⚡ Quick Setup

### 1. Add GitHub Secrets
Go to your repository → Settings → Secrets and variables → Actions, add:
- **`NPM_TOKEN`**: Your npm access token

### 2. Set Up Self-Hosted Runner

#### Option A: Use Our Setup Script (Recommended)
```bash
# Make script executable
chmod +x scripts/setup-runner.sh

# Run setup (replace with your details)
./scripts/setup-runner.sh \
  --repo https://github.com/easynet-world/7132-kafka-data-accessor \
  --token YOUR_RUNNER_TOKEN \
  --service
```

#### Option B: Manual Setup
1. Go to your repository → Settings → Actions → Runners
2. Click "New self-hosted runner"
3. Follow the setup instructions for your OS

### 3. Get Runner Token
1. Go to your repository → Settings → Actions → Runners
2. Click "New self-hosted runner"
3. Copy the token from the setup instructions

### 4. Test the Setup
```bash
# Push to master to trigger the workflow
git push origin master
```

## 🔧 What Happens Automatically

- ✅ **Version Bumping**: Automatically bumps patch/minor/major based on commit messages
- ✅ **Testing**: Runs all tests before publishing
- ✅ **Publishing**: Publishes to npm with new version
- ✅ **Git Tags**: Creates version tags automatically
- ✅ **GitHub Releases**: Creates releases with changelog

## 📝 Commit Message Examples

```bash
# Patch version (bug fixes)
git commit -m "fix: resolve memory leak"

# Minor version (new features)
git commit -m "feat: add new processor type"

# Major version (breaking changes)
git commit -m "feat: BREAKING CHANGE - new API"
```

## 🎯 Next Steps

1. **Set up runner** using the script above
2. **Add NPM_TOKEN** to GitHub secrets
3. **Push to master** to trigger first publish
4. **Monitor workflow** in Actions tab

## 📚 Full Documentation

See [docs/PUBLISHING.md](docs/PUBLISHING.md) for complete setup instructions and troubleshooting.

## 🆘 Need Help?

- Check the [troubleshooting section](docs/PUBLISHING.md#troubleshooting)
- Review GitHub Actions logs
- Ensure runner is online in repository settings
