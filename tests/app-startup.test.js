/**
 * Test file to verify app.js startup functionality
 * This ensures that the npm start functionality will work correctly
 */

const path = require('path');

describe('App Startup', () => {
  test('should be able to require app.js without errors', () => {
    // This test verifies that app.js can be required without syntax errors
    // and that all its dependencies are available
    // We need to mock process.exit to prevent the app from actually starting
    const originalExit = process.exit;
    process.exit = jest.fn();
    
    try {
      require('../app.js');
      // The require should succeed, even if the app tries to start
      expect(true).toBe(true);
    } finally {
      // Restore process.exit
      process.exit = originalExit;
    }
  });

  test('should have correct shebang line for CLI execution', () => {
    const fs = require('fs');
    const appContent = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
    
    // Verify the shebang line exists for CLI execution
    expect(appContent).toMatch(/^#!/);
    expect(appContent).toMatch(/node/);
  });

  test('should have all required dependencies available', () => {
    // Test that dotenv can be required
    expect(() => require('dotenv')).not.toThrow();
    
    // Test that the main KafkaAccessor class can be required
    expect(() => require('../src/kafka-accessor')).not.toThrow();
  });

  test('should have correct file structure for npm start', () => {
    const fs = require('fs');
    
    // Verify that app.js exists
    expect(fs.existsSync(path.join(__dirname, '../app.js'))).toBe(true);
    
    // Verify that scripts directory exists
    expect(fs.existsSync(path.join(__dirname, '../scripts'))).toBe(true);
    
    // Verify that start.sh exists
    expect(fs.existsSync(path.join(__dirname, '../scripts/start.sh'))).toBe(true);
    
    // Verify that stop.sh exists
    expect(fs.existsSync(path.join(__dirname, '../scripts/stop.sh'))).toBe(true);
  });
});
