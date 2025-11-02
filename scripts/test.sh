#!/usr/bin/env bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check for arguments
FRONTEND_ONLY=false
BACKEND_ONLY=false
COVERAGE=false
WATCH=false

# Determine Jest flags for environments where Watchman is unavailable (CI/sandbox)
JEST_EXTRA_FLAGS=""
if [ "${DISABLE_WATCHMAN:-}" = "1" ] || [ "${DISABLE_WATCHMAN:-}" = "true" ] || [ "${CI:-}" = "true" ]; then
    JEST_EXTRA_FLAGS="--watchman=false"
fi

for arg in "$@"; do
    case $arg in
        --frontend-only)
            FRONTEND_ONLY=true
            shift
            ;;
        --backend-only)
            BACKEND_ONLY=true
            shift
            ;;
        --coverage)
            COVERAGE=true
            shift
            ;;
        --watch)
            WATCH=true
            shift
            ;;
        --help)
            echo "Test runner for the base app"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --frontend-only    Run only frontend tests"
            echo "  --backend-only     Run only backend tests"
            echo "  --coverage         Run tests with coverage"
            echo "  --watch           Run frontend tests in watch mode"
            echo "  --help            Show this help message"
            echo ""
            exit 0
            ;;
        *)
            print_error "Unknown option: $arg"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check if we're in the right directory
if [ ! -f "scripts/test.sh" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

FRONTEND_SUCCESS=false
BACKEND_SUCCESS=false

# Run backend tests
if [ "$FRONTEND_ONLY" = false ]; then
    print_status "Running backend tests..."

    # Check if pytest is available
    if ! command -v pytest >/dev/null 2>&1; then
        print_warning "pytest not found. Installing backend dependencies..."
        pip install -r requirements.txt
    fi

    if [ "$COVERAGE" = true ]; then
        print_status "Running backend tests with coverage..."
        if pytest tests/ --cov=backend --cov-report=html --cov-report=term --cov-fail-under=80; then
            BACKEND_SUCCESS=true
            print_success "Backend tests passed with coverage!"
            print_status "Backend coverage report generated in htmlcov/"
        else
            print_error "Backend tests failed!"
        fi
    else
        print_status "Running backend tests..."
        if pytest tests/ -v; then
            BACKEND_SUCCESS=true
            print_success "Backend tests passed!"
        else
            print_error "Backend tests failed!"
        fi
    fi

    echo ""
fi

# Run frontend tests
if [ "$BACKEND_ONLY" = false ]; then
    print_status "Running frontend tests..."

    cd frontend

    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_warning "node_modules not found. Installing frontend dependencies..."
        yarn install
    fi

    if [ "$WATCH" = true ]; then
        print_status "Running frontend tests in watch mode..."
        yarn test:watch $JEST_EXTRA_FLAGS
        FRONTEND_SUCCESS=true
    elif [ "$COVERAGE" = true ]; then
        print_status "Running frontend tests with coverage..."
        if yarn test:coverage $JEST_EXTRA_FLAGS; then
            FRONTEND_SUCCESS=true
            print_success "Frontend tests passed with coverage!"
            print_status "Frontend coverage report generated in coverage/"
        else
            print_error "Frontend tests failed!"
        fi
    else
        print_status "Running frontend tests..."
        if yarn test $JEST_EXTRA_FLAGS; then
            FRONTEND_SUCCESS=true
            print_success "Frontend tests passed!"
        else
            print_error "Frontend tests failed!"
        fi
    fi

    cd ..
fi

# Summary
echo ""
print_status "Test Summary:"

if [ "$BACKEND_ONLY" = false ]; then
    if [ "$FRONTEND_SUCCESS" = true ]; then
        print_success "✓ Frontend tests passed"
    else
        print_error "✗ Frontend tests failed"
    fi
fi

if [ "$FRONTEND_ONLY" = false ]; then
    if [ "$BACKEND_SUCCESS" = true ]; then
        print_success "✓ Backend tests passed"
    else
        print_error "✗ Backend tests failed"
    fi
fi

# Exit with error if any tests failed
if [ "$FRONTEND_ONLY" = false ] && [ "$BACKEND_SUCCESS" = false ]; then
    exit 1
fi

if [ "$BACKEND_ONLY" = false ] && [ "$FRONTEND_SUCCESS" = false ]; then
    exit 1
fi

print_success "All tests passed! 🎉"
