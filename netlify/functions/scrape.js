const fetch = require('node-fetch');
const cheerio = require('cheerio');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: '{}' };
  }

  const url = event.queryStringParameters?.url;
  if (!url) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta el parámetro url' }) };
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 15000,
    });

    if (!res.ok) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: `Error HTTP ${res.status}` }) };
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const baseUrl = new URL(url).origin;

    const title = $('h1.title-manga').first().text().trim();
    if (!title) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No se pudo extraer el título. Verificá que la URL sea de una página de manga.' }) };
    }

    const coverSrc = $('.media-left.cover-detail img').attr('src') || $('.cover-detail img').attr('src');
    const imageUrl = coverSrc ? new URL(coverSrc, baseUrl).href : null;

    const firstChapterLink = $('.chapter-list ul li').first().find('a');
    const chapterHref = firstChapterLink.attr('href');
    const chapterText = firstChapterLink.text().trim();

    let currentChapter = null;
    if (chapterText) {
      const match = chapterText.match(/(\d+)/);
      if (match) currentChapter = parseInt(match[1], 10);
    }

    const readingUrl = chapterHref ? new URL(chapterHref, baseUrl).href : null;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ title, imageUrl, currentChapter, readingUrl, success: true }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
