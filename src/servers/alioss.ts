import OSS from "ali-oss";
import path from "path";

export class AliOssServer {
  private ossClient: OSS;
  constructor(
    private readonly accessKeyId: string,
    private readonly accessKeySecret: string,
    private readonly bucket: string,
    private readonly region: string = "oss-cn-beijing"
  ) {
    this.ossClient = new OSS({
      accessKeyId: this.accessKeyId,
      accessKeySecret: this.accessKeySecret,
      bucket: this.bucket,
      region: this.region,
    });
  }

  async uploadFile(fileName: string, file: string) {
    const result = await this.ossClient.put(fileName, path.normalize(file));
    if (result.res.status === 200) {
      return result.url;
    }
    return null;
  }

  async downloadFile(fileName: string) {
    const result = await this.ossClient.get(fileName);
    if (result.res.status === 200) {
      return result.content;
    }
    return null;
  }

  async listObjects(prefix: string = "", maxKeys: number = 100) {
    const result = await this.ossClient.list(
      {
        prefix,
        "max-keys": maxKeys,
      },
      {}
    );
    if (result.res.status === 200) {
      return {
        objects: result.objects,
        prefixes: result.prefixes,
        nextMarker: result.nextMarker,
        isTruncated: result.isTruncated,
      };
    }
    return null;
  }

  async deleteObject(fileName: string) {
    const result = await this.ossClient.delete(fileName);
    if (result.res.status === 204) {
      return true;
    }
    return false;
  }

  async deleteMultipleObjects(fileNames: string[]) {
    const result = await this.ossClient.deleteMulti(fileNames);
    if (result.res.status === 200) {
      return {
        deleted: result.deleted,
      };
    }
    return null;
  }

  async getObjectUrl(fileName: string, expires: number = 3600) {
    return this.ossClient.signatureUrl(fileName, { expires });
  }

  async getObjectMeta(fileName: string) {
    const result = await this.ossClient.head(fileName);
    if (result.res.status === 200) {
      return {
        meta: result.meta,
        headers: result.res.headers,
      };
    }
    return null;
  }

  async copyObject(source: string, target: string) {
    const result = await this.ossClient.copy(target, source);
    if (result.res.status === 200) {
      return {
        data: result.data,
      };
    }
    return null;
  }

  async putObjectACL(
    fileName: string,
    acl: "public-read" | "public-read-write" | "private"
  ) {
    try {
      await this.ossClient.putACL(fileName, acl);
      return true;
    } catch {
      return false;
    }
  }

  async getObjectACL(fileName: string) {
    const result = await this.ossClient.getACL(fileName);
    if (result.res && result.res.status === 200) {
      return {
        acl: result.acl,
      };
    }
    return null;
  }
}
