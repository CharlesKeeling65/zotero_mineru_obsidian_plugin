/**
 * Zotero 附件管理器。
 *
 * 中文：这个模块负责将 MinerU 解析结果文件添加到 Zotero 条目下，
 * 包括 Markdown 文件、JSON 元数据、图片等。
 *
 * English: This module handles adding MinerU parse result files to Zotero items,
 * including Markdown files, JSON metadata, images, etc.
 */

import type { RawMineruFile } from "../types/mineru.js";

/**
 * 附件类型枚举。
 *
 * 中文：定义不同类型的附件。
 * English: Define different types of attachments.
 */
export enum AttachmentType {
  /** 中文：Markdown 文件；English: Markdown file. */
  MARKDOWN = "text/markdown",
  /** 中文：JSON 文件；English: JSON file. */
  JSON = "application/json",
  /** 中文：图片文件；English: Image file. */
  IMAGE = "image/*",
  /** 中文：其他文件；English: Other file. */
  OTHER = "application/octet-stream"
}

/**
 * 附件信息接口。
 *
 * 中文：定义附件的元数据信息。
 * English: Define attachment metadata information.
 */
export interface AttachmentInfo {
  /** 中文：文件名；English: filename. */
  filename: string;
  /** 中文：文件内容；English: file content. */
  content: string | Uint8Array;
  /** 中文：附件类型；English: attachment type. */
  contentType: AttachmentType;
  /** 中文：文件路径（可选）；English: file path (optional). */
  path?: string;
}

/**
 * 附件管理器配置。
 *
 * 中文：定义附件管理器的配置选项。
 * English: Define attachment manager configuration options.
 */
export interface AttachmentManagerConfig {
  /** 中文：是否自动添加附件；English: whether to automatically add attachments. */
  autoAddAttachments: boolean;
  /** 中文：是否覆盖已存在的附件；English: whether to overwrite existing attachments. */
  overwriteExisting: boolean;
  /** 中文：要添加的附件类型；English: attachment types to add. */
  attachmentTypes: AttachmentType[];
}

/**
 * 默认附件管理器配置。
 *
 * 中文：默认配置，添加所有类型的附件。
 * English: Default configuration, add all types of attachments.
 */
export const DEFAULT_ATTACHMENT_CONFIG: AttachmentManagerConfig = {
  autoAddAttachments: true,
  overwriteExisting: false,
  attachmentTypes: [
    AttachmentType.MARKDOWN,
    AttachmentType.JSON,
    AttachmentType.IMAGE
  ]
};

/**
 * 附件管理器类。
 *
 * 中文：负责管理 Zotero 条目的附件。
 * English: Responsible for managing Zotero item attachments.
 */
export class AttachmentManager {
  private readonly config: AttachmentManagerConfig;

  constructor(config: AttachmentManagerConfig = DEFAULT_ATTACHMENT_CONFIG) {
    this.config = config;
  }

  /**
   * 将 MinerU 解析结果文件添加到 Zotero 条目。
   *
   * 中文：将 MinerU 解析结果文件添加到指定的 Zotero 条目下。
   * English: Add MinerU parse result files to the specified Zotero item.
   *
   * @param itemKey Zotero 条目键 / Zotero item key
   * @param rawFiles MinerU 原始文件列表 / MinerU raw files list
   * @param pdfPath 原始 PDF 路径 / Original PDF path
   * @returns 添加的附件数量 / Number of attachments added
   */
  async addMineruFilesToItem(
    itemKey: string,
    rawFiles: RawMineruFile[],
    pdfPath: string
  ): Promise<number> {
    // 中文：检查是否在 Zotero 环境中
    // English: Check if running in Zotero environment
    if (typeof Zotero === "undefined" || !Zotero.Items) {
      console.warn("Zotero.Items API not available. Attachment addition skipped.");
      return 0;
    }

    try {
      // 中文：获取 Zotero 条目
      // English: Get Zotero item
      const item = await Zotero.Items.getByLibraryAndKeyAsync(
        Zotero.Libraries.userLibraryID,
        itemKey
      );

      if (!item) {
        console.error(`Zotero 条目未找到: ${itemKey}`);
        return 0;
      }

      let addedCount = 0;

      // 中文：遍历所有原始文件
      // English: Iterate through all raw files
      for (const rawFile of rawFiles) {
        // 中文：检查是否应该添加此类型的附件
        // English: Check if this type of attachment should be added
        if (!this.shouldAddAttachment(rawFile.name)) {
          continue;
        }

        // 中文：创建附件信息
        // English: Create attachment info
        const attachmentInfo = this.createAttachmentInfo(rawFile, pdfPath);

        // 中文：添加附件到 Zotero 条目
        // English: Add attachment to Zotero item
        const success = await this.addAttachmentToItem(item, attachmentInfo);
        if (success) {
          addedCount++;
        }
      }

      console.log(`成功添加 ${addedCount} 个附件到条目 ${itemKey}`);
      return addedCount;
    } catch (error) {
      console.error("添加附件失败:", error);
      return 0;
    }
  }

  /**
   * 检查是否应该添加指定文件名的附件。
   *
   * 中文：根据文件扩展名和配置的附件类型判断是否应该添加。
   * English: Determine whether to add attachment based on file extension and configured attachment types.
   *
   * @param filename 文件名 / Filename
   * @returns 是否应该添加 / Whether to add
   */
  private shouldAddAttachment(filename: string): boolean {
    const extension = filename.toLowerCase().split('.').pop();

    // 中文：根据文件扩展名判断类型
    // English: Determine type based on file extension
    switch (extension) {
      case 'md':
        return this.config.attachmentTypes.includes(AttachmentType.MARKDOWN);
      case 'json':
        return this.config.attachmentTypes.includes(AttachmentType.JSON);
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'webp':
      case 'svg':
        return this.config.attachmentTypes.includes(AttachmentType.IMAGE);
      default:
        return this.config.attachmentTypes.includes(AttachmentType.OTHER);
    }
  }

