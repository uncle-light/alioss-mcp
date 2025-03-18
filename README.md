# 阿里云OSS MCP 服务器

[![NPM version](https://img.shields.io/npm/v/alioss-mcp.svg?style=flat-square)](https://npmjs.org/package/alioss-mcp)

为 [Cursor](https://cursor.sh/)、[Windsurf](https://codeium.com/windsurf)、[Cline](https://cline.bot/) 和其他AI编码工具提供阿里云OSS访问能力的 [Model Context Protocol](https://modelcontextprotocol.io/introduction) 服务器。

通过这个MCP服务器，AI编码工具可以直接操作阿里云OSS存储，上传、下载、管理文件，无需手动处理繁琐的存储操作。

## 快速开始

```bash
npx alioss-mcp --accessKeyId=YOUR_KEY --accessKeySecret=YOUR_SECRET --bucket=YOUR_BUCKET --region=YOUR_REGION --workingDirectory=/path/to/your/workspace
```

## 安装方式

### 使用NPM快速运行

你可以不需要安装或构建仓库，直接通过NPM运行服务器：

```bash
npx alioss-mcp --accessKeyId=YOUR_KEY --accessKeySecret=YOUR_SECRET --bucket=YOUR_BUCKET --region=YOUR_REGION --workingDirectory=/path/to/your/workspace
# 或者
pnpx alioss-mcp --accessKeyId=YOUR_KEY --accessKeySecret=YOUR_SECRET --bucket=YOUR_BUCKET --region=YOUR_REGION --workingDirectory=/path/to/your/workspace
# 或者
yarn dlx alioss-mcp --accessKeyId=YOUR_KEY --accessKeySecret=YOUR_SECRET --bucket=YOUR_BUCKET --region=YOUR_REGION --workingDirectory=/path/to/your/workspace
```

**注意：** `workingDirectory` 参数是可选的，默认为当前工作目录。它指定了本地操作文件的根目录，如上传和下载文件时的相对路径基准。

### 对于使用配置文件的工具

许多工具如Windsurf、Cline和[Claude Desktop](https://claude.ai/download)使用配置文件启动服务器。`alioss-mcp`服务器可以通过在配置文件中添加以下内容来配置：

```json
{
  "mcpServers": {
    "alioss-mcp": {
      "command": "npx",
      "args": ["-y", "alioss-mcp", "--stdio"],
      "env": {
        "OSS_ACCESS_KEY_ID": "YOUR_KEY",
        "OSS_ACCESS_KEY_SECRET": "YOUR_SECRET",
        "OSS_BUCKET": "YOUR_BUCKET",
        "OSS_REGION": "YOUR_REGION",
        "WORKING_DIRECTORY": "/path/to/your/workspace"
      }
    }
  }
}
```

## 配置选项

服务器可以使用环境变量（通过`.env`文件）或命令行参数进行配置。命令行参数优先于环境变量。

### 环境变量

- `OSS_ACCESS_KEY_ID`: 你的阿里云AccessKeyId（必需）
- `OSS_ACCESS_KEY_SECRET`: 你的阿里云AccessKeySecret（必需）
- `OSS_BUCKET`: 你想要操作的OSS存储桶（必需）
- `OSS_REGION`: OSS区域位置，如`oss-cn-beijing`（必需）
- `WORKING_DIRECTORY`: 本地工作目录（可选，默认为当前目录）
- `PORT`: 服务器运行的端口（可选，默认为3000）

### 命令行参数

- `--version`: 显示版本号
- `--accessKeyId`: 你的阿里云AccessKeyId
- `--accessKeySecret`: 你的阿里云AccessKeySecret
- `--bucket`: 你想要操作的OSS存储桶
- `--region`: OSS区域位置
- `--workingDirectory`: 本地工作目录，所有本地文件操作的基准路径
- `--stdio`: 在命令行模式运行服务器，而非默认的HTTP/SSE模式
- `--help`: 显示帮助菜单

## 与Cursor连接

### 启动服务器

```bash
> npx alioss-mcp --accessKeyId=YOUR_KEY --accessKeySecret=YOUR_SECRET --bucket=YOUR_BUCKET --region=YOUR_REGION --workingDirectory=/path/to/your/workspace
# 初始化阿里云OSS MCP服务器...
# HTTP服务器监听端口3000
# SSE端点可在http://localhost:3000/sse访问
# 消息端点可在http://localhost:3000/messages访问
```

### 连接Cursor到MCP服务器

服务器运行后，在Cursor的设置中找到features选项卡，[连接Cursor到MCP服务器](https://docs.cursor.com/context/model-context-protocol)。

## 可用工具

服务器提供以下MCP工具：

### 基本对象操作

- `uploadFile`: 上传文件到OSS
- `downloadFile`: 从OSS下载文件
- `listObjects`: 列出OSS中的文件
- `deleteObject`: 删除OSS中的文件
- `getObjectUrl`: 获取OSS文件的签名URL
- `copyObject`: 在OSS中复制文件
- `getObjectMeta`: 获取OSS文件的元数据

### 批量和访问控制操作

- `deleteMultipleObjects`: 批量删除多个OSS文件
- `putObjectACL`: 设置OSS文件的访问权限
- `getObjectACL`: 获取OSS文件的访问权限

### 分片上传功能

- `multipartUpload`: 一步完成分片上传（自动处理分片）
- `initMultipartUpload`: 初始化分片上传任务
- `uploadPart`: 上传文件分片
- `completeMultipartUpload`: 完成分片上传
- `abortMultipartUpload`: 取消分片上传
- `listUploads`: 列出未完成的分片上传任务

## 示例用法

### 上传文件

```
上传一个本地文件到OSS

uploadFile(ossPath: "example/test.jpg", localPath: "local/path/to/image.jpg")
```

注意：文件路径 `local/path/to/image.jpg` 是相对于 `workingDirectory` 的路径。

### 下载文件

```
从OSS下载文件到本地

downloadFile(ossPath: "example/test.jpg", localPath: "local/download/image.jpg")
```

注意：文件路径 `local/download/image.jpg` 是相对于 `workingDirectory` 的路径。

### 列出文件

```
列出OSS存储桶中的文件

listObjects(prefix: "example/", maxKeys: 50)
```

### 使用分片上传大文件

```
初始化分片上传
const initResult = initMultipartUpload(objectName: "large-file.zip")

上传各个分片
const part1 = uploadPart(objectName: "large-file.zip", uploadId: initResult.uploadId, partNumber: 1, 
                         localPath: "local/large-file.zip", start: 0, end: 5242880)
const part2 = uploadPart(objectName: "large-file.zip", uploadId: initResult.uploadId, partNumber: 2, 
                         localPath: "local/large-file.zip", start: 5242880, end: 10485760)

完成分片上传
completeMultipartUpload(objectName: "large-file.zip", uploadId: initResult.uploadId, parts: [part1, part2])
```

注意：文件路径 `local/large-file.zip` 是相对于 `workingDirectory` 的路径。

### 一步完成分片上传

```
使用自动分片上传大文件

multipartUpload(objectName: "large-file.zip", localPath: "local/large-file.zip", partSize: 2097152)
```

注意：文件路径 `local/large-file.zip` 是相对于 `workingDirectory` 的路径。

## 贡献

欢迎通过GitHub Issues和Pull Requests进行贡献。

## 许可证

[MIT](LICENSE) 