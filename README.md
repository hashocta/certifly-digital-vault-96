
# Tokenized Certificate Platform API

This API serves as the backend for a Tokenized Certificate Platform built on Cloudflare Workers. It provides endpoints for user authentication, profile management, certificate handling, verification, and NFT minting on Solana.

## Core Technologies

- **Cloudflare Workers**: Serverless compute platform
- **Cloudflare D1**: SQLite database for metadata storage
- **Cloudflare R2**: Object storage for files
- **Bundlr**: Permanent storage on Arweave
- **Metaplex**: NFT minting on Solana
- **Hono**: Lightweight web framework

## API Endpoints

### Authentication

#### POST /api/auth/login
Authenticate using a Solana wallet signature.

**Request**
```json
{
  "message": "Login to Certifly - Nonce: 1234567890",
  "signature": "base58_encoded_signature",
  "publicKey": "base58_encoded_public_key"
}
```

**Response**
```json
{
  "token": "jwt_token_string",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "full_name": "John Doe",
    "wallet_address": "solana_wallet_address",
    "created_at": "2025-04-18T10:00:00Z",
    "updated_at": "2025-04-18T10:00:00Z"
  }
}
```

#### GET /api/auth/me
Get the current authenticated user's profile.

**Headers**
```
Authorization: Bearer <jwt_token>
```

**Response**
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "full_name": "John Doe",
  "wallet_address": "solana_wallet_address",
  "created_at": "2025-04-18T10:00:00Z",
  "updated_at": "2025-04-18T10:00:00Z"
}
```

### Profile Management

#### GET /api/profile
Get user profile information.

**Headers**
```
Authorization: Bearer <jwt_token>
```

**Response**
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "full_name": "John Doe",
  "wallet_address": "solana_wallet_address",
  "created_at": "2025-04-18T10:00:00Z",
  "updated_at": "2025-04-18T10:00:00Z"
}
```

#### PUT /api/profile
Update user profile information.

**Headers**
```
Authorization: Bearer <jwt_token>
```

