import * as assert from "assert";
import { Uri } from "vscode";
import { SourceControlManager } from "../source_control_manager";
import { Svn } from "../svn";
import { ConstructorPolicy } from "../common/types";

suite("Multi-Repository Support Tests", () => {
  let sourceControlManager: SourceControlManager;
  let mockSvn: Svn;
  let mockContext: any;

  setup(() => {
    // Mock SVN instance
    mockSvn = {
      getRepositoryRoot: async (path: string) => path,
      open: async (repositoryRoot: string, workspaceRoot: string) => ({
        root: repositoryRoot,
        workspaceRoot,
        info: { url: `svn://example.com${workspaceRoot}` }
      })
    } as any;

    // Mock extension context
    mockContext = {
      secrets: {
        get: async () => undefined,
        store: async () => {}
      }
    };
  });

  test("should create source control manager successfully", async () => {
    // Test the basic constructor and initialization
    sourceControlManager = await new SourceControlManager(
      mockSvn,
      ConstructorPolicy.Async,
      mockContext
    );

    await sourceControlManager.isInitialized;

    // Verify basic properties exist
    assert.ok(sourceControlManager.repositories);
    assert.strictEqual(sourceControlManager.repositories.length, 0, "Should start with no repositories");
    assert.ok(typeof sourceControlManager.tryOpenRepository === "function", "tryOpenRepository should be a function");
    assert.ok(typeof sourceControlManager.getOpenRepository === "function", "getOpenRepository should be a function");
  });

  test("should open multiple repositories in different paths", async () => {
    sourceControlManager = await new SourceControlManager(
      mockSvn,
      ConstructorPolicy.Async,
      mockContext
    );

    await sourceControlManager.isInitialized;

    // Mock isSvnFolder to return true for all paths
    const originalIsSvnFolder = require("../util").isSvnFolder;
    require("../util").isSvnFolder = async () => true;

    // Mock Repository constructor to avoid actual SVN operations
    const mockRepositories: any[] = [];
    const originalRepository = require("../repository").Repository;

    require("../repository").Repository = class MockRepository {
      workspaceRoot: string;
      sourceControl: any;
      changes: any;
      onDidChangeState: any;
      onDidChangeRepository: any;
      onDidChangeStatus: any;
      statusExternal: any[];
      statusIgnored: any[];

      constructor(svnRepo: any) {
        this.workspaceRoot = svnRepo.workspaceRoot;
        this.sourceControl = { id: `mock-${svnRepo.workspaceRoot}` };
        this.changes = { id: `changes-${svnRepo.workspaceRoot}` };

        // Add missing status properties
        this.statusExternal = [];
        this.statusIgnored = [];

        // Create proper event emitters that match the expected interface
        this.onDidChangeState = (_listener: any) => {
          return { dispose: () => {} };
        };
        this.onDidChangeRepository = (_listener: any) => {
          return { dispose: () => {} };
        };
        this.onDidChangeStatus = (_listener: any) => {
          return { dispose: () => {} };
        };
        mockRepositories.push(this);
      }

      dispose() {
        // Proper dispose method
      }
    };

    try {
      // Test opening multiple repositories
      const paths = [
        "/workspace/project1",
        "/workspace/project2",
        "/workspace/project3"
      ];

      for (const path of paths) {
        await sourceControlManager.tryOpenRepository(path);
      }

      // Verify all repositories were opened
      assert.strictEqual(sourceControlManager.repositories.length, 3, "Should have 3 repositories");

      // Verify repository paths match
      const repoPaths = sourceControlManager.repositories.map(repo => repo.workspaceRoot).sort();
      assert.deepStrictEqual(repoPaths, paths.sort(), "Repository paths should match expected paths");

    } finally {
      // Restore original functions
      require("../util").isSvnFolder = originalIsSvnFolder;
      require("../repository").Repository = originalRepository;
    }
  });

  test("should find most specific repository for nested paths", async () => {
    sourceControlManager = await new SourceControlManager(
      mockSvn,
      ConstructorPolicy.Async,
      mockContext
    );

    await sourceControlManager.isInitialized;

    // Mock configuration to enable multiple folders
    const originalGet = require("../helpers/configuration").configuration.get;
    require("../helpers/configuration").configuration.get = (key: string, defaultValue?: any) => {
      if (key === "multipleFolders.enabled") return true;
      if (key === "detectExternals") return false;
      if (key === "detectIgnored") return false;
      return defaultValue;
    };

    try {
      // Create mock repositories with nested paths
      const rootRepo = { workspaceRoot: "/workspace/project" };
      const childRepo = { workspaceRoot: "/workspace/project/frontend" };

      // Manually set up open repositories to simulate nested structure
      (sourceControlManager as any).openRepositories = [
        { repository: rootRepo, dispose: () => {} },
        { repository: childRepo, dispose: () => {} }
      ];

      // Test file in child repository - should return most specific (child) repository
      const testFile = Uri.file("/workspace/project/frontend/src/index.js");
      const result = sourceControlManager.getOpenRepository(testFile);

      assert.strictEqual(result?.repository, childRepo, "Should return child repository for file in child path");

      // Test file in root but not in child - should return root repository
      const rootFile = Uri.file("/workspace/project/README.md");
      const rootResult = sourceControlManager.getOpenRepository(rootFile);

      assert.strictEqual(rootResult?.repository, rootRepo, "Should return root repository for file in root path");

    } finally {
      // Restore original configuration
      require("../helpers/configuration").configuration.get = originalGet;
    }
  });

  test("should handle repository hierarchy with parent-child relationships", async () => {
    sourceControlManager = await new SourceControlManager(
      mockSvn,
      ConstructorPolicy.Async,
      mockContext
    );

    await sourceControlManager.isInitialized;

    // Mock isSvnFolder to return true for all paths
    const originalIsSvnFolder = require("../util").isSvnFolder;
    require("../util").isSvnFolder = async () => true;

    // Mock Repository constructor
    const mockRepositories: any[] = [];
    const originalRepository = require("../repository").Repository;
    require("../repository").Repository = class MockRepository {
      workspaceRoot: string;
      sourceControl: any;
      changes: any;
      onDidChangeState: any;
      onDidChangeRepository: any;
      onDidChangeStatus: any;
      statusExternal: any[];
      statusIgnored: any[];

      constructor(svnRepo: any) {
        this.workspaceRoot = svnRepo.workspaceRoot;
        this.sourceControl = { id: `mock-${svnRepo.workspaceRoot}` };
        this.changes = { id: `changes-${svnRepo.workspaceRoot}` };

        // Add missing status properties
        this.statusExternal = [];
        this.statusIgnored = [];

        // Create proper event emitters that match the expected interface
        this.onDidChangeState = (_listener: any) => {
          return { dispose: () => {} };
        };
        this.onDidChangeRepository = (_listener: any) => {
          return { dispose: () => {} };
        };
        this.onDidChangeStatus = (_listener: any) => {
          return { dispose: () => {} };
        };
        mockRepositories.push(this);
      }

      dispose() {
        // Proper dispose method
      }
    };

    try {
      // Test hierarchical structure: root project with multiple sub-projects
      const rootPath = "/workspace/monorepo";
      const childPaths = [
        "/workspace/monorepo/frontend",
        "/workspace/monorepo/backend",
        "/workspace/monorepo/shared"
      ];

      // Open root repository first
      await sourceControlManager.tryOpenRepository(rootPath);

      // Open child repositories
      for (const childPath of childPaths) {
        await sourceControlManager.tryOpenRepository(childPath);
      }

      // Verify all repositories are opened
      const expectedTotal = 1 + childPaths.length; // root + children
      assert.strictEqual(
        sourceControlManager.repositories.length,
        expectedTotal,
        `Should have ${expectedTotal} repositories (1 root + ${childPaths.length} children)`
      );

      // Verify all expected paths are present
      const repoPaths = sourceControlManager.repositories.map(repo => repo.workspaceRoot).sort();
      const expectedPaths = [rootPath, ...childPaths].sort();
      assert.deepStrictEqual(repoPaths, expectedPaths, "Repository paths should match expected hierarchy");

    } finally {
      // Restore original functions
      require("../util").isSvnFolder = originalIsSvnFolder;
      require("../repository").Repository = originalRepository;
    }
  });

  teardown(() => {
    try {
      if (sourceControlManager && typeof sourceControlManager.dispose === "function") {
        sourceControlManager.dispose();
      }
    } catch (error) {
      // Ignore disposal errors in tests
    }
  });
});