import { z } from 'zod/v4'
// src/utils/tools/toolRegistry.ts
// import { z } from 'zod/v4'
import { createTextFile } from './core/createFile'
import { deleteFile, safeDeleteFile } from './core/deleteFile'
import { editFile } from './core/editFile'
import { extractDirectoryStructure } from './core/getDirectoryTree'
import { readTextFile } from './core/readFile'
import { readMultipleTextFiles } from './core/readFiles'
// export const directoryTool = tool({
//   description:
//     'Get the directory structure of a specified path. Useful for understanding project organization, finding files, or exploring codebases.',
//   parameters: z.object({
//     path: z.string().describe('The directory path to analyze (absolute or relative)'),
//   }),
//   execute: async ({ path }) => {
//     try {
//       const structure = await extractDirectoryStructure(path)
//       return {
//         success: true,
//         structure,
//         path: path,
//       }
//     } catch (error) {
//       return {
//         success: false,
//         error: error instanceof Error ? error.message : 'Unknown error occurred',
//         path: path,
//       }
//     }
//   },
// })

// export const tools = {
//   getDirectory: directoryTool,
// }

interface tools {
  name: string
  tool: {
    description: string
    inputSchema: any
    execute: any
  }
}

const tools: tools[] = [
  {
    name: 'weather',
    tool: {
      description: 'Get the weather in a location',
      inputSchema: z.object({
        location: z.string().describe('The location to get the weather for'),
      }),
      execute: async ({ location }: { location: string }) => ({
        location,
        temperature: 72 + Math.floor(Math.random() * 21) - 1000,
      }),
    },
  },
  {
    name: 'directory',
    tool: {
      description:
        'Get the directory structure of a specified path. Useful for understanding project organization, finding files, or exploring codebases.',
      inputSchema: z.object({
        path: z.string().describe('The directory path to analyze (absolute or relative)'),
      }),
      execute: async ({ path }: { path: string }) => {
        try {
          const structure = await extractDirectoryStructure(path)
          return {
            success: true,
            structure,
            path: path,
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            path: path,
          }
        }
      },
    },
  },
  {
    name: 'read_file',
    tool: {
      description:
        'Read the contents of a text file (code, config, docs). Rejects likely-binary files and truncates large files for safety.',
      inputSchema: z.object({
        path: z.string().describe('The file path to read (absolute or relative)'),
        maxBytes: z
          .number()
          .int()
          .min(1)
          .max(5 * 1024 * 1024)
          .optional()
          .describe('Optional safety limit on bytes to read; defaults to 204800 (200KB).'),
      }),
      execute: async ({ path, maxBytes }: { path: string; maxBytes?: number }) => {
        try {
          const res = await readTextFile(path, { maxBytes })
          return {
            success: true,
            path,
            absolutePath: res.absolutePath,
            sizeBytes: res.sizeBytes,
            truncated: res.truncated,
            content: res.content,
          }
        } catch (error) {
          return {
            success: false,
            path,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
          }
        }
      },
    },
  },
  {
    name: 'read_files',
    tool: {
      description:
        "Read multiple text/code/config files and return a single concatenated string, separated by each file's relative path header.",
      inputSchema: z.object({
        paths: z.array(z.string()).nonempty().describe('Array of file paths to read (absolute or relative).'),
        baseDir: z.string().optional().describe('Optional base directory used to compute the relative path header.'),
        maxBytes: z
          .number()
          .int()
          .min(1)
          .max(5 * 1024 * 1024)
          .optional()
          .describe('Optional per-file safety limit on bytes to read; defaults to 204800 (200KB).'),
      }),
      execute: async ({ paths, baseDir, maxBytes }: { paths: string[]; baseDir?: string; maxBytes?: number }) => {
        try {
          const res = await readMultipleTextFiles(paths, { baseDir, maxBytes })
          return {
            success: true,
            combined: res.combined,
            files: res.files,
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
          }
        }
      },
    },
  },
  {
    name: 'create_file',
    tool: {
      description: 'Create a new text file with optional parent directory creation and overwrite support.',
      inputSchema: z.object({
        path: z.string().describe('File path to create (absolute or relative).'),
        content: z.string().optional().describe('Initial content to write to the file; defaults to empty.'),
        directory: z.string().optional().describe('Optional base directory; resolved when path is relative.'),
        createParentDirs: z
          .boolean()
          .optional()
          .describe('If true, create parent directories as needed (default true).'),
        overwrite: z.boolean().optional().describe('If true, overwrite existing file (default false).'),
        executable: z.boolean().optional().describe('If true, make the file executable on POSIX systems.'),
      }),
      execute: async ({ path, content, directory, createParentDirs, overwrite, executable }: any) => {
        try {
          const res = await createTextFile(path, content ?? '', { directory, createParentDirs, overwrite, executable })
          return res
        } catch (error) {
          return {
            success: false,
            absolutePath: '',
            created: false,
            sizeBytes: 0,
            message: error instanceof Error ? error.message : 'Unknown error occurred',
          }
        }
      },
    },
  },
  {
    name: 'delete_file',
    tool: {
      description: 'Delete a file at the specified path. Optionally restrict deletions to specific file extensions.',
      inputSchema: z.object({
        path: z.string().describe('File path to delete (absolute or relative).'),
        allowedExtensions: z
          .array(z.string())
          .optional()
          .describe('Optional array of allowed file extensions (e.g., .txt, .json).'),
      }),
      execute: async ({ path, allowedExtensions }: any) => {
        try {
          if (allowedExtensions && Array.isArray(allowedExtensions) && allowedExtensions.length > 0) {
            await safeDeleteFile(path, allowedExtensions)
          } else {
            await deleteFile(path)
          }

          return {
            success: true,
            path,
          }
        } catch (error) {
          return {
            success: false,
            path,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
          }
        }
      },
    },
  },
  {
    name: 'edit_file',
    tool: {
      description:
        'Edit a file using search and replace operations or append content. Supports replacing all occurrences, first occurrence only, or appending.',
      inputSchema: z.object({
        path: z.string().describe('The path to the file to edit'),
        operation: z.enum(['replace', 'replace_first', 'append']).describe('Type of edit operation'),
        searchPattern: z.string().optional().describe('The text pattern to find (required for replace operations)'),
        replacement: z.string().optional().describe('The replacement text (required for replace operations)'),
        content: z.string().optional().describe('Content to append (required for append operation)'),
        createBackup: z.boolean().optional().describe('Whether to create a backup before editing (default false)'),
        encoding: z.string().optional().describe('File encoding (default utf8)'),
      }),
      execute: async ({ path, operation, searchPattern, replacement, content, createBackup, encoding }: any) => {
        return await editFile(path, operation, {
          searchPattern,
          replacement,
          content,
          createBackup,
          encoding,
        })
      },
    },
  },
]

export default tools
