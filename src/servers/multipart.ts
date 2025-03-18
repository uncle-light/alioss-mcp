import fs from "fs";
import { AliOssServer } from "./alioss";

export class MultipartUploadManager {
  constructor(private ossServer: AliOssServer) {}

  /**
   * 初始化分片上传
   * @param fileName OSS文件名
   * @returns 上传ID和文件名
   */
  async initMultipartUpload(fileName: string) {
    try {
      const result = await this.ossServer["ossClient"].initMultipartUpload(
        fileName
      );
      if (result.res.status === 200) {
        return {
          uploadId: result.uploadId,
          name: result.name,
        };
      }
      return null;
    } catch (error) {
      console.error("Init multipart upload error:", error);
      return null;
    }
  }

  /**
   * 上传文件分片
   * @param fileName OSS文件名
   * @param uploadId 上传ID
   * @param partNo 分片序号
   * @param filePath 本地文件路径
   * @param start 开始位置
   * @param end 结束位置
   * @returns 分片信息
   */
  async uploadPart(
    fileName: string,
    uploadId: string,
    partNo: number,
    filePath: string,
    start: number,
    end: number
  ) {
    try {
      const fileSize = fs.statSync(filePath).size;
      const endPos = Math.min(end, fileSize);
      const result = await this.ossServer["ossClient"].uploadPart(
        fileName,
        uploadId,
        partNo,
        filePath,
        start,
        endPos
      );
      if (result.res.status === 200) {
        return {
          etag: result.etag,
          number: partNo,
        };
      }
      return null;
    } catch (error) {
      console.error("Upload part error:", error);
      return null;
    }
  }

  /**
   * 完成分片上传
   * @param fileName OSS文件名
   * @param uploadId 上传ID
   * @param parts 分片信息列表
   * @returns 完成结果
   */
  async completeMultipartUpload(
    fileName: string,
    uploadId: string,
    parts: Array<{ number: number; etag: string }>
  ) {
    try {
      const result = await this.ossServer["ossClient"].completeMultipartUpload(
        fileName,
        uploadId,
        parts
      );
      if (result.res.status === 200) {
        return {
          name: result.name,
          etag: result.etag,
        };
      }
      return null;
    } catch (error) {
      console.error("Complete multipart upload error:", error);
      return null;
    }
  }

  /**
   * 一步完成分片上传（自动处理分片）
   * @param fileName OSS文件名
   * @param filePath 本地文件路径
   * @param partSize 分片大小（字节）
   * @returns 上传结果
   */
  async multipartUpload(
    fileName: string,
    filePath: string,
    partSize = 1024 * 1024
  ) {
    try {
      const options = {
        partSize,
        progress: (p: number) => {
          console.log(`上传进度: ${(p * 100).toFixed(2)}%`);
        },
      };

      const result = await this.ossServer["ossClient"].multipartUpload(
        fileName,
        filePath,
        options
      );
      if (result.res.status === 200) {
        return {
          name: result.name,
          etag: result.etag,
        };
      }
      return null;
    } catch (error) {
      console.error("Multipart upload error:", error);
      return null;
    }
  }

  /**
   * 取消分片上传
   * @param fileName OSS文件名
   * @param uploadId 上传ID
   * @returns 是否成功
   */
  async abortMultipartUpload(fileName: string, uploadId: string) {
    try {
      const result = await this.ossServer["ossClient"].abortMultipartUpload(
        fileName,
        uploadId
      );
      return result && result.status === 204;
    } catch (error) {
      console.error("Abort multipart upload error:", error);
      return false;
    }
  }

  /**
   * 列出所有未完成的分片上传
   * @param prefix 文件名前缀
   * @param maxUploads 最大返回数量
   * @returns 未完成的上传列表
   */
  async listUploads(prefix?: string, maxUploads?: number) {
    try {
      const options: { prefix?: string; maxUploads?: number } = {};
      if (prefix) options.prefix = prefix;
      if (maxUploads) options.maxUploads = maxUploads;

      const result = await this.ossServer["ossClient"].listUploads(options);
      if (result.res.status === 200) {
        return {
          uploads: result.uploads,
          isTruncated: result.isTruncated,
          nextKeyMarker: result.nextKeyMarker,
          nextUploadIdMarker: result.nextUploadIdMarker,
        };
      }
      return null;
    } catch (error) {
      console.error("List uploads error:", error);
      return null;
    }
  }
}
