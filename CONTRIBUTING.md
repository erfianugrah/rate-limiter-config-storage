# Contributing to Rate Limiter Config Storage

Thank you for your interest in contributing to the Rate Limiter Config Storage project! This document provides guidelines and instructions for contributing.

## Development Environment Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/erfianugrah/rate-limiter-cf
   cd rate-limiter-cf/rate-limiter-config-storage
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Run in development mode**
   ```bash
   npm run dev
   ```

## TypeScript Implementation

This project is fully implemented in TypeScript with an automatic sync system for JavaScript compatibility. Here are the guidelines for working with the codebase:

### Project Structure

- `src-ts/`: TypeScript source code (primary development target)
  - `constants/`: Application constants including HTTP status codes
  - `core/`: Durable Object implementation
  - `handlers/`: HTTP request handlers (GET, POST, PUT, DELETE)
  - `operations/`: Business logic modules for rule management
  - `services/`: Core services (ConfigService, RouterService)
  - `types/`: TypeScript type definitions
  - `utils/`: Utility modules (logging, validation, performance)
- `src/`: JavaScript source code (auto-generated from TypeScript)
- `dist/`: Compiled JavaScript output
- `test/`: JavaScript tests (legacy)
- `test-ts/`: TypeScript tests (primary)

### Development Workflow

1. **New features or changes**
   - Always develop in TypeScript (`src-ts/`)
   - Create tests in TypeScript (`test-ts/`)
   - Use TypeScript interfaces and types for all new code
   - Follow the layered architecture pattern:
     1. Handlers accept requests and determine operations
     2. Operations implement business logic using services
     3. Services manage data and core functionality
     4. Utilities support cross-cutting concerns

2. **Bug fixes for all code**
   - Always fix in the TypeScript codebase
   - Use the sync script to update JavaScript files:
     ```bash
     npm run sync
     ```
   - This ensures JavaScript versions stay in sync with TypeScript

3. **TypeScript implementation status**
   - ✅ All handlers fully implemented in TypeScript
   - ✅ All operations fully implemented in TypeScript
   - ✅ Core services fully implemented in TypeScript
   - ✅ Utilities fully implemented in TypeScript
   - ✅ Type definitions complete
   - Tests exist in both JavaScript and TypeScript versions

## Testing

1. **Run tests**
   ```bash
   npm test          # Run all tests
   npm run test:ts   # Run TypeScript tests only
   npm run test:js   # Run JavaScript tests only
   ```

2. **Check TypeScript errors**
   ```bash
   npm run check
   ```

3. **Run ESLint**
   ```bash
   npm run lint
   ```

## Pull Request Guidelines

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the coding style of the project
   - Add/update tests for your changes
   - Update documentation as needed

3. **Verify your changes**
   ```bash
   npm run build
   npm test
   npm run lint
   ```

4. **Submit a pull request**
   - Provide a clear description of the changes
   - Reference any related issues

## Code Style Guidelines

- Use TypeScript for new code
- Follow the existing patterns in the codebase
- Add JSDoc comments for public functions and classes
- Use meaningful variable and function names
- Keep functions focused on a single responsibility

## Deployment Environments

- **Production**: The main environment for the service
   ```bash
   npm run deploy
   ```

- **Staging**: For testing before production
   ```bash
   npm run deploy:staging
   ```

## Additional Resources

- [README.md](./README.md): Project overview and usage information
- [API Documentation](./openapi.yaml): OpenAPI specification for the service