# Automated NPM Publishing Guide

This guide explains how to set up automated npm publishing for the Kafka Data Accessor package using GitHub Actions and self-hosted runners.

## 🚀 Overview

The publishing workflow automatically:
- Bumps the package version (patch/minor/major)
- Runs tests and linting
- Publishes to npm
- Creates git tags
- Creates GitHub releases

## 📋 Prerequisites

### 1. NPM Account & Token
- Create an npm account at [npmjs.com](https://www.npmjs.com)
- Generate an access token:
  ```bash
  npm login
  npm token create --read-only
  ```
- Copy the token for use in GitHub secrets

### 2. GitHub Repository Access
- Ensure the repository has access to create releases
- The workflow will need to push commits and tags

## 🔧 Setup Instructions

### Step 1: Add GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions, and add:

1. **`NPM_TOKEN`**: Your npm access token
2. **`GITHUB_TOKEN`**: Automatically provided by GitHub (or create a Personal Access Token)

### Step 2: Set Up Self-Hosted Runner

#### Option A: Use GitHub's Runner Setup Script

1. Go to your repository → Settings → Actions → Runners
2. Click "New self-hosted runner"
3. Choose your operating system and follow the setup instructions
4. The runner will be automatically configured

#### Option B: Manual Setup

1. **Install Dependencies:**
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install nodejs npm git
   
   # macOS
   brew install node git
   
   # CentOS/RHEL
   sudo yum install nodejs npm git
   ```

2. **Download Runner:**
   ```bash
   # Create a directory for the runner
   mkdir actions-runner && cd actions-runner
   
   # Download the latest runner (replace with your OS)
   curl -o actions-runner-linux-x64-2.311.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz
   
   # Extract
   tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz
   ```

3. **Configure Runner:**
   ```bash
   # Configure the runner
   ./config.sh --url https://github.com/YOUR_USERNAME/YOUR_REPO --token YOUR_RUNNER_TOKEN
   
   # Start the runner
   ./run.sh
   ```

4. **Set Up as Service (Optional):**
   ```bash
   # Install as a service
   sudo ./svc.sh install
   sudo ./svc.sh start
   ```

### Step 3: Configure Runner Labels

Ensure your runner has the `self-hosted` label. You can add custom labels in the runner configuration:

```bash
./config.sh --labels "self-hosted,linux,nodejs"
```

## 🔄 How It Works

### Trigger Conditions
The workflow triggers when:
- Code is pushed to the `master` branch
- Excludes documentation-only changes
- Excludes workflow file changes

### Version Bumping Logic
The workflow automatically determines the version bump type:

- **Major** (`1.0.0` → `2.0.0`): Breaking changes
  - Commit messages containing: `BREAKING CHANGE`, `major`, `breaking`
- **Minor** (`1.0.0` → `1.1.0`): New features
  - Commit messages containing: `feat`, `feature`, `minor`
- **Patch** (`1.0.0` → `1.0.1`): Bug fixes and other changes
  - Default for all other commits

### Workflow Steps
1. **Checkout**: Gets the latest code
2. **Setup**: Installs Node.js and dependencies
3. **Test**: Runs tests and linting
4. **Version**: Bumps package version
5. **Publish**: Publishes to npm
6. **Tag**: Creates git tag and pushes changes

## 📝 Commit Message Conventions

To control version bumping, use these prefixes in your commit messages:

```bash
# Major version (breaking changes)
git commit -m "feat: BREAKING CHANGE - completely new API"

# Minor version (new features)
git commit -m "feat: add new processor type"
git commit -m "feature: implement auto-discovery"

# Patch version (bug fixes)
git commit -m "fix: resolve memory leak in processor"
git commit -m "docs: update README with examples"
```

## 🛠️ Manual Publishing

If you need to publish manually:

```bash
# Install dependencies
npm ci

# Run tests
npm test

# Bump version (patch/minor/major)
npm version patch --no-git-tag-version

# Publish
npm publish

# Create git tag
git add package.json
git commit -m "chore: bump version to $(node -p "require('./package.json').version")"
git tag -a "v$(node -p "require('./package.json').version')" -m "Release version $(node -p "require('./package.json').version')"
git push origin HEAD --tags
```

## 🔍 Troubleshooting

### Common Issues

1. **Runner Not Found**
   - Ensure the runner is online and has the `self-hosted` label
   - Check runner logs: `./run.sh` or service logs

2. **NPM Authentication Failed**
   - Verify `NPM_TOKEN` secret is correct
   - Check token permissions (needs publish access)

3. **Git Push Failed**
   - Ensure `GITHUB_TOKEN` has write permissions
   - Check if branch protection rules allow workflow pushes

4. **Version Bump Failed**
   - Ensure package.json is valid
   - Check for uncommitted changes

### Debug Mode

Enable debug logging in the workflow by adding:

```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

### Runner Logs

Check runner logs for detailed information:
```bash
# If running as service
sudo journalctl -u actions.runner.* -f

# If running manually
./run.sh
```

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Self-Hosted Runners](https://docs.github.com/en/actions/hosting-your-own-runners)
- [NPM Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org/)

## 🤝 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review GitHub Actions logs
3. Check runner status and logs
4. Create an issue in the repository
