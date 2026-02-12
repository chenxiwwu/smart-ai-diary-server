import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();

// POST /api/link-preview
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    // 验证 URL 格式
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // 抓取目标网页 HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });

    const html = await response.text();

    // 解析 meta 标签内容
    const getMetaContent = (property: string): string => {
      // <meta property="og:xxx" content="yyy"> 或 <meta name="xxx" content="yyy">
      const regex = new RegExp(
        `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
        'i'
      );
      const match = html.match(regex);
      if (match) return match[1];
      // content 在前的情况
      const regex2 = new RegExp(
        `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
        'i'
      );
      const match2 = html.match(regex2);
      return match2 ? match2[1] : '';
    };

    const title = getMetaContent('og:title')
      || getMetaContent('twitter:title')
      || (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim();

    const description = getMetaContent('og:description')
      || getMetaContent('twitter:description')
      || getMetaContent('description');

    const image = getMetaContent('og:image')
      || getMetaContent('twitter:image');

    const siteName = getMetaContent('og:site_name') || parsedUrl.hostname;

    res.json({
      url,
      title: title || url,
      description: description || '',
      image: image || '',
      siteName: siteName || '',
    });
  } catch (error: any) {
    console.error('Link preview error:', error.message);
    // 解析失败也返回基础信息
    res.json({
      url: req.body.url,
      title: req.body.url,
      description: '',
      image: '',
      siteName: '',
    });
  }
});

export default router;
