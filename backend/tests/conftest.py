"""
conftest.py — shared fixtures for the backend test suite.

No fake CVE IDs, no synthetic OSV payloads, no hardcoded mock registry
responses are stored here.  All vulnerability assertions are made against
the live OSV API using real package/version pairs with documented CVEs.
"""
import os
import sys
import pytest

# Must be set before any app import so the scheduler and DB init are skipped.
os.environ['DISABLE_SCHEDULER'] = 'true'
os.environ.setdefault('DATABASE_URL', 'postgresql://test:badpass@localhost/nonexistent_test')
# Ensure JWT_SECRET is set for token generation in tests
os.environ.setdefault('JWT_SECRET', 'test-secret-key-for-ci-only')
# Signal testing mode to the require_auth bypass
os.environ['TESTING'] = 'true'

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.fixture
def client():
    """Flask test client.  Resets the in-memory rate-limiter store between
    tests so rate-limit assertions do not bleed across test functions.

    Auth is bypassed via two mechanisms:
      1. app.config['TESTING'] = True  → require_auth reads this at request time
      2. TESTING env var = 'true'      → belt-and-suspenders for the decorator
    A real JWT is also injected so tests that inspect the Authorization header
    still receive a parseable token.
    """
    from app import app, _rate_limiter
    from auth import generate_token

    app.config['TESTING'] = True
    _rate_limiter._store.clear()

    # Generate a real (signed) test token — avoids coupling tests to the bypass
    token = generate_token(0, "test-user", "user")

    with app.test_client() as c:
        # Attach Authorization header to every request made through this client
        c.environ_base["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        yield c
