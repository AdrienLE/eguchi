"""
Tests for authentication functions
"""

import pytest
from unittest.mock import patch, Mock
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from backend.auth import verify_jwt, _get_jwks, _get_rsa_key


class TestAuth:
    """Test authentication functions"""

    @patch("backend.auth.requests.get")
    def test_get_jwks_success(self, mock_get):
        """Test successful JWKS retrieval"""
        mock_response = Mock()
        mock_response.json.return_value = {"keys": [{"kid": "test-key"}]}
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        # Clear the cache first
        _get_jwks.cache_clear()

        result = _get_jwks()
        assert result == {"keys": [{"kid": "test-key"}]}
        mock_get.assert_called_once()

    @patch("backend.auth.requests.get")
    def test_get_jwks_http_error(self, mock_get):
        """Test JWKS retrieval HTTP error"""
        mock_response = Mock()
        mock_response.raise_for_status.side_effect = Exception("HTTP Error")
        mock_get.return_value = mock_response

        # Clear the cache first
        _get_jwks.cache_clear()

        with pytest.raises(Exception):
            _get_jwks()

    @patch("backend.auth._get_jwks")
    @patch("backend.auth.jwt.get_unverified_header")
    def test_get_rsa_key_success(self, mock_get_header, mock_get_jwks):
        """Test successful RSA key retrieval"""
        mock_get_header.return_value = {"kid": "test-key-id"}
        mock_get_jwks.return_value = {
            "keys": [
                {
                    "kid": "test-key-id",
                    "kty": "RSA",
                    "use": "sig",
                    "n": "test-n",
                    "e": "test-e",
                }
            ]
        }

        result = _get_rsa_key("test-token")
        expected = {
            "kty": "RSA",
            "kid": "test-key-id",
            "use": "sig",
            "n": "test-n",
            "e": "test-e",
        }
        assert result == expected

    @patch("backend.auth._get_jwks")
    @patch("backend.auth.jwt.get_unverified_header")
    def test_get_rsa_key_not_found(self, mock_get_header, mock_get_jwks):
        """Test RSA key not found"""
        mock_get_header.return_value = {"kid": "missing-key-id"}
        mock_get_jwks.return_value = {
            "keys": [
                {
                    "kid": "different-key-id",
                    "kty": "RSA",
                    "use": "sig",
                    "n": "test-n",
                    "e": "test-e",
                }
            ]
        }

        with pytest.raises(HTTPException) as exc_info:
            _get_rsa_key("test-token")

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Invalid authorization header"

    @patch("backend.auth._get_rsa_key")
    @patch("backend.auth.jwt.decode")
    def test_verify_jwt_success(self, mock_jwt_decode, mock_get_rsa_key):
        """Test successful JWT verification"""
        mock_get_rsa_key.return_value = {"kty": "RSA", "kid": "test"}
        mock_jwt_decode.return_value = {"sub": "test-user", "iss": "test-issuer"}

        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid-token")

        result = verify_jwt(credentials)
        assert result == {"sub": "test-user", "iss": "test-issuer"}

    @patch("backend.auth._get_rsa_key")
    @patch("backend.auth.jwt.decode")
    def test_verify_jwt_invalid_token(self, mock_jwt_decode, mock_get_rsa_key):
        """Test JWT verification with invalid token"""
        mock_get_rsa_key.return_value = {"kty": "RSA", "kid": "test"}
        mock_jwt_decode.side_effect = Exception("Invalid token")

        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid-token")

        with pytest.raises(HTTPException) as exc_info:
            verify_jwt(credentials)

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Could not validate credentials"

    @patch("backend.auth._get_rsa_key")
    def test_verify_jwt_rsa_key_error(self, mock_get_rsa_key):
        """Test JWT verification when RSA key retrieval fails"""
        mock_get_rsa_key.side_effect = HTTPException(
            status_code=401, detail="Invalid authorization header"
        )

        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="test-token")

        with pytest.raises(HTTPException) as exc_info:
            verify_jwt(credentials)

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Could not validate credentials"

    @patch("backend.auth.requests.get")
    def test_get_jwks_cache(self, mock_get):
        """Ensure JWKS fetch is cached and reused until cleared"""
        mock_response = Mock()
        mock_response.json.return_value = {"keys": [{"kid": "k1"}]}
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        _get_jwks.cache_clear()
        r1 = _get_jwks()
        r2 = _get_jwks()
        assert r1 == r2 == {"keys": [{"kid": "k1"}]}
        # Called once thanks to lru_cache
        mock_get.assert_called_once()
