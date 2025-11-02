# Testing Guide

This base app includes comprehensive testing for both frontend and backend components.

## Quick Start

```bash
# Run all tests
./scripts/test.sh

# Run with coverage
./scripts/test.sh --coverage

# Run only frontend tests
./scripts/test.sh --frontend-only

# Run only backend tests
./scripts/test.sh --backend-only

# Run frontend tests in watch mode
./scripts/test.sh --watch
```

## Frontend Tests

Located in `frontend/__tests__/`, tests cover:

- **API Client** (`lib/api.test.ts`) - HTTP client functionality
- **Utilities** (`lib/utils.test.ts`) - Helper functions and formatters

### Running Frontend Tests

```bash
cd frontend

# Run tests once
yarn test

# Watch mode (re-runs on file changes)
yarn test:watch

# With coverage report
yarn test:coverage
```

### Frontend Test Structure

```
frontend/
├── __tests__/
│   └── lib/
│       ├── api.test.ts       # API client tests
│       └── utils.test.ts     # Utility function tests
├── jest.setup.js             # Jest configuration
└── package.json              # Test scripts
```

## Backend Tests

Located in `tests/`, tests cover:

- **Core API** (`test_app.py`) - Basic functionality
- **Endpoints** (`test_api_endpoints.py`) - Comprehensive API testing

### Running Backend Tests

```bash
# Run tests
pytest tests/

# With coverage
pytest tests/ --cov=backend --cov-report=html

# Verbose output
pytest tests/ -v
```

### Backend Test Structure

```
tests/
├── test_app.py              # Basic API tests
└── test_api_endpoints.py    # Comprehensive endpoint tests
```

## Test Coverage

### Frontend Coverage
- API client: GET, POST, PUT, DELETE, upload methods
- Error handling and response parsing
- Utility functions: date formatting, validation, helpers

### Backend Coverage
- User settings CRUD operations
- File upload functionality
- Nugget generation and caching
- Authentication and authorization
- Error handling and edge cases
- Database isolation between users

## Testing Philosophy

This base app follows testing best practices:

1. **Unit Tests** - Test individual functions and components
2. **Integration Tests** - Test API endpoints with database
3. **Mocking** - Mock external dependencies (S3, OpenAI, etc.)
4. **Isolation** - Each test runs in isolation with fresh data
5. **Coverage** - Aim for high test coverage on critical paths

## CI/CD Integration

The test script is designed for easy CI/CD integration:

```bash
# In your CI pipeline
./scripts/test.sh --coverage
```

Exit codes:
- `0` - All tests passed
- `1` - One or more test suites failed

## Adding New Tests

### Frontend Tests

Create test files in `frontend/__tests__/`:

```typescript
// Example: __tests__/components/MyComponent.test.ts
import { MyComponent } from '../../components/MyComponent';

describe('MyComponent', () => {
  test('should render correctly', () => {
    // Your test here
  });
});
```

### Backend Tests

Create test files in `tests/`:

```python
# Example: tests/test_my_feature.py
import pytest
from fastapi.testclient import TestClient

def test_my_endpoint(client):
    c, _ = client
    response = c.get('/api/my-endpoint')
    assert response.status_code == 200
```

## Common Issues

### Frontend

- **Missing dependencies**: Run `yarn install` in frontend directory
- **React Native mocks**: Handled automatically in `jest.setup.js`
- **Environment variables**: Set `EXPO_PUBLIC_*` variables for tests

### Backend

- **Missing dependencies**: Run `pip install -r requirements.txt`
- **Database issues**: Tests use isolated SQLite databases
- **Environment variables**: Set `OPENAI_API_KEY=test` for tests

## Performance

Test suite performance benchmarks:

- **Frontend tests**: ~5-10 seconds
- **Backend tests**: ~10-15 seconds
- **Total runtime**: ~15-25 seconds

For faster feedback during development, use:
- `--frontend-only` or `--backend-only` flags
- `--watch` mode for frontend tests
