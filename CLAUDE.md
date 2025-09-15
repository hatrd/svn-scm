# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the SVN (Subversion) SCM extension for Visual Studio Code - a community-maintained fork that integrates Subversion source control functionality into VS Code. The extension provides a complete SVN interface with source control views, commands, history tracking, and file operations.

## Development Commands

### Building and Development
- `npm run build` - Full build (compiles TypeScript and SCSS)
- `npm run build:ts` - Compile TypeScript sources using webpack
- `npm run build:css` - Compile SCSS styles to CSS
- `npm run compile` - Development watch mode for TypeScript
- `npm run watch:css` - Watch mode for CSS compilation

### Testing and Quality
- `npm run test-compile` - Compile test files
- `npm test` - Run the test suite
- `npm run lint` - Run ESLint code quality checks
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run style-check` - Check code formatting with Prettier
- `npm run style-fix` - Auto-fix formatting issues

### Packaging and Publishing
- `npm run vscode:prepublish` - Pre-publish script (lint + build)
- `npm run semantic-release` - Semantic release for automated publishing
- `npx @vscode/vsce package` - Create VSIX package for distribution

## Architecture Overview

### Core Components

**Extension Entry Point** (`src/extension.ts`)
- Initializes the SVN finder, creates source control manager
- Sets up all providers, watchers, and command registrations
- Handles SVN executable discovery and configuration

**SVN Core** (`src/svn.ts`)
- Low-level SVN command execution with child process spawning
- Handles authentication, encoding detection, and error management
- Provides `exec()` and `execBuffer()` methods for SVN operations

**Repository Management** (`src/repository.ts`)
- High-level repository operations and state management
- Manages source control UI integration (changes, conflicts, unversioned files)
- Handles file watching, status updates, and remote change tracking
- Coordinates between VS Code's SCM API and SVN operations

**Source Control Manager** (`src/source_control_manager.ts`)
- Manages multiple SVN repositories within a workspace
- Provides unified interface for repository discovery and lifecycle

### Key Architectural Patterns

**Command Pattern**: All SVN operations are implemented as commands in `src/commands/` directory, registered through `src/commands.ts`

**Provider Pattern**: History views use providers:
- `RepoLogProvider` - Repository-wide commit history
- `ItemLogProvider` - File-specific history
- `BranchChangesProvider` - Branch comparison view

**Parser Pattern**: SVN command output parsing in `src/parser/` directory handles XML and text output formats

**File System Integration**:
- `RepositoryFilesWatcher` monitors file system changes
- `SvnFileSystemProvider` enables virtual file system for SVN operations

## Configuration and Settings

The extension provides extensive configuration through VS Code settings with prefix `svn.*`. Key areas:
- Repository detection and external handling
- Authentication and credential management
- Source control UI behavior and filtering
- Branch/tag layout regex patterns for different SVN structures
- Remote change checking and update intervals

## Requirements

- **Node.js**: v22.18+
- **VS Code Engine**: v1.85+
- **SVN**: Must be installed on system (TortoiseSVN on Windows with command line tools)

## Development Workflow

1. Use `npm run compile` for development watch mode
2. Press F5 in VS Code to launch Extension Development Host
3. Test changes with actual SVN repositories
4. Run `npm run lint && npm run style-check` before committing
5. Ensure tests pass with `npm test`

## Extension Architecture Notes

- Built as VS Code extension using Extension API
- Uses webpack for bundling with TypeScript
- Integrates with VS Code's Source Control API (`vscode.scm`)
- Provides tree view providers for history and repository browsing
- Supports VS Code's QuickDiff provider for inline change indicators