**Request**
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "photoFileName": "profile.jpg"
}
```

**Response**
```json
{
  "user": {
    "id": "user_id",
    "email": "john@example.com",
    "full_name": "John Doe",
    "wallet_address": "solana_wallet_address",
    "created_at": "2025-04-18T10:00:00Z",
    "updated_at": "2025-04-18T10:00:00Z"
  },
  "uploadUrl": "https://r2.example.com/presigned-url", // Only if photoFileName was provided
  "publicUrl": "https://r2.example.com/profiles/user_id/profile.jpg" // Only if photoFileName was provided
}
```

### Certificates

#### GET /api/certificates
List all certificates for the authenticated user.

**Headers**
```
Authorization: Bearer <jwt_token>
```

**Response**
```json
{
  "certificates": [
    {
      "id": "cert_id",
      "title": "Web Development Certificate",
      "institution_name": "Tech Academy",
      "program_name": "Full Stack Development",
      "issue_date": "2025-04-18",
      "certificate_url": "https://r2.example.com/certificates/user_id/cert_id.pdf",
      "verification_status": "verified",
      "verification_details": "{\"status\":\"success\",\"verified_at\":\"2025-04-18T10:00:00Z\"}",
      "arweave_url": "https://arweave.net/tx_id",
      "nft_mint_address": "solana_nft_address",
      "created_at": "2025-04-18T10:00:00Z",
      "updated_at": "2025-04-18T10:00:00Z"
    }
  ]
}
```

#### POST /api/certificates
Create a new certificate.

**Headers**
```
Authorization: Bearer <jwt_token>
```

**Request (Two-step process)**

1. Initial request to get upload URL:
```json
{
  "title": "Web Development Certificate",
  "institutionName": "Tech Academy",
  "programName": "Full Stack Development",
  "issueDate": "2025-04-18",
  "fileName": "certificate.pdf",
  "fileType": "application/pdf",
  "requestUploadUrl": true
}
```

**Response**
```json
{
  "id": "cert_id",
  "uploadUrl": "https://r2.example.com/presigned-url",
  "expiresAt": 1713434400000,
  "certificateUrl": "https://r2.example.com/certificates/user_id/cert_id.pdf",
  "verificationUrl": "https://certifly.in/verify/cert_id"
}
```

2. Direct upload (for Worker-based processing):
```json
{
  "title": "Web Development Certificate",
  "institutionName": "Tech Academy",
  "programName": "Full Stack Development",
  "issueDate": "2025-04-18",
  "fileName": "certificate.pdf",
  "fileType": "application/pdf"
}
```
Plus the file data in the request body.

**Response**
```json
{
  "id": "cert_id",
  "certificateUrl": "https://r2.example.com/certificates/user_id/cert_id.pdf",
  "verificationUrl": "https://certifly.in/verify/cert_id"
}
```

#### GET /api/certificates/:id
Get a specific certificate.

**Headers**
```
Authorization: Bearer <jwt_token>
```

**Response**
```json
{
  "id": "cert_id",
  "title": "Web Development Certificate",
  "institution_name": "Tech Academy",
  "program_name": "Full Stack Development",
  "issue_date": "2025-04-18",
  "certificate_url": "https://r2.example.com/certificates/user_id/cert_id.pdf",
  "verification_status": "verified",
  "verification_details": "{\"status\":\"success\",\"verified_at\":\"2025-04-18T10:00:00Z\"}",
  "arweave_url": "https://arweave.net/tx_id",
  "nft_mint_address": "solana_nft_address",
  "created_at": "2025-04-18T10:00:00Z",
  "updated_at": "2025-04-18T10:00:00Z"
}
```

#### DELETE /api/certificates/:id
Delete a certificate.

**Headers**
```
Authorization: Bearer <jwt_token>
```

**Response**
```json
{
  "success": true
}
```

### Verification

#### GET /api/verify/:id
Get verification status for a certificate.

**Headers**
```
Authorization: Bearer <jwt_token>
```

**Response**
```json
{
  "id": "cert_id",
  "status": "verified",
  "details": {
    "verified_at": "2025-04-18T10:00:00Z",
    "verifier": "verification_service",
    "additional_info": "Certificate authenticity confirmed"
  }
}
```

#### POST /api/verify/:id
Initiate verification for a certificate.

**Headers**
```
Authorization: Bearer <jwt_token>
```

**Response**
```json
{
  "id": "cert_id",
  "status": "pending",
  "details": {
    "initiated_at": "2025-04-18T10:00:00Z",
    "estimated_completion": "2025-04-18T10:01:00Z"
  }
}
```

### NFT Minting

#### POST /api/mint/:id
Mint a verified certificate as an NFT.

**Headers**
```
Authorization: Bearer <jwt_token>
```

**Response**
```json
{
  "id": "cert_id",
  "mintAddress": "solana_nft_address",
  "arweaveUrl": "https://arweave.net/tx_id"
}
```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Invalid input: detailed error message"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "error": "Access denied"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error"
}
```

## Development Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in the required values
3. Install dependencies:
```bash
npm install
```

4. Start the development server:
```bash
npm run dev
```

## Environment Variables

See `.env.example` for required environment variables:

```env
# Cloudflare configuration
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_ACCOUNT_ID=your_cloudflare_account_id

# Bundlr configuration
BUNDLR_URL=https://node1.bundlr.network
BUNDLR_CURRENCY=solana
BUNDLR_PRIVATE_KEY=your_solana_private_key_base58_encoded

# Solana configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Authentication
JWT_SECRET=your_jwt_secret_min_32_chars_long

# External APIs
VERIFY_API_KEY=your_verification_api_key

# Logging
LOG_LEVEL=info
```

## Testing

Run the test suite:
```bash
npm test
```

## Deployment

Deploy to Cloudflare Pages:
```bash
npm run deploy
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
