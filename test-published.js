require('dotenv').config();
const WeChatAPI = require('./src/wechat-api');

async function testPublishedArticles() {
  console.log('测试已发布文章接口...');
  
  const wechatAPI = new WeChatAPI(process.env.WX_APPID, process.env.WX_SECRET);
  
  try {
    console.log('获取access token...');
    await wechatAPI.getToken();
    console.log('✓ Token获取成功');
    
    console.log('\n获取已发布文章总数...');
    const totalCount = await wechatAPI.getPublishedCount();
    console.log(`✓ 已发布文章总数: ${totalCount}`);
    
    console.log('\n获取最新10篇已发布文章...');
    const articles = await wechatAPI.getPublishedArticles(0, 10);
    
    if (articles.item && articles.item.length > 0) {
      console.log(`✓ 找到 ${articles.item.length} 篇文章:`);
      
      articles.item.forEach((article, index) => {
        const publishTime = new Date(article.publish_time * 1000).toISOString().split('T')[0];
        console.log(`\n${index + 1}. [${publishTime}] ${article.article_id}`);
        
        if (article.content && article.content.news_item) {
          article.content.news_item.forEach((newsItem, newsIndex) => {
            console.log(`   ${newsIndex + 1}) ${newsItem.title}`);
            console.log(`      作者: ${newsItem.author || '未知'}`);
            console.log(`      摘要: ${newsItem.digest || '无'}`);
          });
        }
      });
    } else {
      console.log('❌ 没有找到已发布文章');
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

testPublishedArticles();