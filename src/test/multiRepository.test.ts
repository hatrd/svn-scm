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

  test("should allow multiple repositories in parent-child hierarchy", async () => {
    // Create source control manager
    sourceControlManager = new SourceControlManager(
      mockSvn,
      ConstructorPolicy.Async,
      mockContext
    );

    await sourceControlManager.isInitialized;

    // Simulate multiple repositories in hierarchy with generic names
    const rootPath = "/workspace/project";
    const childPaths = [
      "/workspace/project/frontend",
      "/workspace/project/backend",
      "/workspace/project/shared"
    ];

    // Mock isSvnFolder to return true for all paths
    const originalIsSvnFolder = require("../util").isSvnFolder;
    require("../util").isSvnFolder = async () => true;

    try {
      // Try opening root repository
      await sourceControlManager.tryOpenRepository(rootPath);

      // Try opening child repositories
      for (const childPath of childPaths) {
        await sourceControlManager.tryOpenRepository(childPath);
      }

      // Verify all repositories are opened
      const repositories = sourceControlManager.repositories;
      assert.strictEqual(repositories.length, 4, "Should have 4 repositories (1 root + 3 children)");

      // Verify repository paths
      const repoPaths = repositories.map(repo => repo.workspaceRoot).sort();
      const expectedPaths = [rootPath, ...childPaths].sort();
      assert.deepStrictEqual(repoPaths, expectedPaths, "Repository paths should match expected paths");

    } finally {
      // Restore original function
      require("../util").isSvnFolder = originalIsSvnFolder;
    }
  });

  test("should find most specific repository when multiple folders enabled", async () => {
    // Mock configuration to enable multiple folders
    const originalGet = require("../helpers/configuration").configuration.get;
    require("../helpers/configuration").configuration.get = (key: string, defaultValue?: any) => {
      if (key === "multipleFolders.enabled") return true;
      if (key === "detectExternals") return false;
      if (key === "detectIgnored") return false;
      return defaultValue;
    };

    try {
      sourceControlManager = new SourceControlManager(
        mockSvn,
        ConstructorPolicy.Async,
        mockContext
      );

      await sourceControlManager.isInitialized;

      // Mock repositories with generic paths
      const rootRepo = { workspaceRoot: "/workspace/project" };
      const childRepo = { workspaceRoot: "/workspace/project/frontend" };

      sourceControlManager.openRepositories = [
        { repository: rootRepo as any, dispose: () => {} },
        { repository: childRepo as any, dispose: () => {} }
      ];

      // Test file in child repository
      const testFile = Uri.file("/workspace/project/frontend/src/index.js");
      const result = sourceControlManager.getOpenRepository(testFile);

      // Should return the most specific repository (child)
      assert.strictEqual(result?.repository, childRepo, "Should return child repository for child file");

    } finally {
      // Restore original configuration
      require("../helpers/configuration").configuration.get = originalGet;
    }
  });

  test("should respect external and ignored filtering configuration", async () => {
    // Mock configuration with external/ignored detection disabled
    const originalGet = require("../helpers/configuration").configuration.get;
    require("../helpers/configuration").configuration.get = (key: string, defaultValue?: any) => {
      if (key === "multipleFolders.enabled") return true;
      if (key === "detectExternals") return false;
      if (key === "detectIgnored") return false;
      return defaultValue;
    };

    try {
      sourceControlManager = new SourceControlManager(
        mockSvn,
        ConstructorPolicy.Async,
        mockContext
      );

      await sourceControlManager.isInitialized;

      // Mock repository with externals and ignored files
      const mockRepo = {
        workspaceRoot: "/workspace/project",
        statusExternal: [{ path: "vendor" }],
        statusIgnored: [{ path: "build.log" }]
      };

      sourceControlManager.openRepositories = [
        { repository: mockRepo as any, dispose: () => {} }
      ];

      // Test file in external path (should still be found when detection is disabled)
      const externalFile = Uri.file("/workspace/project/vendor/library.js");
      const result = sourceControlManager.getOpenRepository(externalFile);

      // Should return repository even for external file when detection is disabled
      assert.strictEqual(result?.repository, mockRepo, "Should return repository for external file when detection disabled");

    } finally {
      // Restore original configuration
      require("../helpers/configuration").configuration.get = originalGet;
    }
  });

  test("should not duplicate repositories with same workspace root", async () => {
    sourceControlManager = new SourceControlManager(
      mockSvn,
      ConstructorPolicy.Async,
      mockContext
    );

    await sourceControlManager.isInitialized;

    const samePath = "/workspace/project";

    // Mock isSvnFolder to return true
    const originalIsSvnFolder = require("../util").isSvnFolder;
    require("../util").isSvnFolder = async () => true;

    try {
      // Try opening same repository twice
      await sourceControlManager.tryOpenRepository(samePath);
      await sourceControlManager.tryOpenRepository(samePath);

      // Should only have one repository
      const repositories = sourceControlManager.repositories;
      assert.strictEqual(repositories.length, 1, "Should have only 1 repository despite multiple open attempts");
      assert.strictEqual(repositories[0].workspaceRoot, samePath, "Repository path should match");

    } finally {
      // Restore original function
      require("../util").isSvnFolder = originalIsSvnFolder;
    }
  });

  test("should handle complex workspace hierarchies", async () => {
    // Test common scenario: monorepo with multiple components
    const paths = [
      "/workspace",                    // Root
      "/workspace/apps",               // Apps folder
      "/workspace/apps/web",           // Web app
      "/workspace/apps/mobile",        // Mobile app
      "/workspace/libs",               // Shared libraries
      "/workspace/libs/ui",            // UI library
      "/workspace/tools"               // Development tools
    ];

    // Mock configuration
    const originalGet = require("../helpers/configuration").configuration.get;
    require("../helpers/configuration").configuration.get = (key: string, defaultValue?: any) => {
      if (key === "multipleFolders.enabled") return true;
      if (key === "multipleFolders.depth") return 5;
      return defaultValue;
    };

    const originalIsSvnFolder = require("../util").isSvnFolder;
    require("../util").isSvnFolder = async () => true;

    try {
      sourceControlManager = new SourceControlManager(
        mockSvn,
        ConstructorPolicy.Async,
        mockContext
      );

      await sourceControlManager.isInitialized;

      // Open all repositories
      for (const path of paths) {
        await sourceControlManager.tryOpenRepository(path);
      }

      // Verify all are detected
      const repositories = sourceControlManager.repositories;
      assert.ok(repositories.length > 0, "Should detect repositories");

      // Each repository should have unique workspace root
      const uniquePaths = new Set(repositories.map(r => r.workspaceRoot));
      assert.strictEqual(uniquePaths.size, repositories.length, "All repositories should have unique paths");

    } finally {
      // Restore original functions
      require("../helpers/configuration").configuration.get = originalGet;
      require("../util").isSvnFolder = originalIsSvnFolder;
    }
  });

  teardown(() => {
    if (sourceControlManager && typeof sourceControlManager.dispose === "function") {
      sourceControlManager.dispose();
    }
  });
});