const axios = require('axios');

class WeChatAPI {
  constructor(appId, secret) {
    this.appId = appId;
    this.secret = secret;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.get(
        `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.appId}&secret=${this.secret}`
      );

      if (response.data.access_token) {
        this.accessToken = response.data.access_token;
        this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;
        return this.accessToken;
      } else {
        throw new Error(`Failed to get access token: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      throw new Error(`Error getting access token: ${error.message}`);
    }
  }

  async getMaterialCount() {
    const token = await this.getToken();
    
    try {
      const response = await axios.post(
        `https://api.weixin.qq.com/cgi-bin/material/get_materialcount?access_token=${token}`,
        {}
      );

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`WeChat API error: ${response.data.errmsg}`);
      }

      return response.data;
    } catch (error) {
      throw new Error(`Error getting material count: ${error.message}`);
    }
  }

  async getMaterialList(type = 'news', offset = 0, count = 20) {
    const token = await this.getToken();
    
    try {
      const response = await axios.post(
        `https://api.weixin.qq.com/cgi-bin/material/batchget_material?access_token=${token}`,
        {
          type: type,
          offset: offset,
          count: count
        }
      );

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`WeChat API error: ${response.data.errmsg}`);
      }

      return response.data;
    } catch (error) {
      throw new Error(`Error getting material list: ${error.message}`);
    }
  }

  async getMaterial(mediaId) {
    const token = await this.getToken();
    
    try {
      const response = await axios.post(
        `https://api.weixin.qq.com/cgi-bin/material/get_material?access_token=${token}`,
        {
          media_id: mediaId
        }
      );

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`WeChat API error: ${response.data.errmsg}`);
      }

      return response.data;
    } catch (error) {
      throw new Error(`Error getting material: ${error.message}`);
    }
  }
}

module.exports = WeChatAPI;