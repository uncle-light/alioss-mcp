#!/usr/bin/env node

import { config } from "dotenv";
import AliOssMcpServer from "./server";
import minimist from "minimist";
import { readFileSync } from "fs";
import { join } from "path";

config();

const args = minimist(process.argv.slice(2));

// 显示帮助信息
if (args.help) {
  console.log(`
阿里云OSS MCP服务器

选项:
  --version                 显示版本号
  --accessKeyId             你的阿里云AccessKeyId
  --accessKeySecret         你的阿里云AccessKeySecret
  --bucket                  你想要操作的OSS存储桶
  --region                  OSS区域位置
  --workingDirectory        本地工作目录（默认为当前目录）
  --port                    服务器运行的端口（默认为3000）
  --stdio                   在命令行模式运行服务器
  --help                    显示此帮助信息
  `);
  process.exit(0);
}

// 显示版本号
if (args.version) {
  // 使用fs和path模块读取package.json
  const packageJsonPath = join(__dirname, "../package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  console.log(`alioss-mcp 版本 ${packageJson.version}`);
  process.exit(0);
}

// 优先使用命令行参数，其次使用环境变量
const accessKeyId = args.accessKeyId || process.env.OSS_ACCESS_KEY_ID;
const accessKeySecret =
  args.accessKeySecret || process.env.OSS_ACCESS_KEY_SECRET;
const bucket = args.bucket || process.env.OSS_BUCKET;
const region = args.region || process.env.OSS_REGION;
const workingDirectory =
  args.workingDirectory || process.env.WORKING_DIRECTORY || process.cwd();
const port = args.port || process.env.PORT || 3000;
const useStdio = args.stdio || false;

if (!accessKeyId || !accessKeySecret || !bucket || !region) {
  console.error(
    "错误: 必须提供以下参数:\n" +
      "命令行参数: --accessKeyId=<accessKeyId> --accessKeySecret=<accessKeySecret> --bucket=<bucket> --region=<region> [--workingDirectory=<workingDirectory>]\n" +
      "或环境变量: OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET, OSS_REGION, [WORKING_DIRECTORY]"
  );
  process.exit(1);
}

console.log("初始化阿里云OSS MCP服务器...");

const server = new AliOssMcpServer(
  accessKeyId,
  accessKeySecret,
  bucket,
  region,
  workingDirectory
);

// 启动服务器
if (useStdio) {
  console.log("以STDIO模式启动服务器");
  server.start(); // STDIO模式
} else {
  console.log(`以HTTP模式启动服务器，监听端口 ${port}`);
  server.startHttpServer(Number(port)); // HTTP模式
}
