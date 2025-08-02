require('dotenv').config();
const WeChatAPI = require('./wechat-api');
const SanityService = require('./sanity-service');
const pLimit = require('p-limit');
const fs = require('fs');
const path = require('path');

const limit = pLimit.default ? pLimit.default(2) : pLimit(2); // 降低并发数到2

// 进度文件路径
const PROGRESS_FILE = path.join(__dirname, '..', 'sync-progress.json');

// 读取进度
function readProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('无法读取进度文件，从头开始:', error.message);
  }
  return { lastSyncedIndex: -1, totalProcessed: 0 };
}

// 保存进度
function saveProgress(lastSyncedIndex, totalProcessed) {
  try {
    const progress = { 
      lastSyncedIndex, 
      totalProcessed,
      lastUpdateTime: new Date().toISOString()
    };
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    console.log(`💾 进度已保存: 已处理 ${totalProcessed} 篇文章，最后索引 ${lastSyncedIndex}`);
  } catch (error) {
    console.warn('无法保存进度:', error.message);
  }
}

async function main() {
  console.log('WeChat Blog Sync - Starting...');

  const requiredEnvVars = ['WX_APPID', 'WX_SECRET', 'SANITY_PROJECT_ID', 'SANITY_DATASET', 'SANITY_API_TOKEN'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  const wechatAPI = new WeChatAPI(process.env.WX_APPID, process.env.WX_SECRET);
  const sanityService = new SanityService(
    process.env.SANITY_PROJECT_ID,
    process.env.SANITY_DATASET,
    process.env.SANITY_API_TOKEN
  );

  // 解析命令行参数
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const resetFlag = process.argv.includes('--reset');
  const latestFlag = process.argv.includes('--latest');
  const checkFlag = process.argv.includes('--check');
  
  let limitCount = null;
  if (limitArg) {
    limitCount = parseInt(limitArg.split('=')[1]);
  }
  
  // 读取或重置进度
  let progress = readProgress();
  if (resetFlag) {
    console.log('🔄 重置进度，从头开始同步');
    progress = { lastSyncedIndex: -1, totalProcessed: 0 };
    saveProgress(-1, 0);
  }
  
  if (latestFlag) {
    console.log('🆕 启用最新文章优先模式，从第1篇（最新）开始');
    progress = { lastSyncedIndex: -1, totalProcessed: 0 };
  }
  
  if (checkFlag) {
    console.log('🔍 检查模式：只查看文章信息，不执行同步');
  }
  
  console.log(`📊 当前进度: 已处理 ${progress.totalProcessed} 篇文章，从索引 ${progress.lastSyncedIndex + 1} 开始`);
  if (limitCount) {
    console.log(`🎯 本次限制: 最多处理 ${limitCount} 篇文章`);
  }
  if (latestFlag) {
    console.log(`🆕 优先同步最新文章（不保存进度）`);
  }

  try {
    console.log('Getting access token...');
    await wechatAPI.getToken();
    console.log('✓ Access token obtained');

    console.log('Getting material count...');
    const materialCount = await wechatAPI.getMaterialCount();
    console.log(`✓ 微信素材统计:`, materialCount);
    console.log(`📊 图文消息: ${materialCount.news_count} 条`);

    let processedCount = progress.totalProcessed;
    let errorCount = 0;
    const batchSize = 10; // 减少批次大小
    
    // 计算实际处理范围
    let startOffset = progress.lastSyncedIndex + 1; // 从上次停止的地方继续
    let endOffset = materialCount.news_count;
    
    if (limitCount !== null) {
      // 限制模式：从当前位置开始，最多处理N篇
      endOffset = Math.min(startOffset + limitCount, materialCount.news_count);
      console.log(`本次处理: 从第 ${startOffset + 1} 篇到第 ${endOffset} 篇 (共 ${endOffset - startOffset} 篇)`);
    } else {
      console.log(`继续处理: 从第 ${startOffset + 1} 篇到第 ${endOffset} 篇 (剩余 ${endOffset - startOffset} 篇)`);
    }
    
    const totalArticlesToProcess = endOffset - startOffset;
    if (totalArticlesToProcess <= 0) {
      console.log('🎉 所有文章已处理完成！');
      return;
    }
    
    const totalBatches = Math.ceil(totalArticlesToProcess / batchSize);
    console.log(`将处理 ${totalArticlesToProcess} 篇文章，分 ${totalBatches} 个批次`);

    let currentlyProcessedInThisRun = 0; // 本次运行已处理的文章数
    
    for (let batch = 0; batch < totalBatches; batch++) {
      const offset = startOffset + (batch * batchSize);
      
      // 确保不超过结束范围
      if (offset >= endOffset) break;
      
      console.log(`\nProcessing batch ${batch + 1}/${totalBatches} (offset: ${offset})`);

      try {
        const materialList = await wechatAPI.getMaterialList('news', offset, batchSize);
        
        if (materialList.item && materialList.item.length > 0) {
          for (const [itemIndex, item] of materialList.item.entries()) {
            // 检查是否已达到本次运行的限制
            if (limitCount && currentlyProcessedInThisRun >= limitCount) {
              console.log(`🎯 已达到本次限制 (${limitCount} 篇)，停止处理`);
              break;
            }
            
            try {
              for (const newsItem of item.content.news_item) {
                // 再次检查限制
                if (limitCount && currentlyProcessedInThisRun >= limitCount) {
                  console.log(`🎯 已达到本次限制 (${limitCount} 篇)，停止处理`);
                  break;
                }
                
                const currentIndex = offset + itemIndex;
                const publishDate = new Date(item.update_time * 1000).toISOString().split('T')[0];
                console.log(`📝 [${currentIndex + 1}/${materialCount.news_count}] ${publishDate}: ${newsItem.title}`);
                
                if (!checkFlag) {
                  const post = {
                    media_id: item.media_id,
                    title: newsItem.title,
                    content: newsItem.content,
                    author: newsItem.author,
                    update_time: item.update_time,
                    url: newsItem.url,
                    digest: newsItem.digest
                  };

                  await sanityService.createOrUpdatePost(post);
                  console.log(`✅ Synced: ${newsItem.title}`);
                  processedCount++;
                  currentlyProcessedInThisRun++;
                  
                  // 保存进度
                  if (!latestFlag) {
                    saveProgress(currentIndex, processedCount);
                  }
                  
                  // 每处理一篇文章后等待60秒，给翻译API充足时间处理
                  console.log('⏳ 等待60秒，让翻译API充分处理...');
                  await new Promise(resolve => setTimeout(resolve, 60000));
                } else {
                  // 检查模式：只显示信息，不同步
                  console.log(`🔍 检查: 作者=${newsItem.author || 'WeChat'}, 摘要=${newsItem.digest || '无'}`);
                  currentlyProcessedInThisRun++;
                }
              }
            } catch (error) {
              console.error(`❌ Error processing article:`, error.message);
              errorCount++;
            }
            
            // 检查是否已达到限制，如果是则跳出外层循环
            if (limitCount && currentlyProcessedInThisRun >= limitCount) {
              break;
            }
          }
        }
        
        // 检查是否已达到限制，如果是则跳出批次循环
        if (limitCount && currentlyProcessedInThisRun >= limitCount) {
          break;
        }
        
        // 每个批次完成后等待30秒
        if (batch < totalBatches - 1 && !(limitCount && currentlyProcessedInThisRun >= limitCount)) {
          console.log('⏱️  批次完成，等待30秒后继续...');
          await new Promise(resolve => setTimeout(resolve, 30000));
        }
      } catch (error) {
        console.error(`❌ Error processing batch ${batch + 1}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n=== Sync Complete ===');
    console.log(`✅ Successfully processed: ${processedCount} articles`);
    console.log(`❌ Errors encountered: ${errorCount}`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = main;