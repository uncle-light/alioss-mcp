import { AliOssServer } from "./servers/alioss.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import express, { Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { IncomingMessage, ServerResponse } from "http";
import mime from "mime";
import { MultipartUploadManager } from "./servers/multipart.js";

export const Logger = {
  log: (...args: unknown[]) => {
    console.log(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};

class AliOssMcpServer {
  private aliOssServer: AliOssServer;
  private multipartManager: MultipartUploadManager;
  private server: McpServer;
  private sseTransport: SSEServerTransport | null = null;
  constructor(
    private readonly accessKeyId: string,
    private readonly accessKeySecret: string,
    private readonly bucket: string,
    private readonly region: string,
    private readonly workingDirectory: string
  ) {
    this.accessKeyId = accessKeyId;
    this.accessKeySecret = accessKeySecret;
    this.bucket = bucket;
    this.workingDirectory = workingDirectory;
    this.aliOssServer = new AliOssServer(
      accessKeyId,
      accessKeySecret,
      bucket,
      region
    );
    this.multipartManager = new MultipartUploadManager(this.aliOssServer);
    this.server = new McpServer({
      name: "alioss",
      version: "1.0.0",
    });
    this.registerTools();
    this.registerResources();
  }
  private registerTools() {
    this.server.tool(
      "uploadFile",
      "阿里云OSS上传文件",
      {
        fileName: z.string().describe("指定文件名"),
        file: z.string().describe("指定文件路径"),
      },
      async ({ fileName, file }) => {
        try {
          const filePath = path.join(this.workingDirectory, file);
          console.log("filePath", filePath);

          const result = await this.aliOssServer.uploadFile(fileName, filePath);
          console.log("result", result);

          return {
            content: [
              {
                type: "text",
                text: result as string,
              },
            ],
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            this.server.server.sendLoggingMessage({
              level: "error",
              data: error.message,
            });
            return {
              content: [{ type: "text", text: error.message }],
              isError: true,
            };
          }
          return { content: [{ type: "text", text: "上传失败" }] };
        }
      }
    );

    this.server.tool(
      "downloadFile",
      "阿里云OSS下载文件",
      {
        fileName: z.string().describe("指定要下载的OSS文件名"),
        localPath: z.string().describe("本地保存路径"),
      },
      async ({ fileName, localPath }) => {
        try {
          const content = await this.aliOssServer.downloadFile(fileName);
          if (!content) {
            return {
              content: [
                { type: "text", text: "下载失败，文件不存在或无法访问" },
              ],
              isError: true,
            };
          }

          const savePath = path.join(this.workingDirectory, localPath);
          fs.writeFileSync(savePath, content);

          return {
            content: [
              {
                type: "text",
                text: `文件已下载到 ${savePath}`,
              },
            ],
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            this.server.server.sendLoggingMessage({
              level: "error",
              data: error.message,
            });
            return {
              content: [{ type: "text", text: error.message }],
              isError: true,
            };
          }
          return { content: [{ type: "text", text: "下载失败" }] };
        }
      }
    );

    this.server.tool(
      "listObjects",
      "阿里云OSS列出文件",
      {
        prefix: z.string().optional().describe("文件前缀，可选"),
        maxKeys: z.number().optional().describe("最大返回数量，可选，默认100"),
      },
      async ({ prefix, maxKeys }) => {
        try {
          const result = await this.aliOssServer.listObjects(
            prefix || "",
            maxKeys || 100
          );
          if (!result) {
            return {
              content: [{ type: "text", text: "列出文件失败" }],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            this.server.server.sendLoggingMessage({
              level: "error",
              data: error.message,
            });
            return {
              content: [{ type: "text", text: error.message }],
              isError: true,
            };
          }
          return { content: [{ type: "text", text: "列出文件失败" }] };
        }
      }
    );

    this.server.tool(
      "deleteObject",
      "阿里云OSS删除文件",
      {
        fileName: z.string().describe("指定要删除的OSS文件名"),
      },
      async ({ fileName }) => {
        try {
          const result = await this.aliOssServer.deleteObject(fileName);
          if (!result) {
            return {
              content: [{ type: "text", text: "删除失败" }],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: "text",
                text: `文件 ${fileName} 已成功删除`,
              },
            ],
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            this.server.server.sendLoggingMessage({
              level: "error",
              data: error.message,
            });
            return {
              content: [{ type: "text", text: error.message }],
              isError: true,
            };
          }
          return { content: [{ type: "text", text: "删除失败" }] };
        }
      }
    );

    this.server.tool(
      "getObjectUrl",
      "获取阿里云OSS文件的签名URL",
      {
        fileName: z.string().describe("指定OSS文件名"),
        expires: z.number().optional().describe("URL有效期(秒)，默认3600"),
      },
      async ({ fileName, expires }) => {
        try {
          const result = await this.aliOssServer.getObjectUrl(
            fileName,
            expires || 3600
          );

          return {
            content: [
              {
                type: "text",
                text: result,
              },
            ],
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            this.server.server.sendLoggingMessage({
              level: "error",
              data: error.message,
            });
            return {
              content: [{ type: "text", text: error.message }],
              isError: true,
            };
          }
          return { content: [{ type: "text", text: "获取URL失败" }] };
        }
      }
    );

    this.server.tool(
      "copyObject",
      "阿里云OSS复制文件",
      {
        source: z.string().describe("源文件路径"),
        target: z.string().describe("目标文件路径"),
      },
      async ({ source, target }) => {
        try {
          const result = await this.aliOssServer.copyObject(source, target);
          if (!result) {
            return {
              content: [{ type: "text", text: "复制失败" }],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: "text",
                text: `文件已从 ${source} 复制到 ${target}`,
              },
            ],
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            this.server.server.sendLoggingMessage({
              level: "error",
              data: error.message,
            });
            return {
              content: [{ type: "text", text: error.message }],
              isError: true,
            };
          }
          return { content: [{ type: "text", text: "复制失败" }] };
        }
      }
    );

    this.server.tool(
      "deleteMultipleObjects",
      "批量删除阿里云OSS文件",
      {
        fileNames: z.array(z.string()).describe("要删除的OSS文件名列表"),
      },
      async ({ fileNames }) => {
        try {
          const result = await this.aliOssServer.deleteMultipleObjects(
            fileNames
          );
          if (!result) {
            return {
              content: [{ type: "text", text: "批量删除失败" }],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: "text",
                text: `已成功删除 ${result.deleted?.length || 0} 个文件`,
              },
            ],
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            this.server.server.sendLoggingMessage({
              level: "error",
              data: error.message,
            });
            return {
              content: [{ type: "text", text: error.message }],
              isError: true,
            };
          }
          return { content: [{ type: "text", text: "批量删除失败" }] };
        }
      }
    );

    this.server.tool(
      "putObjectACL",
      "设置阿里云OSS文件的访问权限",
      {
        fileName: z.string().describe("指定OSS文件名"),
        acl: z
          .enum(["public-read", "public-read-write", "private"])
          .describe("访问权限设置"),
      },
      async ({ fileName, acl }) => {
        try {
          const result = await this.aliOssServer.putObjectACL(fileName, acl);
          if (!result) {
            return {
              content: [{ type: "text", text: "设置访问权限失败" }],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: "text",
                text: `文件 ${fileName} 的访问权限已设置为 ${acl}`,
              },
            ],
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            this.server.server.sendLoggingMessage({
              level: "error",
              data: error.message,
            });
            return {
              content: [{ type: "text", text: error.message }],
              isError: true,
            };
          }
          return { content: [{ type: "text", text: "设置访问权限失败" }] };
        }
      }
    );

    this.server.tool(
      "getObjectACL",
      "获取阿里云OSS文件的访问权限",
      {
        fileName: z.string().describe("指定OSS文件名"),
      },
      async ({ fileName }) => {
        try {
          const result = await this.aliOssServer.getObjectACL(fileName);
          if (!result) {
            return {
              content: [{ type: "text", text: "获取访问权限失败" }],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: "text",
                text: `文件 ${fileName} 的访问权限为: ${result.acl}`,
              },
            ],
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            this.server.server.sendLoggingMessage({
              level: "error",
              data: error.message,
            });
            return {
              content: [{ type: "text", text: error.message }],
              isError: true,
            };
          }
          return { content: [{ type: "text", text: "获取访问权限失败" }] };
        }
      }
    );

    this.server.tool(
      "getObjectMeta",
      "获取阿里云OSS文件的元数据",
      {
        fileName: z.string().describe("指定OSS文件名"),
      },
      async ({ fileName }) => {
        try {
          const result = await this.aliOssServer.getObjectMeta(fileName);
          if (!result) {
            return {
              content: [{ type: "text", text: "获取元数据失败" }],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            this.server.server.sendLoggingMessage({
              level: "error",
              data: error.message,
            });
            return {
              content: [{ type: "text", text: error.message }],
              isError: true,
            };
          }
          return { content: [{ type: "text", text: "获取元数据失败" }] };
        }
      }
    );

    this.server.tool(
      "multipartUpload",
      "使用分片上传大文件到阿里云OSS",
      {
        fileName: z.string().describe("指定OSS文件名"),
        filePath: z.string().describe("要上传的本地文件路径"),
        partSize: z.number().optional().describe("分片大小(字节)，默认1MB"),
      },
      async ({ fileName, filePath, partSize }) => {
        try {
          const localFilePath = path.join(this.workingDirectory, filePath);
          if (!fs.existsSync(localFilePath)) {
            return {
              content: [{ type: "text", text: `文件 ${localFilePath} 不存在` }],
              isError: true,
            };
          }

          const result = await this.multipartManager.multipartUpload(
            fileName,
            localFilePath,
            partSize || 1024 * 1024
          );

          if (!result) {
            return {
              content: [{ type: "text", text: "分片上传失败" }],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: "text",
                text: `文件已上传成功，文件名: ${result.name}`,
              },
            ],
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            this.server.server.sendLoggingMessage({
              level: "error",
              data: error.message,
            });
            return {
              content: [{ type: "text", text: error.message }],
              isError: true,
            };
          }
          return { content: [{ type: "text", text: "分片上传失败" }] };
        }
      }
    );

    this.server.tool(
      "initMultipartUpload",
      "初始化分片上传任务",
      {
        fileName: z.string().describe("指定OSS文件名"),
      },
      async ({ fileName }) => {
        try {
          const result = await this.multipartManager.initMultipartUpload(
            fileName
          );

          if (!result) {
            return {
              content: [{ type: "text", text: "初始化分片上传失败" }],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    uploadId: result.uploadId,
                    name: result.name,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            this.server.server.sendLoggingMessage({
              level: "error",
              data: error.message,
            });
            return {
              content: [{ type: "text", text: error.message }],
              isError: true,
            };
          }
          return { content: [{ type: "text", text: "初始化分片上传失败" }] };
        }
      }
    );

    this.server.tool(
      "uploadPart",
      "上传文件分片",
      {
        fileName: z.string().describe("指定OSS文件名"),
        uploadId: z.string().describe("分片上传ID"),
        partNo: z.number().describe("分片序号"),
        filePath: z.string().describe("要上传的本地文件路径"),
        start: z.number().describe("分片起始位置(字节)"),
        end: z.number().describe("分片结束位置(字节)"),
      },
      async ({ fileName, uploadId, partNo, filePath, start, end }) => {
        try {
          const localFilePath = path.join(this.workingDirectory, filePath);
          if (!fs.existsSync(localFilePath)) {
            return {
              content: [{ type: "text", text: `文件 ${localFilePath} 不存在` }],
              isError: true,
            };
          }

          const result = await this.multipartManager.uploadPart(
            fileName,
            uploadId,
            partNo,
            localFilePath,
            start,
            end
          );

          if (!result) {
            return {
              content: [{ type: "text", text: "上传分片失败" }],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            this.server.server.sendLoggingMessage({
              level: "error",
              data: error.message,
            });
            return {
              content: [{ type: "text", text: error.message }],
              isError: true,
            };
          }
          return { content: [{ type: "text", text: "上传分片失败" }] };
        }
      }
    );

    this.server.tool(
      "completeMultipartUpload",
      "完成分片上传",
      {
        fileName: z.string().describe("指定OSS文件名"),
        uploadId: z.string().describe("分片上传ID"),
        parts: z
          .array(
            z.object({
              number: z.number().describe("分片序号"),
              etag: z.string().describe("分片ETag"),
            })
          )
          .describe("已上传的分片信息列表"),
      },
      async ({ fileName, uploadId, parts }) => {
        try {
          const result = await this.multipartManager.completeMultipartUpload(
            fileName,
            uploadId,
            parts
          );

          if (!result) {
            return {
              content: [{ type: "text", text: "完成分片上传失败" }],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: "text",
                text: `分片上传完成，文件名: ${result.name}`,
              },
            ],
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            this.server.server.sendLoggingMessage({
              level: "error",
              data: error.message,
            });
            return {
              content: [{ type: "text", text: error.message }],
              isError: true,
            };
          }
          return { content: [{ type: "text", text: "完成分片上传失败" }] };
        }
      }
    );

    this.server.tool(
      "abortMultipartUpload",
      "取消分片上传",
      {
        fileName: z.string().describe("指定OSS文件名"),
        uploadId: z.string().describe("分片上传ID"),
      },
      async ({ fileName, uploadId }) => {
        try {
          const result = await this.multipartManager.abortMultipartUpload(
            fileName,
            uploadId
          );

          if (!result) {
            return {
              content: [{ type: "text", text: "取消分片上传失败" }],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: "text",
                text: `已成功取消分片上传任务`,
              },
            ],
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            this.server.server.sendLoggingMessage({
              level: "error",
              data: error.message,
            });
            return {
              content: [{ type: "text", text: error.message }],
              isError: true,
            };
          }
          return { content: [{ type: "text", text: "取消分片上传失败" }] };
        }
      }
    );

    this.server.tool(
      "listUploads",
      "列出未完成的分片上传任务",
      {
        prefix: z.string().optional().describe("文件名前缀，可选"),
        maxUploads: z.number().optional().describe("最大返回数量，可选"),
      },
      async ({ prefix, maxUploads }) => {
        try {
          const result = await this.multipartManager.listUploads(
            prefix,
            maxUploads
          );

          if (!result) {
            return {
              content: [{ type: "text", text: "获取未完成上传列表失败" }],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            this.server.server.sendLoggingMessage({
              level: "error",
              data: error.message,
            });
            return {
              content: [{ type: "text", text: error.message }],
              isError: true,
            };
          }
          return {
            content: [{ type: "text", text: "获取未完成上传列表失败" }],
          };
        }
      }
    );
  }

  private registerResources() {
    const files = fs.readdirSync(this.workingDirectory);
    files.forEach((file) => {
      this.server.resource(
        file,
        path.join(this.workingDirectory, file),
        async (uri: URL) => {
          const mimeType = mime.getType(file);
          const fileContent = fs.readFileSync(path.join(uri.toString()));
          return {
            contents: [
              {
                uri: uri.toString(),
                // blob: Buffer.from(fileContent).toString("base64"),
                text: fileContent.toString("base64"),
                mimeType: mimeType || "application/octet-stream",
              },
            ],
          };
        }
      );
    });
  }

  // async connect(transport: Transport): Promise<void> {
  //   // Logger.log("Connecting to transport...");
  //   await this.server.connect(transport);

  //   Logger.log = (...args: any[]) => {
  //     this.server.server.sendLoggingMessage({
  //       level: "info",
  //       data: args,
  //     });
  //   };
  //   Logger.error = (...args: any[]) => {
  //     this.server.server.sendLoggingMessage({
  //       level: "error",
  //       data: args,
  //     });
  //   };

  //   Logger.log("Server connected and ready to process requests");
  // }

  async start() {
    const transport = new StdioServerTransport();
    this.server.connect(transport);
  }
  startHttpServer(port: number) {
    const app = express();

    app.get("/sse", async (req: Request, res: Response) => {
      console.log("New SSE connection established");
      this.sseTransport = new SSEServerTransport(
        "/messages",
        res as unknown as ServerResponse<IncomingMessage>
      );
      await this.server.connect(this.sseTransport);
    });

    app.post("/messages", async (req: Request, res: Response) => {
      if (!this.sseTransport) {
        // @ts-expect-error - Express类型定义问题
        res.status(400).send("No SSE connection established");
        return;
      }
      await this.sseTransport.handlePostMessage(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse<IncomingMessage>
      );
    });

    app.listen(port, () => {
      console.log(`HTTP server listening on port ${port}`);
    });
  }
}

export default AliOssMcpServer;
