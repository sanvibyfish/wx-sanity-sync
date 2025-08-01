const { createClient } = require('@sanity/client');
const { htmlToBlocks } = require('@sanity/block-tools');
const { JSDOM } = require('jsdom');
const axios = require('axios');

class SanityService {
  constructor(projectId, dataset, token) {
    this.client = createClient({
      projectId,
      dataset,
      token,
      useCdn: false,
      apiVersion: '2023-05-03'
    });
  }

  async downloadAndUploadImage(imageUrl) {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'image/jpeg';
      
      const asset = await this.client.assets.upload('image', buffer, {
        contentType,
        filename: `wx-image-${Date.now()}.jpg`
      });

      return asset.url;
    } catch (error) {
      console.warn(`Failed to upload image ${imageUrl}:`, error.message);
      return imageUrl;
    }
  }

  async processImagesInHtml(html) {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const images = document.querySelectorAll('img');
    const imageMap = new Map();

    for (const img of images) {
      // 微信图片通常使用 data-src 属性
      const dataSrc = img.getAttribute('data-src');
      const originalSrc = dataSrc || img.src;
      
      if (originalSrc && originalSrc.includes('mmbiz.qpic.cn')) {
        try {
          console.log(`🖼️  处理微信图片: ${originalSrc.substring(0, 80)}...`);
          const asset = await this.uploadImageToSanity(originalSrc);
          if (asset) {
            imageMap.set(originalSrc, asset);
            img.setAttribute('data-sanity-asset-id', asset._id);
            // 同时设置src属性确保能被后续处理识别
            img.src = originalSrc;
            console.log(`✅ 图片上传成功: ${asset._id}`);
          }
        } catch (error) {
          console.warn(`❌ 图片上传失败 ${originalSrc}:`, error.message);
        }
      }
    }

    return { 
      html: document.body.innerHTML, 
      imageMap 
    };
  }

  async uploadImageToSanity(imageUrl) {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'image/jpeg';
      
      const asset = await this.client.assets.upload('image', buffer, {
        contentType,
        filename: `wx-image-${Date.now()}.jpg`
      });

      return asset;
    } catch (error) {
      console.warn(`Failed to upload image ${imageUrl}:`, error.message);
      return null;
    }
  }

  transformHtmlToPortableText(html, imageMap = new Map()) {
    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;
      const body = document.body;
      
      if (!body) {
        return this.createFallbackContent(html);
      }

      const blocks = [];
      
      // 首先处理所有图片（包括嵌套的）
      const allImages = body.querySelectorAll('img');
      console.log(`🔍 找到 ${allImages.length} 个图片元素`);
      
      for (const img of allImages) {
        const assetId = img.getAttribute('data-sanity-asset-id');
        const src = img.src || img.getAttribute('data-src');
        
        console.log(`🖼️  处理图片: src=${src ? src.substring(0, 50) + '...' : 'null'}, assetId=${assetId}`);
        
        if (assetId) {
          console.log(`✅ 添加图片块: ${assetId}`);
          blocks.push({
            _type: 'image',
            _key: `image-${Math.random().toString(36).substr(2, 9)}`,
            asset: {
              _type: 'reference',
              _ref: assetId
            },
            alt: img.alt || img.getAttribute('alt') || ''
          });
          
          // 从DOM中移除图片，避免重复处理
          img.remove();
        }
      }
      
      // 然后遍历所有直接子元素处理文本内容
      for (const element of body.children) {
        const tagName = element.tagName.toLowerCase();
        
        if (tagName === 'p') {
          // 处理段落
          const textContent = element.textContent.trim();
          if (textContent) {
            blocks.push({
              _type: 'block',
              _key: `block-${Math.random().toString(36).substr(2, 9)}`,
              style: 'normal',
              children: this.processInlineElements(element),
              markDefs: []
            });
          }
        } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
          // 处理标题
          const textContent = element.textContent.trim();
          if (textContent) {
            blocks.push({
              _type: 'block',
              _key: `block-${Math.random().toString(36).substr(2, 9)}`,
              style: tagName,
              children: this.processInlineElements(element),
              markDefs: []
            });
          }
        } else if (tagName === 'div' || tagName === 'section') {
          // 处理div和section中的内容
          const textContent = element.textContent.trim();
          if (textContent) {
            blocks.push({
              _type: 'block',
              _key: `block-${Math.random().toString(36).substr(2, 9)}`,
              style: 'normal',
              children: this.processInlineElements(element),
              markDefs: []
            });
          }
        }
      }

      return blocks.length > 0 ? blocks : this.createFallbackContent(html);
    } catch (error) {
      console.warn('Failed to convert HTML to Portable Text:', error.message);
      return this.createFallbackContent(html);
    }
  }

  processInlineElements(element) {
    const children = [];
    
    for (const child of element.childNodes) {
      if (child.nodeType === 3) { // Text node
        const text = child.textContent;
        if (text.trim()) {
          children.push({
            _type: 'span',
            _key: `span-${Math.random().toString(36).substr(2, 9)}`,
            text: text,
            marks: []
          });
        }
      } else if (child.nodeType === 1) { // Element node
        const tagName = child.tagName.toLowerCase();
        const text = child.textContent;
        
        if (text.trim()) {
          let marks = [];
          
          if (tagName === 'strong' || tagName === 'b') {
            marks.push('strong');
          } else if (tagName === 'em' || tagName === 'i') {
            marks.push('em');
          }
          
          children.push({
            _type: 'span',
            _key: `span-${Math.random().toString(36).substr(2, 9)}`,
            text: text,
            marks: marks
          });
        }
      }
    }
    
    // 如果没有找到子元素，直接使用文本内容
    if (children.length === 0) {
      const text = element.textContent.trim();
      if (text) {
        children.push({
          _type: 'span',
          _key: `span-${Math.random().toString(36).substr(2, 9)}`,
          text: text,
          marks: []
        });
      }
    }
    
    return children;
  }

  createFallbackContent(html) {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const textContent = document.body ? document.body.textContent : html.replace(/<[^>]*>/g, '');
    
    const paragraphs = textContent.split('\n').filter(p => p.trim().length > 0);
    
    return paragraphs.map(paragraph => ({
      _type: 'block',
      _key: `block-${Math.random().toString(36).substr(2, 9)}`,
      style: 'normal',
      children: [
        {
          _type: 'span',
          _key: `span-${Math.random().toString(36).substr(2, 9)}`,
          text: paragraph.trim(),
          marks: []
        }
      ],
      markDefs: []
    }));
  }

  async createOrUpdatePost(post) {
    try {
      // 先检查文章是否已存在
      const existingPost = await this.checkPostExists(post.media_id);
      
      const { html: processedHtml, imageMap } = await this.processImagesInHtml(post.content);
      const portableTextContent = this.transformHtmlToPortableText(processedHtml, imageMap);

      const sanityPost = {
        _id: `wx-${post.media_id}`,
        _type: 'post', // webhook期望的类型
        title: post.title,
        slug: {
          _type: 'slug',
          current: `wx-${post.media_id}`
        },
        content: portableTextContent,
        language: 'zh', // webhook检查的语言字段
        publishedAt: existingPost ? existingPost.publishedAt : new Date(post.update_time * 1000).toISOString(), // 保持原有发布时间，避免重复触发webhook
        // 不设置parent字段，让webhook识别为原创文章
        source: 'wechat',
        wechatMediaId: post.media_id,
        wechatUrl: post.url,
        excerpt: post.digest || '',
        author: post.author || 'WeChat'
      };

      const result = await this.client.createOrReplace(sanityPost);
      
      if (existingPost) {
        console.log(`Updated existing post: ${post.title} with ID: ${result._id} (保持原发布时间，不触发翻译)`);
      } else {
        console.log(`Created new post: ${post.title} with ID: ${result._id}`);
        console.log(`Translation webhook should trigger for: language=${sanityPost.language}, type=${sanityPost._type}, publishedAt=${sanityPost.publishedAt}`);
      }
      
      return result;
    } catch (error) {
      throw new Error(`Error creating/updating post: ${error.message}`);
    }
  }

  async checkPostExists(mediaId) {
    try {
      const query = `*[_id == "wx-${mediaId}"][0]`;
      const result = await this.client.fetch(query);
      return result;
    } catch (error) {
      console.warn(`Error checking if post exists: ${error.message}`);
      return null;
    }
  }
}

module.exports = SanityService;