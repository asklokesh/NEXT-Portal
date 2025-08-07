/**
 * Global Teardown for Visual Regression Tests
 * 
 * This teardown cleans up test server and resources
 * after visual regression tests complete.
 */
import { FullConfig } from '@playwright/test';
import { ChildProcess } from 'child_process';

async function cleanupTestDatabase(): Promise<void> {
  try {
    const { PrismaClient } = await import('@prisma/client');
    
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
        },
      },
    });

    // Clean up test data
    await prisma.pluginInstallation.deleteMany({
      where: {
        id: {
          startsWith: 'visual-',
        },
      },
    });

    await prisma.pluginDependency.deleteMany({
      where: {
        id: {
          startsWith: 'visual-',
        },
      },
    });

    await prisma.plugin.deleteMany({
      where: {
        id: {
          startsWith: 'visual-',
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          startsWith: 'visual-test-',
        },
      },
    });

    await prisma.$disconnect();
    console.log('✅ Visual test database cleanup completed');
  } catch (error) {
    console.warn('⚠️ Failed to cleanup test database:', error);
  }
}

async function stopTestServer(): Promise<void> {
  const serverProcess: ChildProcess = (global as any).__SERVER_PROCESS__;
  
  if (serverProcess) {
    console.log('🛑 Stopping test server...');
    
    try {
      // Send SIGTERM first
      serverProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('⚠️ Server did not stop gracefully, forcing shutdown...');
          serverProcess.kill('SIGKILL');
          resolve();
        }, 10000);
        
        serverProcess.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      
      console.log('✅ Test server stopped');
    } catch (error) {
      console.error('❌ Failed to stop server gracefully:', error);
      
      // Force kill if graceful shutdown failed
      try {
        serverProcess.kill('SIGKILL');
        console.log('✅ Test server force-stopped');
      } catch (killError) {
        console.error('❌ Failed to force-stop server:', killError);
      }
    }
  }
}

async function generateVisualTestReport(): Promise<void> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Check if test results exist
    const resultsPath = path.resolve('./tests/visual/test-results.json');
    
    try {
      const results = JSON.parse(await fs.readFile(resultsPath, 'utf-8'));
      
      // Generate summary report
      const summary = {
        timestamp: new Date().toISOString(),
        totalTests: results.stats?.total || 0,
        passedTests: results.stats?.expected || 0,
        failedTests: results.stats?.unexpected || 0,
        skippedTests: results.stats?.skipped || 0,
        flakyTests: results.stats?.flaky || 0,
        duration: results.stats?.duration || 0,
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        screenshots: {
          baseline: './tests/visual/screenshots/baseline',
          actual: './tests/visual/screenshots/actual',
          diff: './tests/visual/screenshots/diff',
        },
      };
      
      await fs.writeFile(
        path.resolve('./tests/visual/visual-test-summary.json'),
        JSON.stringify(summary, null, 2)
      );
      
      console.log('✅ Visual test summary generated');
      console.log(`📊 Tests: ${summary.totalTests} total, ${summary.passedTests} passed, ${summary.failedTests} failed`);
      
      if (summary.failedTests > 0) {
        console.log('❌ Some visual tests failed. Check the HTML report for details.');
      }
    } catch (readError) {
      console.warn('⚠️ No test results found, skipping report generation');
    }
  } catch (error) {
    console.warn('⚠️ Failed to generate visual test report:', error);
  }
}

async function archiveScreenshots(): Promise<void> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Create timestamp for archival
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveDir = path.resolve(`./tests/visual/archives/${timestamp}`);
    
    // Copy current screenshots to archive
    await fs.mkdir(archiveDir, { recursive: true });
    
    const screenshotDirs = ['actual', 'diff'];
    
    for (const dirName of screenshotDirs) {
      const sourceDir = path.resolve(`./tests/visual/screenshots/${dirName}`);
      const targetDir = path.resolve(`${archiveDir}/${dirName}`);
      
      try {
        await fs.mkdir(targetDir, { recursive: true });
        
        const files = await fs.readdir(sourceDir);
        for (const file of files) {
          const sourcePath = path.join(sourceDir, file);
          const targetPath = path.join(targetDir, file);
          await fs.copyFile(sourcePath, targetPath);
        }
        
        console.log(`✅ Archived ${files.length} files from ${dirName}/`);
      } catch (error) {
        // Directory might not exist, that's okay
      }
    }
    
    // Clean up old archives (keep last 10)
    const archivesDir = path.resolve('./tests/visual/archives');
    try {
      const archives = await fs.readdir(archivesDir);
      if (archives.length > 10) {
        const sortedArchives = archives.sort().reverse();
        const oldArchives = sortedArchives.slice(10);
        
        for (const oldArchive of oldArchives) {
          const oldArchivePath = path.join(archivesDir, oldArchive);
          await fs.rm(oldArchivePath, { recursive: true, force: true });
        }
        
        console.log(`✅ Cleaned up ${oldArchives.length} old archives`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to cleanup old archives:', error);
    }
  } catch (error) {
    console.warn('⚠️ Failed to archive screenshots:', error);
  }
}

async function globalTeardown(config: FullConfig): Promise<void> {
  console.log('🧹 Cleaning up visual regression test environment...');
  
  try {
    // Generate test report and archive screenshots
    await generateVisualTestReport();
    await archiveScreenshots();
    
    // Cleanup test data
    await cleanupTestDatabase();
    
    // Stop test server
    await stopTestServer();
    
    console.log('✅ Visual regression test teardown completed');
  } catch (error) {
    console.error('❌ Visual test teardown failed:', error);
    throw error;
  }
}

export default globalTeardown;