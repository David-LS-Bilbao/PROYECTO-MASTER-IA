# Playwright E2E Tests - Verity News Frontend

**Status**: ✅ Configured (Sprint 14 - Tarea 3)

## Overview

End-to-end tests for critical user flows:
- Authentication and login redirects
- Page load performance
- Responsive design verification
- Firebase integration

## Quick Start

### 1. Prerequisites

Ensure both services are running:

```bash
# Terminal 1: Backend (optional for some tests)
cd backend
npm run dev
# Runs on http://localhost:3000

# Terminal 2: Frontend
cd frontend
npm run dev
# Runs on http://localhost:3001
```

### 2. Run E2E Tests

From the `frontend/` directory:

```bash
# Run all E2E tests (headless mode)
npm run test:e2e

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Debug mode (step through tests)
npm run test:e2e:debug

# Run specific test file
npx playwright test tests/e2e/auth.spec.ts

# Run specific test by name
npx playwright test -g "should redirect to /login"
```

## Test Structure

### `auth.spec.ts`

Comprehensive authentication and navigation tests organized by category:

#### 🔐 Login Redirect
- Verify unauthenticated users redirected to `/login`
- Test redirect from `/profile` and `/dashboard`

#### 🔑 Login Page Elements
- Verify login page loads with required elements
- Check interactive elements (buttons, links)
- Monitor console for errors during page load

#### 🏠 Homepage Access
- Verify homepage accessible without authentication
- Check navigation elements

#### 📱 Responsive Design
- Test login page on mobile (375x812)
- Test redirect on tablet (768x1024)

#### 🚀 Performance Smoke Tests
- Verify login page loads within 5 seconds
- Verify redirects complete within 3 seconds

#### Firebase Integration
- Verify Firebase SDK initializes without errors
- Check Firebase availability

## Configuration

### `playwright.config.ts`

Key settings:
- **Base URL**: `http://localhost:3001`
- **Browser**: Chromium (Firefox and Safari commented out)
- **Traces**: `on-first-retry` (captures trace when test fails)
- **Screenshots**: Only on failure
- **Videos**: Retained on failure
- **Timeout**: 30 seconds per test
- **Workers**: 1 (sequential execution for auth tests)

## Test Execution Flow

1. **Setup Phase**
   - Start Next.js dev server (if configured in config)
   - Navigate to test URL

2. **Test Phase**
   - Execute assertions
   - Monitor console messages
   - Track page metrics

3. **Cleanup Phase**
   - Capture screenshot/video if failed
   - Generate trace file if failed
   - Close browser context

## Output & Artifacts

After test execution, Playwright generates:

```
frontend/
├── playwright-report/      # HTML report
│   └── index.html         # Open in browser
├── test-results/          # Test results JSON
├── tests/                 # Test files
│   └── e2e/
│       ├── auth.spec.ts
│       └── README.md (this file)
└── playwright.config.ts
```

### View HTML Report

```bash
npx playwright show-report
```

## Debugging

### Option 1: UI Mode (Recommended)
```bash
npm run test:e2e:ui
```
- Visual test picker
- Step through execution
- Inspector tools

### Option 2: Debug Mode
```bash
npm run test:e2e:debug
```
- Step through code line by line
- Inspect DOM state
- Pause on assertions

### Option 3: View Trace Files
Trace files captured on first failure contain:
- Browser actions
- Network requests
- DOM state
- Console messages

## Common Issues

### ❌ "Connection refused"
**Problem**: Frontend not running on port 3001
```bash
# Solution:
cd frontend
npm run dev
```

### ❌ "Timeout waiting for element"
**Problem**: Element not found within 30s timeout
- Check if page structure changed
- Increase timeout in test: `{ timeout: 60000 }`
- Check browser console for errors

### ❌ "Test failed in CI but passes locally"
**Problem**: Environment differences
- CI may have slower network/resources
- Use `waitForLoadState('networkidle')` for stability
- Increase timeouts in CI: add `timeout: 60000` to config

## CI/CD Integration

For GitHub Actions or other CI:

```yaml
- name: Install Playwright Browsers
  run: npx playwright install --with-deps

- name: Run E2E Tests
  run: npm run test:e2e
```

The configuration detects CI environment via `process.env.CI`:
- Retries: 1 (vs 0 locally)
- Workers: 1 (sequential)
- Reports: HTML

## Next Steps (Sprint 14+)

1. **Add Firebase Auth Flow Tests** (Paso 3.1)
   - Mock Firebase tokens
   - Test authenticated dashboard access
   - Test logout flow

2. **Add API Integration Tests** (Paso 3.2)
   - Test news fetching
   - Test article analysis
   - Test dashboard data loading

3. **Add Visual Regression Tests** (Paso 3.3)
   - Snapshot comparisons
   - Responsive design verification

4. **Add Performance Tests** (Paso 3.4)
   - Lighthouse integration
   - Core Web Vitals tracking
   - Load performance monitoring

## Best Practices

✅ **DO**
- Use semantic locators: `page.getByRole('button')` vs `page.$('.btn')`
- Add meaningful test names describing the behavior
- Use `waitForLoadState()` to ensure stability
- Test user workflows, not implementation details
- Keep tests independent and isolated

❌ **DON'T**
- Use hardcoded waits: `await page.waitForTimeout(1000)`
- Test internal state or implementation details
- Make tests dependent on execution order
- Use flaky selectors (XPath, CSS if avoidable)

## Playwright Documentation

- [Official Docs](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging](https://playwright.dev/docs/debug)
- [Network Handling](https://playwright.dev/docs/network)

---

**Created**: Sprint 14 - Tarea 3: Setup de Testing E2E
**Last Updated**: 2026-02-05