  /**
   * 创建附件信息。
   *
   * 中文：根据原始文件和 PDF 路径创建附件信息。
   * English: Create attachment info based on raw file and PDF path.
   *
   * @param rawFile 原始文件 / Raw file
   * @param pdfPath PDF 路径 / PDF path
   * @returns 附件信息 / Attachment info
   */
  private createAttachmentInfo(rawFile: RawMineruFile, pdfPath: string): AttachmentInfo {
    const filename = rawFile.name;
    const extension = filename.toLowerCase().split('.').pop();

    // 中文：根据文件扩展名确定内容类型
    // English: Determine content type based on file extension
    let contentType: AttachmentType;
    switch (extension) {
      case 'md':
        contentType = AttachmentType.MARKDOWN;
        break;
      case 'json':
        contentType = AttachmentType.JSON;
        break;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'webp':
      case 'svg':
        contentType = AttachmentType.IMAGE;
        break;
      default:
        contentType = AttachmentType.OTHER;
    }

    return {
      filename,
      content: rawFile.content,
      contentType,
      path: pdfPath
    };
  }

  /**
   * 添加附件到 Zotero 条目。
   *
   * 中文：将附件添加到指定的 Zotero 条目。
   * English: Add attachment to the specified Zotero item.
   *
   * @param item Zotero 条目 / Zotero item
   * @param attachmentInfo 附件信息 / Attachment info
   * @returns 是否成功 / Whether successful
   */
  private async addAttachmentToItem(
    item: any,
    attachmentInfo: AttachmentInfo
  ): Promise<boolean> {
    try {
      // 中文：检查是否已存在同名附件
      // English: Check if attachment with same name already exists
      const existingAttachments = await item.getAttachments();
      for (const attachmentId of existingAttachments) {
        const attachment = await Zotero.Items.getAsync(attachmentId);
        if (attachment.attachmentFilename === attachmentInfo.filename) {
          if (this.config.overwriteExisting) {
            // 中文：删除已存在的附件
            // English: Delete existing attachment
            await Zotero.Items.erase(attachment.id);
          } else {
            console.log(`附件已存在，跳过: ${attachmentInfo.filename}`);
            return false;
          }
        }
      }

      // 中文：创建新附件
      // English: Create new attachment
      const attachment = new Zotero.Item('attachment');
      attachment.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_FILE;
      attachment.attachmentContentType = attachmentInfo.contentType;
      attachment.attachmentFilename = attachmentInfo.filename;
      attachment.attachmentPath = attachmentInfo.path;

      // 中文：设置父条目
      // English: Set parent item
      attachment.parentItemID = item.id;

      // 中文：保存附件
      // English: Save attachment
      await attachment.saveTx();

      // 中文：写入文件内容
      // English: Write file content
      if (typeof attachmentInfo.content === 'string') {
        await Zotero.Attachments.putContentsAsync(
          attachment,
          attachmentInfo.content,
          'utf8'
        );
      } else {
        await Zotero.Attachments.putContentsAsync(
          attachment,
          attachmentInfo.content
        );
      }

      console.log(`成功添加附件: ${attachmentInfo.filename}`);
      return true;
    } catch (error) {
      console.error(`添加附件失败: ${attachmentInfo.filename}`, error);
      return false;
    }
  }

  /**
   * 获取附件统计信息。
   *
   * 中文：获取指定条目的附件统计信息。
   * English: Get attachment statistics for the specified item.
   *
   * @param itemKey Zotero 条目键 / Zotero item key
   * @returns 附件统计信息 / Attachment statistics
   */
  async getAttachmentStats(itemKey: string): Promise<{
    total: number;
    byType: Record<AttachmentType, number>;
  }> {
    // 中文：检查是否在 Zotero 环境中
    // English: Check if running in Zotero environment
    if (typeof Zotero === "undefined" || !Zotero.Items) {
      return { total: 0, byType: {} as Record<AttachmentType, number> };
    }

    try {
      const item = await Zotero.Items.getByLibraryAndKeyAsync(
        Zotero.Libraries.userLibraryID,
        itemKey
      );

      if (!item) {
        return { total: 0, byType: {} as Record<AttachmentType, number> };
      }

      const attachmentIds = await item.getAttachments();
      const byType: Record<AttachmentType, number> = {} as Record<AttachmentType, number>;

      // 中文：初始化计数器
      // English: Initialize counters
      for (const type of Object.values(AttachmentType)) {
        byType[type as AttachmentType] = 0;
      }

      // 中文：统计附件类型
      // English: Count attachment types
      for (const attachmentId of attachmentIds) {
        const attachment = await Zotero.Items.getAsync(attachmentId);
        const contentType = attachment.attachmentContentType as AttachmentType;
        if (byType[contentType] !== undefined) {
          byType[contentType]++;
        }
      }

      return {
        total: attachmentIds.length,
        byType
      };
    } catch (error) {
      console.error("获取附件统计信息失败:", error);
      return { total: 0, byType: {} as Record<AttachmentType, number> };
    }
  }
}

/**
 * 创建附件管理器。
 *
 * 中文：创建附件管理器实例。
 * English: Create attachment manager instance.
 *
 * @param config 配置 / Configuration
 * @returns 附件管理器实例 / Attachment manager instance
 */
export function createAttachmentManager(
  config: AttachmentManagerConfig = DEFAULT_ATTACHMENT_CONFIG
): AttachmentManager {
  return new AttachmentManager(config);
}